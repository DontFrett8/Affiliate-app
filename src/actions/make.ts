"use server";

import { revalidatePath } from "next/cache";
import { sendSetupSamples } from "@/lib/platforms/make";

export async function sendMakeSamples() {
  const r = await sendSetupSamples();
  revalidatePath("/settings");
  return r;
}
