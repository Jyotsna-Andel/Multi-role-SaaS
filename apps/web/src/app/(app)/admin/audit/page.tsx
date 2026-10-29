import type { Metadata } from 'next';
import { AuditLogView } from './AuditLogView';

export const metadata: Metadata = { title: 'Audit log' };

export default function AuditPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
          <div className="muted">Append-only record of security and data events in your organization.</div>
        </div>
      </div>
      <AuditLogView />
    </>
  );
}
