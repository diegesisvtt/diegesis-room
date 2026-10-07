import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { db } from "../../db/client";
import { campaigns } from "../../db/schema";

export async function listCampaigns() {
  return db.select().from(campaigns).orderBy(campaigns.createdAt);
}

export async function getCampaign(id: string) {
  return db.select().from(campaigns).where(eq(campaigns.id, id)).get();
}

export async function createCampaign(name: string) {
  const id = uuidv7();
  await db.insert(campaigns).values({ id, name });
  return getCampaign(id);
}
