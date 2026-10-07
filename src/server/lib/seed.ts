import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { campaigns, channels } from "../db/schema";
import { uuidv7 } from "uuidv7";

/**
 * Seed a default campaign on first run so the app is usable out of the box
 * (and the meeting experience has a demo room to point at).
 */
export async function seed() {
  const existing = await db.select().from(campaigns).get();
  if (existing) return;

  const campaignId = uuidv7();
  await db.insert(campaigns).values({ id: campaignId, name: "Crônicas de Astar" });

  const seedChannels = ["praça-central", "diário-da-campanha", "ruínas-de-astar", "entre-sessões"];

  for (const [position, name] of seedChannels.entries()) {
    await db.insert(channels).values({ id: uuidv7(), campaignId, name, position });
  }
  console.log("[seed] created demo campaign 'Crônicas de Astar'");
}
