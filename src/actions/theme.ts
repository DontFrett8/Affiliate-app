"use server";

import { cookies } from "next/headers";
import { THEME_COOKIE, type ThemePref } from "@/lib/theme";

export async function saveThemePref(pref: ThemePref) {
  const store = await cookies();
  if (pref === "system") store.delete(THEME_COOKIE);
  else store.set(THEME_COOKIE, pref, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
}
