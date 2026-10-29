export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card card">
        <div className="brand" style={{ padding: 0, marginBottom: 16 }}>TeamSpace</div>
        {children}
      </div>
    </div>
  );
}
