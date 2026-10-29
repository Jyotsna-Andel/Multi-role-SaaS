import { SessionProvider } from '@/components/SessionProvider';
import { Sidebar } from '@/components/Sidebar';
import { getMe } from '@/lib/server-api';

// Server Component: resolves the user before first paint (redirects to /login on 401).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  return (
    <SessionProvider user={me}>
      <div className="shell">
        <Sidebar />
        <main className="main">{children}</main>
      </div>
    </SessionProvider>
  );
}
