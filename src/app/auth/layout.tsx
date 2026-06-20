import type { ReactNode } from 'react'

const BG  = '#EDE9DF'
const INK = '#898C62'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: BG, overflow: 'hidden' }}>

      {/* ── Left botanical stem illustration ── */}
      <svg aria-hidden="true" fill="none"
        style={{ position:'absolute', left:0, top:0, bottom:0, width:'20%', opacity:0.52, pointerEvents:'none', zIndex:0 }}
        viewBox="0 0 180 900" preserveAspectRatio="xMinYMid meet">
        {/* Tall stem A */}
        <path d="M38 900 Q42 750 36 590 Q30 430 38 270 Q44 150 38 55" stroke={INK} strokeWidth="1.0" fill="none"/>
        {/* Umbel head A */}
        {([[-32,-22],[-16,-36],[2,-44],[20,-40],[36,-28],[48,-14]] as [number,number][]).map(([dx,dy],i) => (
          <g key={i}>
            <line x1="38" y1="55" x2={38+dx} y2={55+dy} stroke={INK} strokeWidth="0.82"/>
            {([[ dx*0.55+(-dy/Math.hypot(dx,dy))*10, dy*0.55+(dx/Math.hypot(dx,dy))*10 ],
               [ dx*0.65, dy*0.65 ],
               [ dx*0.55+(dy/Math.hypot(dx,dy))*10, dy*0.55+(-dx/Math.hypot(dx,dy))*10 ]] as [number,number][]).map(([sdx,sdy],si) => (
              <g key={si}>
                <line x1={38+dx} y1={55+dy} x2={38+dx+sdx} y2={55+dy+sdy} stroke={INK} strokeWidth="0.6"/>
                <circle cx={38+dx+sdx} cy={55+dy+sdy} r="3.2" stroke={INK} strokeWidth="0.6" fill="none"/>
              </g>
            ))}
          </g>
        ))}
        {/* Leaf off stem A */}
        <path d="M36 380 Q12 360 4 334 Q0 312 14 306 Q30 302 40 320 Q46 340 40 368Z" stroke={INK} strokeWidth="0.9" fill="none"/>
        <path d="M36 380 Q16 350 8 324 Q4 308 14 306" stroke={INK} strokeWidth="0.55" fill="none"/>
        {/* Tall stem B */}
        <path d="M70 900 Q74 760 68 600 Q62 440 70 280 Q76 165 70 85" stroke={INK} strokeWidth="0.88" fill="none"/>
        {/* Umbel head B (smaller) */}
        {([[-22,-16],[-8,-26],[8,-28],[24,-22],[36,-12]] as [number,number][]).map(([dx,dy],i) => (
          <g key={i}>
            <line x1="70" y1="85" x2={70+dx} y2={85+dy} stroke={INK} strokeWidth="0.7"/>
            <circle cx={70+dx} cy={85+dy} r="2.8" stroke={INK} strokeWidth="0.55" fill="none"/>
          </g>
        ))}
        {/* Leaf pair */}
        <path d="M40 640 Q16 622 8 596 Q2 574 18 568 Q36 564 44 582 Q50 602 46 626Z" stroke={INK} strokeWidth="0.82" fill="none"/>
        <path d="M42 720 Q66 702 72 678 Q76 658 64 654 Q50 650 42 666 Q36 686 38 710Z" stroke={INK} strokeWidth="0.82" fill="none"/>
        {/* Minor stem C */}
        <path d="M52 900 Q56 820 50 720 Q44 620 52 520 Q58 440 52 355" stroke={INK} strokeWidth="0.75" fill="none"/>
        {([[-16,-12],[-4,-18],[10,-16],[22,-8]] as [number,number][]).map(([dx,dy],i) => (
          <g key={i}>
            <line x1="52" y1="355" x2={52+dx} y2={355+dy} stroke={INK} strokeWidth="0.58"/>
            <circle cx={52+dx} cy={355+dy} r="2.2" stroke={INK} strokeWidth="0.5" fill="none"/>
          </g>
        ))}
      </svg>

      {/* ── Right dandelion illustration ── */}
      <svg aria-hidden="true" fill="none"
        style={{ position:'absolute', right:0, top:0, bottom:0, width:'20%', opacity:0.52, pointerEvents:'none', zIndex:0 }}
        viewBox="0 0 180 900" preserveAspectRatio="xMaxYMid meet">
        {/* Tall stem A */}
        <path d="M142 900 Q140 760 144 600 Q148 440 142 278 Q138 158 140 62" stroke={INK} strokeWidth="1.0" fill="none"/>
        {/* Dandelion A */}
        {Array.from({length:26}).map((_,i) => (
          <g key={i} transform={`translate(140,62) rotate(${i*(360/26)})`}>
            <line x1="0" y1="-5" x2="0" y2="-46" stroke={INK} strokeWidth="0.55"/>
            <ellipse cx="0" cy="-50" rx="2.2" ry="1.3" stroke={INK} strokeWidth="0.55" fill="none"/>
          </g>
        ))}
        <circle cx="140" cy="62" r="4.5" stroke={INK} strokeWidth="0.9" fill="none"/>
        <circle cx="140" cy="62" r="1.8" fill={INK} opacity="0.5"/>
        {/* Tall stem B */}
        <path d="M112 900 Q110 800 114 660 Q118 520 112 385 Q108 285 110 220" stroke={INK} strokeWidth="0.88" fill="none"/>
        {/* Dandelion B */}
        {Array.from({length:20}).map((_,i) => (
          <g key={i} transform={`translate(110,220) rotate(${i*(360/20)})`}>
            <line x1="0" y1="-4" x2="0" y2="-36" stroke={INK} strokeWidth="0.5"/>
            <ellipse cx="0" cy="-39" rx="1.9" ry="1.1" stroke={INK} strokeWidth="0.5" fill="none"/>
          </g>
        ))}
        <circle cx="110" cy="220" r="3.8" stroke={INK} strokeWidth="0.8" fill="none"/>
        <circle cx="110" cy="220" r="1.5" fill={INK} opacity="0.5"/>
        {/* Leaf on stem A */}
        <path d="M142 450 Q162 432 170 408 Q176 388 164 382 Q150 378 140 396 Q132 416 136 440Z" stroke={INK} strokeWidth="0.82" fill="none"/>
        <path d="M142 450 Q160 432 168 410 Q174 392 162 384" stroke={INK} strokeWidth="0.5" fill="none"/>
        {/* Leaf on stem B */}
        <path d="M112 560 Q88 542 80 516 Q74 494 90 488 Q108 484 116 502 Q122 522 116 548Z" stroke={INK} strokeWidth="0.82" fill="none"/>
        {/* Bottom leaves */}
        <path d="M114 720 Q138 700 146 676 Q152 656 140 650 Q126 646 116 664 Q108 684 110 708Z" stroke={INK} strokeWidth="0.8" fill="none"/>
        <path d="M140 800 Q116 780 108 754 Q102 732 118 726 Q136 722 144 740 Q150 760 146 782Z" stroke={INK} strokeWidth="0.8" fill="none"/>
      </svg>

      {/* Content sits on top */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}
