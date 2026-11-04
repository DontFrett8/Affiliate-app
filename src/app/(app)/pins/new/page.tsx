import { asc } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { getSettings, buildDefaultDescription, buildDefaultTitle } from "@/lib/settings";
import { suggestSlot } from "@/actions/pins";
import { toLocalInputValue } from "@/lib/schedule";
import { getPublisher } from "@/lib/platforms";
import { PinForm } from "@/components/PinForm";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create pin" };

export default async function NewPinPage({ searchParams }: PageProps<"/pins/new">) {
  const sp = await searchParams;
  const s = await getSettings();
  const cats = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder));
  const categoryId = Number(sp.category) || null;
  const cat = cats.find((c) => c.id === categoryId) ?? null;
  const publisher = getPublisher("pinterest");
  const connected = await publisher.isConnected();
  const boards = connected ? await publisher.listBoards().catch(() => []) : [];
  const slot = await suggestSlot();

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="New pin" title={<>Create a <span className="italic text-accent">pin</span></>} />
      <PinForm
        mode="create"
        initial={{
          imageUrl: "",
          destinationLink: s.defaultDestinationLink,
          boardId: s.defaultBoardId ?? "",
          title: buildDefaultTitle(cat?.name),
          description: buildDefaultDescription({ categoryName: cat?.name, hashtags: s.defaultHashtags, disclosure: s.disclosureText }),
          altText: "",
          scheduledAt: toLocalInputValue(slot, s.timezone),
          categoryId,
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
