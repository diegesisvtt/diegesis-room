import { createBrowserRouter, Outlet } from "react-router-dom";
import { Dices } from "lucide-react";
import { LandingPage } from "@/web/features/landing/LandingPage";
import { JoinPage } from "@/web/features/join/JoinPage";
import { AuthPage } from "@/web/features/auth/AuthPage";
import { ChangePasswordPage } from "@/web/features/auth/ChangePasswordPage";
import { CampaignPage } from "@/web/features/campaign/CampaignPage";
import { ChannelView } from "@/web/features/campaign/ChannelView";
import { CampaignSettingsPage } from "@/web/features/campaign/CampaignSettingsPage";
import { MembersPage } from "@/web/features/campaign/MembersPage";
import { StreamPage } from "@/web/features/tv-mode/StreamPage";
import { SettingsPage } from "@/web/features/settings/SettingsPage";
import { PageTransition } from "@/web/components/PageTransition";
import { VoiceAudio } from "@/web/features/meeting/VoiceAudio";
import { FloatingVoiceDock } from "@/web/features/meeting/VoiceDock";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <PageTransition><LandingPage /></PageTransition> },
      { path: "/login", element: <PageTransition><AuthPage mode="login" /></PageTransition> },
      { path: "/register", element: <PageTransition><AuthPage mode="register" /></PageTransition> },
      { path: "/change-password", element: <PageTransition><ChangePasswordPage /></PageTransition> },
      { path: "/join/:token", element: <PageTransition><JoinPage /></PageTransition> },
      {
        path: "/campaign/:campaignId",
        element: <CampaignPage />,
        children: [
          { index: true, element: <CampaignWelcome /> },
          { path: "settings", element: <CampaignSettingsPage /> },
          { path: "members", element: <MembersPage /> },
          { path: "channel/:channelId/*", element: <ChannelView /> },
        ],
      },
      { path: "/stream/:channelId", element: <StreamPage /> },
      { path: "/settings", element: <PageTransition><SettingsPage /></PageTransition> },
    ],
  },
]);

function AppShell() {
  return (
    <>
      <Outlet />
      {/* Áudio remoto persiste fora do palco (qualquer rota). */}
      <VoiceAudio />
      {/* Dock flutuante para telas sem sidebar (ex.: /settings). */}
      <FloatingVoiceDock />
    </>
  );
}

function CampaignWelcome() {
  return (
    <div className="relative flex h-full flex-1 items-center justify-center overflow-hidden text-muted-foreground">
      <div className="map-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="vignette pointer-events-none absolute inset-0" />
      <div className="relative text-center animate-slide-up">
        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-2xl border border-accent/25 bg-card animate-float shadow-[var(--shadow-glow-gold)]">
          <Dices className="size-9 text-accent" />
        </div>
        <p className="font-display text-2xl font-semibold text-gold-bright text-glow">Escolha um canal</p>
        <p className="mt-2 text-sm">Selecione um canal de texto ou uma mesa de voz para começar.</p>
      </div>
    </div>
  );
}
