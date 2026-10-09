import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/web/components/ui/button";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Evita tela em branco quando algo quebra no render: mostra o erro em vez de
 * desmontar a árvore inteira do React.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex min-h-full items-center justify-center bg-background px-6 text-foreground">
          <div className="card-ornate w-full max-w-sm rounded-xl p-7 text-center">
            <p className="font-display text-lg text-glow text-foreground">Algo deu errado</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            <pre className="mt-4 overflow-auto rounded-md border border-border bg-background/50 p-3 text-left text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
            <Button
              variant="outline-gold"
              className="mt-6"
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
            >
              Recarregar
            </Button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
