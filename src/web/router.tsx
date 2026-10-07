import { createBrowserRouter } from "react-router-dom";
import { LandingPage } from "@/web/features/landing/LandingPage";
import { JoinPage } from "@/web/features/join/JoinPage";
import { CampaignPage } from "@/web/features/campaign/CampaignPage";
import { ChannelView } from "@/web/features/campaign/ChannelView";
import { StreamPage } from "@/web/features/tv-mode/StreamPage";
import { SettingsPage } from "@/web/features/settings/SettingsPage";

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/join/:token", element: <JoinPage /> },
  {
    path: "/campaign/:campaignId",
    element: <CampaignPage />,
    children: [
      { index: true, element: <CampaignWelcome /> },
      { path: "channel/:channelId/*", element: <ChannelView /> },
    ],
  },
  { path: "/stream/:channelId", element: <StreamPage /> },
  { path: "/settings", element: <SettingsPage /> },
]);

function CampaignWelcome() {
  return (
    <div className="flex h-full flex-1 items-center justify-center text-muted-foreground">
      <div className="text-center">
        <p className="text-lg font-semibold text-foreground">Escolha um canal</p>
        <p className="mt-1 text-sm">Selecione um canal de texto ou uma mesa de voz para começar.</p>
      </div>
    </div>
  );
}
