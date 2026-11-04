import type { Pin } from "@/db/schema";

export type PublishResult = { externalId: string; externalUrl?: string };

export type Board = { id: string; name: string; privacy?: string };

/**
 * Every social platform implements this. Adding Facebook later means adding
 * `facebook.ts` with the same shape and registering it in `index.ts`.
 */
export interface Publisher {
  readonly platform: string;
  isConnected(): Promise<boolean>;
  listBoards(force?: boolean): Promise<Board[]>;
  publish(pin: Pin): Promise<PublishResult>;
}
