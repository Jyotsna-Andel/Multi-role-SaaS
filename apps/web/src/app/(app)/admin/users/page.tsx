import type { Metadata } from 'next';
import { Pagination } from '@/components/Pagination';
import { serverApi } from '@/lib/server-api';
import type { OrgUser, Paginated } from '@/lib/types';
import { InviteButton, UsersTable } from './UsersTable';

export const metadata: Metadata = { title: 'Users' };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const sp = await searchParams;
  const search = sp.search?.trim() || undefined;
  const qs = new URLSearchParams({ page: sp.page ?? '1', limit: '10', ...(search ? { search } : {}) });
  const result = await serverApi<Paginated<OrgUser>>(`/users?${qs}`);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Users</h1>
          <div className="muted">Invite teammates, assign roles, and control access.</div>
        </div>
        <InviteButton />
      </div>
      <div className="card">
        <form className="row" style={{ marginBottom: 14 }}>
          <input className="input" name="search" placeholder="Search name or email…" defaultValue={search} style={{ flex: '1 1 240px' }} />
          <button className="btn">Search</button>
        </form>
        <UsersTable users={result.data} />
        <Pagination basePath="/admin/users" params={{ search }} meta={result.meta} />
      </div>
    </>
  );
}
