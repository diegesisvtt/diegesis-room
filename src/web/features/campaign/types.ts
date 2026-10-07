import type { Campaign, Channel } from "@/web/lib/api";
import type { Session } from "@/web/lib/session";

export type CampaignContext = {
  campaign: Campaign;
  channels: Channel[];
  session: Session;
  refresh: () => Promise<void>;
  updateSession: (patch: Partial<Session>) => void;
};
