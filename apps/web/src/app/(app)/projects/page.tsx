import type { Metadata } from 'next';
import Link from 'next/link';
import { Pagination } from '@/components/Pagination';
import { serverApi } from '@/lib/server-api';
import { PROJECT_STATUSES, type Paginated, type Project } from '@/lib/types';
import { NewProjectButton, RowActions } from './ProjectControls';

export const metadata: Metadata = { title: 'Projects' };

type Search = { page?: string; search?: string; status?: string; sort?: string };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  // Filters live in the URL → shareable, back-button friendly, rendered on the server.
  const filters = { search: sp.search?.trim() || undefined, status: sp.status || undefined, sort: sp.sort || undefined };
  const qs = new URLSearchParams(
    Object.entries({ ...filters, page: sp.page ?? '1', limit: '10' }).filter(([, v]) => v) as [string, string][],
  );
  const result = await serverApi<Paginated<Project>>(`/projects?${qs}`);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <div className="muted">{result.meta.total} projects in your organization</div>
        </div>
        <NewProjectButton />
      </div>

      <div className="card">
        {/* Plain GET form: works without JavaScript and updates the URL. */}
        <form className="row" style={{ marginBottom: 14 }}>
          <input className="input" name="search" placeholder="Search by name…" defaultValue={filters.search} style={{ flex: '1 1 220px' }} />
          <select className="select" name="status" defaultValue={filters.status ?? ''}>
            <option value="">All statuses</option>
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select className="select" name="sort" defaultValue={filters.sort ?? 'newest'}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
          </select>
          <button className="btn">Apply</button>
          {(filters.search || filters.status || filters.sort) && <Link className="btn" href="/projects">Reset</Link>}
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Created by</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    {p.description && <div className="muted small">{p.description}</div>}
                  </td>
                  <td><span className={`badge badge-${p.status}`}>{p.status.replace('_', ' ')}</span></td>
                  <td>{p.createdBy?.name ?? <span className="muted">—</span>}</td>
                  <td className="muted small">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td><RowActions project={p} /></td>
                </tr>
              ))}
              {!result.data.length && (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 32 }}>No projects match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination basePath="/projects" params={filters} meta={result.meta} />
      </div>
    </>
  );
}
