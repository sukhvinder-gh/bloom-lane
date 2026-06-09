'use client'

export function PrintButton({ label = 'Print / Save as PDF' }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="btn btn-forest btn-sm no-print"
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
    >
      🖨 {label}
    </button>
  )
}
