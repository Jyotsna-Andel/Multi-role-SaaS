import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'TeamSpace', template: '%s · TeamSpace' },
  description: 'Multi-tenant, multi-role SaaS demo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
