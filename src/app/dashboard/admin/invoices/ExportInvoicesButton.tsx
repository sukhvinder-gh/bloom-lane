// Plain server-renderable link — no client interactivity needed, so this
// stays a server component and just takes the already-parsed date range
// as props instead of reaching for useSearchParams (which would force a
// Suspense boundary for no real benefit here).
export function ExportInvoicesButton({ from, to }: { from?: string; to?: string }) {
  const qs = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString()

  return (
    <a
      href={`/api/admin/invoices/export${qs ? `?${qs}` : ''}`}
      className="btn btn-forest btn-sm"
    >
      ⬇ Export CSV
    </a>
  )
}
