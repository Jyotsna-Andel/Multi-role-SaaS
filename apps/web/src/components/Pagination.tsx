import Link from 'next/link';

interface Props {
  basePath: string;
  params: Record<string, string | undefined>;
  meta: { page: number; totalPages: number; total: number; limit: number };
}

/** Prev/next links that preserve the current filters in the URL. */
export function Pagination({ basePath, params, meta }: Props) {
  const href = (page: number) => {
    const qs = new URLSearchParams(Object.entries({ ...params, page: String(page) }).filter(([, v]) => v) as [string, string][]);
    return `${basePath}?${qs}`;
  };
  const from = meta.total ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div className="pagination">
      <span className="muted small">
        {from}–{to} of {meta.total}
      </span>
      <div className="row">
        {meta.page > 1 ? <Link className="btn btn-sm" href={href(meta.page - 1)}>← Previous</Link> : <span className="btn btn-sm" aria-disabled style={{ opacity: 0.5 }}>← Previous</span>}
        <span className="small muted">Page {meta.page} / {meta.totalPages}</span>
        {meta.page < meta.totalPages ? <Link className="btn btn-sm" href={href(meta.page + 1)}>Next →</Link> : <span className="btn btn-sm" aria-disabled style={{ opacity: 0.5 }}>Next →</span>}
      </div>
    </div>
  );
}
