import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

/**
 * Token endpoint for direct browser → Blob uploads (no 4.5 MB function limit).
 * The proxy already requires a login cookie for /api/*, so only you can upload.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        maximumSizeInBytes: 20 * 1024 * 1024,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ app: "pinflow" }),
      }),
      onUploadCompleted: async () => {
        /* nothing to do; the URL is saved with the pin */
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
