import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";

type AppLayoutProps = {
  children: React.ReactNode;
};

export default async function AppLayout({ children }: AppLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Link className="brand-mark" href="/player">
            23FPlayer
            <span>live antenna</span>
          </Link>
          <nav className="app-nav" aria-label="Primary navigation">
            <Link href="/player">Player</Link>
            <Link href="/dj">DJ</Link>
            <Link href="/profile">Profile</Link>
          </nav>
        </div>
      </header>
      <div className="app-content">{children}</div>
    </div>
  );
}
