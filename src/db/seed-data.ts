/**
 * Default categories and their Amazon Best Sellers pages.
 * Values are the full best-sellers URL Canopy accepts in its `url` parameter,
 * which is the only way to target Amazon sub-categories (e.g. Makeup inside Beauty).
 * All node IDs were verified against Canopy's categoryInfo on 2026-11-04. The Settings
 * page has a browser that drills Amazon's own tree if you want different sub-categories.
 */
export const DEFAULT_CATEGORIES: { name: string; amazonCategory: string; note?: string }[] = [
  { name: "Women's Fashion", amazonCategory: "https://www.amazon.com/gp/bestsellers/fashion/7147440011" },
  { name: "Seasonal Fashion", amazonCategory: "https://www.amazon.com/gp/bestsellers/fashion/1040660", note: "Women's Clothing — pick a seasonal child (coats, swim…) in the browser" },
  { name: "Makeup", amazonCategory: "https://www.amazon.com/gp/bestsellers/beauty/11058281" },
  { name: "Skincare", amazonCategory: "https://www.amazon.com/gp/bestsellers/beauty/11060451" },
  { name: "Hair Care", amazonCategory: "https://www.amazon.com/gp/bestsellers/beauty/11057241" },
  { name: "Hair Tools", amazonCategory: "https://www.amazon.com/gp/bestsellers/beauty/11058091" },
  { name: "Hairstyles & Accessories", amazonCategory: "https://www.amazon.com/gp/bestsellers/beauty/11057971" },
  { name: "Holiday Decor", amazonCategory: "https://www.amazon.com/gp/bestsellers/home-garden/13679381" }, // Amazon "Seasonal Décor" = holiday dept
  { name: "Home Decor", amazonCategory: "https://www.amazon.com/gp/bestsellers/home-garden/1063278" },
  { name: "Seasonal Decor", amazonCategory: "https://www.amazon.com/gp/bestsellers/home-garden/13679411", note: "Wreaths, Garlands & Swags — swap for another child in Settings" },
  { name: "Kitchen Gadgets", amazonCategory: "https://www.amazon.com/gp/bestsellers/kitchen/289754" },
  { name: "Baking", amazonCategory: "https://www.amazon.com/gp/bestsellers/kitchen/289668" },
];
