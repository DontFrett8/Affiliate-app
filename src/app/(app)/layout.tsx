import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-32 pt-[max(env(safe-area-inset-top),0.75rem)]">{children}</main>
      <BottomNav />
    </>
  );
}
