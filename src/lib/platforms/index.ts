import { pinterestPublisher } from "./pinterest";
import type { Publisher } from "./types";

const publishers: Record<string, Publisher> = {
  pinterest: pinterestPublisher,
  // facebook: facebookPublisher,  ← future
};

export function getPublisher(platform: string): Publisher {
  const p = publishers[platform];
  if (!p) throw new Error(`No publisher registered for platform "${platform}"`);
  return p;
}

export type { Publisher, Board, PublishResult } from "./types";
