import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-28 pt-4">{children}</main>
      <BottomNav />
    </>
  );
}
