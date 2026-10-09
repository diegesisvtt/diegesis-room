import type { Campaign, Channel, VoiceParticipant } from "@/web/lib/api";
import type { Session } from "@/web/lib/session";

export type CampaignContext = {
  campaign: Campaign;
  channels: Channel[];
  presence: Record<string, VoiceParticipant[]>;
  session: Session;
  refresh: () => Promise<void>;
  updateSession: (patch: Partial<Session>) => void;
};
