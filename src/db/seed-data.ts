/**
 * Default categories and their Amazon Best Sellers pages.
 * Values are the full best-sellers URL Canopy accepts in its `url` parameter,
 * which is the only way to target Amazon sub-categories (e.g. Makeup inside Beauty).
 * Node IDs for the ones marked "verify" are best-effort; the Settings page has a
 * browser that lets you drill into Amazon's own list and correct them.
 */
export const DEFAULT_CATEGORIES: { name: string; amazonCategory: string; note?: string }[] = [
  { name: "Women's Fashion", amazonCategory: "https://www.amazon.com/gp/bestsellers/fashion/7147440011" },
  { name: "Seasonal Fashion", amazonCategory: "https://www.amazon.com/gp/bestsellers/fashion/1040660", note: "Women's Clothing — pick a seasonal child (coats, swim…) in the browser" },
  { name: "Makeup", amazonCategory: "https://www.amazon.com/gp/bestsellers/beauty/11058281" },
  { name: "Skincare", amazonCategory: "https://www.amazon.com/gp/bestsellers/beauty/11060451" },
  { name: "Hair Care", amazonCategory: "https://www.amazon.com/gp/bestsellers/beauty/11057241" },
  { name: "Hair Tools", amazonCategory: "https://www.amazon.com/gp/bestsellers/beauty/11057611", note: "verify" },
  { name: "Hairstyles & Accessories", amazonCategory: "https://www.amazon.com/gp/bestsellers/beauty/11057891", note: "verify" },
  { name: "Holiday Decor", amazonCategory: "https://www.amazon.com/gp/bestsellers/home-garden/3206330011", note: "verify" },
  { name: "Home Decor", amazonCategory: "https://www.amazon.com/gp/bestsellers/home-garden/1063278" },
  { name: "Seasonal Decor", amazonCategory: "https://www.amazon.com/gp/bestsellers/home-garden/3206330011", note: "verify — same page as Holiday Decor until you pick a child" },
  { name: "Kitchen Gadgets", amazonCategory: "https://www.amazon.com/gp/bestsellers/kitchen/289745" },
  { name: "Baking", amazonCategory: "https://www.amazon.com/gp/bestsellers/kitchen/289668" },
];
