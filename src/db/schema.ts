import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Single-row table (id = 1) holding the user's preferences. */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  associateTag: text("associate_tag").notNull().default(""),
  defaultDestinationLink: text("default_destination_link").notNull().default(""),
  /** Local times in HH:MM, e.g. ["09:00","12:30","17:00","20:30"]. */
  dailyTimes: jsonb("daily_times").$type<string[]>().notNull().default(["09:00", "12:30", "17:00", "20:30"]),
  timezone: text("timezone").notNull().default("America/Chicago"),
  defaultHashtags: text("default_hashtags").notNull().default(""),
  disclosureText: text("disclosure_text")
    .notNull()
    .default("#ad As an Amazon Associate I earn from qualifying purchases."),
  defaultBoardId: text("default_board_id"),
  /** Last time the external cron called /api/cron/publish (for the Settings health check). */
  lastCronAt: timestamp("last_cron_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  /**
   * What we send to Canopy: either a bestseller slug ("bestsellers_beauty")
   * or a full Amazon best-sellers page URL (lets us target sub-categories).
   */
  amazonCategory: text("amazon_category").notNull().default(""),
  /** Human-readable Amazon name once we have fetched it. */
  amazonCategoryName: text("amazon_category_name"),
  /** Child categories returned by Canopy, so the user can drill down without extra requests. */
  childCategories: jsonb("child_categories").$type<{ id: string; name: string; url: string }[]>(),
  sortOrder: integer("sort_order").notNull().default(0),
  lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    asin: text("asin").notNull(),
    title: text("title").notNull().default(""),
    imageUrl: text("image_url"),
    priceDisplay: text("price_display"),
    priceValue: real("price_value"),
    rating: real("rating"),
    ratingsTotal: integer("ratings_total"),
    rank: integer("rank"),
    /** "canopy" = fetched best seller, "manual" = pasted link. */
    source: text("source").notNull().default("canopy"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("products_category_asin_idx").on(t.categoryId, t.asin)],
);

export type PinStatus = "draft" | "scheduled" | "posting" | "posted" | "failed";

export const pins = pgTable("pins", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull().default("pinterest"),
  imageUrl: text("image_url").notNull(),
  destinationLink: text("destination_link").notNull(),
  boardId: text("board_id").notNull(),
  boardName: text("board_name"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  altText: text("alt_text"),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: text("status").$type<PinStatus>().notNull().default("scheduled"),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  externalId: text("external_id"),
  externalUrl: text("external_url"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** OAuth connection per platform (one row per platform; tokens encrypted at rest). */
export const connections = pgTable("connections", {
  platform: text("platform").primaryKey(),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc"),
  accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }),
  refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }),
  scopes: text("scopes"),
  accountName: text("account_name"),
  /** Which API host the token was issued for ("sandbox" | "production"). */
  environment: text("environment").notNull().default("sandbox"),
  boards: jsonb("boards").$type<{ id: string; name: string; privacy?: string }[]>(),
  boardsFetchedAt: timestamp("boards_fetched_at", { withTimezone: true }),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every paid API call we make, so the UI can show monthly usage. */
export const apiUsage = pgTable("api_usage", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  endpoint: text("endpoint").notNull(),
  ok: boolean("ok").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Settings = typeof settings.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Pin = typeof pins.$inferSelect;
export type Connection = typeof connections.$inferSelect;
