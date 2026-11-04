import { getConnection, pinterestDirect } from "./pinterest";
import { makeConfig, makePublisher } from "./make";
import type { Publisher } from "./types";

export type PinterestRoute = "direct" | "make" | "none";

/** Direct Pinterest API wins once connected; otherwise fall back to the Make.com bridge. */
export async function pinterestRoute(): Promise<PinterestRoute> {
  if (await getConnection()) return "direct";
  if (makeConfig().ready) return "make";
  return "none";
}

async function pick(): Promise<Publisher> {
  const route = await pinterestRoute();
  return route === "make" ? makePublisher : pinterestDirect;
}

const pinterestRouter: Publisher = {
  platform: "pinterest",
  async isConnected() {
    return (await pinterestRoute()) !== "none";
  },
  async listBoards(force) {
    return (await pick()).listBoards(force);
  },
  async publish(pin) {
    if ((await pinterestRoute()) === "none") throw new Error("Pinterest isn't connected and Make.com isn't set up yet. See Settings.");
    return (await pick()).publish(pin);
  },
};

const publishers: Record<string, Publisher> = {
  pinterest: pinterestRouter,
  // facebook: facebookPublisher,  ← future
};

export function getPublisher(platform: string): Publisher {
  const p = publishers[platform];
  if (!p) throw new Error(`No publisher registered for platform "${platform}"`);
  return p;
}

export type { Publisher, Board, PublishResult } from "./types";
