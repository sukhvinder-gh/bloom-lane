import type { ReactNode } from 'react'

const BG = '#f7f5ef'
const BOTANICAL_FILTER = 'sepia(0.2) hue-rotate(55deg) saturate(0.55) brightness(0.95)'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: BG, overflow: 'hidden' }}>

      {/* ── Left botanical PNG ── */}
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '20%', overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <img src="/botanicals-leaves.png" alt="" style={{
          position: 'absolute', left: 0, top: '-5%',
          height: '110%', width: 'auto',
          mixBlendMode: 'multiply',
          filter: BOTANICAL_FILTER,
          opacity: 0.55,
        }} />
      </div>

      {/* ── Right botanical PNG ── */}
      <div aria-hidden="true" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '20%', overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <img src="/botanicals.png" alt="" style={{
          position: 'absolute', right: 0, top: '-5%',
          height: '110%', width: 'auto',
          mixBlendMode: 'multiply',
          filter: BOTANICAL_FILTER,
          opacity: 0.55,
        }} />
      </div>

      {/* Content sits on top */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}
