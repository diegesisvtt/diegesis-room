import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";
import { getPreferences, type CameraBackground, type SegmentationQuality } from "@/web/lib/preferences";

/**
 * Pipeline de fundo virtual (MediaPipe ImageSegmenter) para a câmera pessoal.
 * Roda no thread principal: um <video> oculto toca o stream bruto, o MediaPipe
 * produz a máscara de confiança por frame e um <canvas> compõe a pessoa sobre o
 * fundo escolhido (desfoque, cor sólida ou imagem). O resultado é exposto como
 * MediaStreamTrack via `canvas.captureStream`.
 *
 * A "pessoa" é derivada invertendo a confiança do fundo (`1 - confidenceMasks[0]`),
 * o que funciona para selfie_segmenter (2 classes) e selfie_multiclass (multiclasse).
 */

const WASM_ROOT = "/mediapipe/wasm/";
const MODEL_PATHS: Record<SegmentationQuality, string> = {
  fast: "/mediapipe/models/selfie_segmenter.tflite",
  quality: "/mediapipe/models/selfie_multiclass_256x256.tflite",
};
const BLUR_RADIUS = 20;
// Suavização extra na borda da máscara (px). A rampa de confiança já suaviza;
// este valor acrescenta um leve feathering.
const EDGE_FEATHER = 1.5;

export type BackgroundPipeline = {
  track: MediaStreamTrack;
  stop: () => void;
};

// `WasmFileset` não é exportado pelo pacote, então derivamos o tipo do retorno.
type Fileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

let filesetPromise: Promise<Fileset> | null = null;

function loadFileset(): Promise<Fileset> {
  if (!filesetPromise) filesetPromise = FilesetResolver.forVisionTasks(WASM_ROOT);
  return filesetPromise;
}

async function createSegmenter(quality: SegmentationQuality): Promise<ImageSegmenter> {
  const fileset = await loadFileset();
  const modelAssetPath = MODEL_PATHS[quality];
  const options = {
    baseOptions: { modelAssetPath },
    runningMode: "VIDEO" as const,
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  };
  try {
    return await ImageSegmenter.createFromOptions(fileset, {
      ...options,
      baseOptions: { modelAssetPath, delegate: "GPU" as const },
    });
  } catch {
    // Sem WebGL (ou contexto indisponível): cai para CPU.
    return await ImageSegmenter.createFromOptions(fileset, {
      ...options,
      baseOptions: { modelAssetPath, delegate: "CPU" as const },
    });
  }
}

export async function createBackgroundPipeline(opts: {
  stream: MediaStream;
  background: CameraBackground;
  width: number;
  height: number;
}): Promise<BackgroundPipeline> {
  const { stream, background, width, height } = opts;

  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  let stopped = false;
  let raf = 0;
  let closeSegmenter: (() => void) | null = null;

  const track = canvas.captureStream(30).getVideoTracks()[0]!;

  async function start(): Promise<void> {
    await video.play();

    if (background.mode === "none") {
      const render = () => {
        if (stopped) return;
        ctx.drawImage(video, 0, 0, width, height);
        raf = requestAnimationFrame(render);
      };
      raf = requestAnimationFrame(render);
      return;
    }

    const bgImage = background.mode === "image" && background.imageUrl
      ? await loadImage(background.imageUrl)
      : null;

    const personCanvas = document.createElement("canvas");
    personCanvas.width = width;
    personCanvas.height = height;
    const personCtx = personCanvas.getContext("2d")!;

    const blurCanvas = document.createElement("canvas");
    blurCanvas.width = width;
    blurCanvas.height = height;
    const blurCtx = blurCanvas.getContext("2d")!;

    const maskCanvas = document.createElement("canvas");
    const maskCtx = maskCanvas.getContext("2d")!;
    let maskReady = false;
    let maskImageData: ImageData | null = null;

    const segmenter = await createSegmenter(getPreferences().segmentationQuality);
    closeSegmenter = () => segmenter.close();

    /** Converte a confiança do fundo em um alpha da pessoa (0..255). */
    function updateMask(mask: { getAsFloat32Array(): Float32Array; width: number; height: number }) {
      const data = mask.getAsFloat32Array();
      const w = mask.width;
      const h = mask.height;
      if (!maskImageData || maskImageData.width !== w || maskImageData.height !== h) {
        maskCanvas.width = w;
        maskCanvas.height = h;
        maskImageData = new ImageData(w, h);
      }
      const rgba = maskImageData.data;
      for (let i = 0; i < data.length; i++) {
        const person = 1 - data[i]!;
        // Rampa suave 0.4..0.7 -> alpha 0..1 (bordas mais limpas).
        const a = Math.min(1, Math.max(0, (person - 0.4) / 0.3));
        rgba[i * 4 + 3] = Math.round(a * 255);
      }
      maskCtx.putImageData(maskImageData, 0, 0);
      maskReady = true;
    }

    function drawBackground() {
      if (background.mode === "blur") {
        blurCtx.clearRect(0, 0, width, height);
        blurCtx.filter = `blur(${BLUR_RADIUS}px)`;
        blurCtx.drawImage(video, 0, 0, width, height);
        blurCtx.filter = "none";
        ctx.drawImage(blurCanvas, 0, 0, width, height);
      } else if (background.mode === "color") {
        ctx.fillStyle = background.color;
        ctx.fillRect(0, 0, width, height);
      } else if (background.mode === "image" && bgImage) {
        drawCover(ctx, bgImage, width, height);
      }
    }

    function drawPerson() {
      if (!maskReady) {
        ctx.drawImage(video, 0, 0, width, height);
        return;
      }
      personCtx.clearRect(0, 0, width, height);
      personCtx.drawImage(video, 0, 0, width, height);
      personCtx.globalCompositeOperation = "destination-in";
      if (EDGE_FEATHER > 0) personCtx.filter = `blur(${EDGE_FEATHER}px)`;
      personCtx.drawImage(maskCanvas, 0, 0, width, height);
      personCtx.filter = "none";
      personCtx.globalCompositeOperation = "source-over";
      ctx.drawImage(personCanvas, 0, 0, width, height);
    }

    function render() {
      if (stopped) return;
      ctx.clearRect(0, 0, width, height);
      drawBackground();
      drawPerson();
    }

    let lastVideoTime = -1;
    const loop = () => {
      if (stopped) return;
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        try {
          segmenter.segmentForVideo(video, performance.now(), (result) => {
            const backgroundMask = result.confidenceMasks?.[0];
            if (backgroundMask) {
              updateMask(backgroundMask);
              render();
            }
          });
        } catch {
          /* frame descartado */
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  await start();

  return {
    track,
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
      if (closeSegmenter) closeSegmenter();
      for (const t of stream.getTracks()) t.stop();
      track.stop();
    },
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar a imagem de fundo"));
    img.src = src;
  });
}

/** Desenha a imagem preenchendo o canvas no modo "cover" (centralizada e cortada). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}
