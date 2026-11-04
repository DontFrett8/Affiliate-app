import { BottomNav } from "@/components/BottomNav";
import { ThemeToggle } from "@/components/ThemeControls";
import { getThemePref } from "@/lib/theme";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const pref = await getThemePref();
  return (
    <>
      <main className="relative mx-auto w-full max-w-xl flex-1 px-4 pb-32 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="absolute right-4 top-[max(env(safe-area-inset-top),0.75rem)] z-30">
          <ThemeToggle initial={pref} />
        </div>
        {children}
      </main>
      <BottomNav />
    </>
  );
}
