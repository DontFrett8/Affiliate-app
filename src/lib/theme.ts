import { cookies } from "next/headers";

export type ThemePref = "light" | "dark" | "system";
export const THEME_COOKIE = "pf_theme";

export async function getThemePref(): Promise<ThemePref> {
  const v = (await cookies()).get(THEME_COOKIE)?.value;
  return v === "light" || v === "dark" ? v : "system";
}
