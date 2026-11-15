'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

// A dropdown menu anchored to a trigger but rendered into document.body via
// a portal, so it can never be clipped by an ancestor's `overflow: hidden`
// or pushed off by a sibling row's accordion expanding — the same problem
// an inline `position: absolute` dropdown inside a scroll/clip container
// runs into (see src/app/dashboard/admin/hubs/HubsContent.tsx's
// ActionsMenu, which this mirrors).
export function PortalActionsMenu({
  trigger,
  children,
  open,
  onOpenChange,
  minWidth = '13rem',
}: {
  trigger: (props: { onClick: () => void; isOpen: boolean }) => React.ReactNode
  children: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  minWidth?: string
}) {
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const anchorRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  function toggle() {
    if (!open && anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + window.scrollY + 4, right: window.innerWidth - r.right })
    }
    onOpenChange(!open)
  }

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) onOpenChange(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open, onOpenChange])

  return (
    <>
      <div ref={anchorRef} style={{ display: 'inline-block' }}>
        {trigger({ onClick: toggle, isOpen: open })}
      </div>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999,
            background: 'white', borderRadius: '0.75rem',
            boxShadow: '0 4px 24px rgba(30,37,53,0.14)',
            border: '1px solid var(--olive)', minWidth, overflow: 'hidden',
          }}
        >
          {children}
        </div>,
        document.body
      )}
    </>
  )
}
