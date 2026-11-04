import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { categories, pins } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { toLocalInputValue } from "@/lib/schedule";
import { getPublisher } from "@/lib/platforms";
import { PinForm } from "@/components/PinForm";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit pin" };

export default async function EditPinPage({ params }: PageProps<"/pins/[id]/edit">) {
  const { id } = await params;
  const [pin] = await db.select().from(pins).where(eq(pins.id, Number(id)));
  if (!pin) notFound();
  const s = await getSettings();
  const cats = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder));
  const publisher = getPublisher("pinterest");
  const connected = await publisher.isConnected();
  const boards = connected ? await publisher.listBoards().catch(() => []) : [];

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Make changes" title={<>Edit <span className="italic text-accent">pin</span></>} />
      {pin.status === "posted" && <p className="notice notice-info">This pin was already posted; edits here won&apos;t change it on Pinterest.</p>}
      <PinForm
        mode="edit"
        initial={{
          id: pin.id,
          imageUrl: pin.imageUrl,
          destinationLink: pin.destinationLink,
          boardId: pin.boardId,
          title: pin.title,
          description: pin.description,
          altText: pin.altText ?? "",
          scheduledAt: toLocalInputValue(pin.scheduledAt, s.timezone),
          categoryId: pin.categoryId,
        }}
        boards={boards}
        categories={cats}
        disclosure={s.disclosureText}
        hashtags={s.defaultHashtags}
        timezone={s.timezone}
        pinterestConnected={connected}
        blobConfigured={!!process.env.BLOB_READ_WRITE_TOKEN}
      />
    </div>
  );
}
