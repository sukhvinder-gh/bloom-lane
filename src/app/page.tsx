import Link from 'next/link'
import { isMarketOpen } from '@/lib/utils/timezone'
import NewsletterSection from './_components/NewsletterSection'

const BG  = '#EDE9DF'
const FG  = '#1B3A2D'
const INK = '#898C62'

/* ─── tiny helpers that keep JSX readable ─── */
const P  = (d: string, w = 1.1) => <path d={d} stroke={INK} strokeWidth={w} fill="none"/>
const PF = (d: string, w = 0.7) => <path d={d} stroke={INK} strokeWidth={w} fill="none"/>

export default function HomePage() {
  const marketOpen = isMarketOpen()

  /* ─ umbellate top helper: draws 3-level branching from a stem tip ─ */
  function Umbel({ cx, cy, primary, dr = 1.8 }: {
    cx: number; cy: number;
    primary: [number, number][];
    dr?: number;
  }) {
    return (
      <>
        {primary.map(([dx, dy], pi) => {
          const ex = cx + dx, ey = cy + dy
          const len = Math.sqrt(dx*dx+dy*dy)
          const ux = dx/len, uy = dy/len
          const px = -uy, py = ux
          const secondaries: [number,number][] = [
            [ux*22+px*12, uy*22+py*12],
            [ux*26,        uy*26       ],
            [ux*22-px*12, uy*22-py*12],
          ]
          return (
            <g key={pi}>
              <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={INK} strokeWidth="0.9"/>
              {secondaries.map(([sdx, sdy], si) => {
                const sx = ex+sdx, sy = ey+sdy
                const tertiaries: [number,number][] = [
                  [sdx*0.55+py*8,  sdy*0.55+(-px)*8],
                  [sdx*0.65,        sdy*0.65          ],
                  [sdx*0.55-py*8,  sdy*0.55-(-px)*8],
                ]
                return (
                  <g key={si}>
                    <line x1={ex} y1={ey} x2={sx} y2={sy} stroke={INK} strokeWidth="0.72"/>
                    {tertiaries.map(([tdx, tdy], ti) => (
                      <g key={ti}>
                        <line x1={sx} y1={sy} x2={sx+tdx} y2={sy+tdy} stroke={INK} strokeWidth="0.55"/>
                        <circle cx={sx+tdx} cy={sy+tdy} r={dr} stroke={INK} strokeWidth="0.55" fill="none"/>
                      </g>
                    ))}
                  </g>
                )
              })}
            </g>
          )
        })}
      </>
    )
  }

  /* ─ sunflower petal ring ─ */
  function SunflowerPetals({ cx, cy, n=20, r=30, petalL=36, petalW=9 }: {
    cx: number; cy: number; n?: number; r?: number; petalL?: number; petalW?: number
  }) {
    return (
      <>
        {Array.from({length: n}).map((_, i) => (
          <g key={i} transform={`translate(${cx},${cy}) rotate(${i*(360/n)})`}>
            <path
              d={`M-${petalW/3} -${r} Q-${petalW} -${r+petalL*0.45} 0 -${r+petalL} Q${petalW} -${r+petalL*0.45} ${petalW/3} -${r} Q0 -${r+5} -${petalW/3} -${r}Z`}
              stroke={INK} strokeWidth="1.0" fill="none"
            />
          </g>
        ))}
      </>
    )
  }

  /* ─ dandelion seed head ─ */
  function Dandelion({ cx, cy, spokes=26, r=55 }: {
    cx: number; cy: number; spokes?: number; r?: number
  }) {
    return (
      <>
        {Array.from({length: spokes}).map((_, i) => (
          <g key={i} transform={`translate(${cx},${cy}) rotate(${i*(360/spokes)})`}>
            <line x1="0" y1="-5" x2="0" y2={`-${r}`} stroke={INK} strokeWidth="0.6"/>
            <ellipse cx="0" cy={-(r+4)} rx="2.5" ry="1.5"
              transform={`rotate(${i*(360/spokes)} ${cx} ${cy}) translate(0,0)`}
              stroke={INK} strokeWidth="0.6" fill="none"/>
          </g>
        ))}
        <circle cx={cx} cy={cy} r="5" stroke={INK} strokeWidth="1.0" fill="none"/>
        <circle cx={cx} cy={cy} r="2" fill={INK} opacity="0.5"/>
      </>
    )
  }

  return (
    <main style={{ fontFamily: 'var(--font-body)', background: BG }}>

      {/* ════════════════════════════════
          HERO
      ════════════════════════════════ */}
      <section style={{
        height: '100vh', minHeight: '680px',
        background: BG, position: 'relative',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>

        {/* ── LEFT botanical ── */}
        <svg aria-hidden="true" fill="none"
          style={{ position:'absolute', left:0, top:0, bottom:0, width:'42%', pointerEvents:'none', zIndex:0 }}
          viewBox="0 0 520 900" preserveAspectRatio="xMinYMid meet">

          {/* ── Umbellate stem A ── */}
          {P('M22 900 Q26 760 20 600 Q14 450 22 300 Q32 180 50 85', 1.2)}
          <Umbel cx={50} cy={85} dr={3.5} primary={[
            [-40,-35],[-18,-52],[8,-65],[32,-62],[55,-52],[72,-38],[84,-20],
          ]}/>
          {/* small leaf off stem A */}
          {P('M20 320 Q-5 298 -12 272 Q-14 250 2 244 Q20 240 28 260 Q32 280 24 308Z')}
          {PF('M20 320 Q0 282 -5 258 Q-10 244 2 244')}

          {/* ── Umbellate stem B ── */}
          {P('M75 900 Q80 780 74 640 Q68 508 78 368 Q86 250 85 95', 1.1)}
          <Umbel cx={85} cy={95} dr={3.5} primary={[
            [-58,-25],[-35,-46],[-10,-58],[18,-62],[42,-54],[65,-38],[80,-20],
          ]}/>
          {/* leaf off stem B */}
          {P('M76 400 Q105 378 115 352 Q120 330 108 320 Q92 312 80 330 Q70 350 74 378Z')}
          {PF('M76 400 Q102 370 110 344 Q114 326 104 318')}

          {/* ── Umbellate stem C (minor) ── */}
          {P('M46 900 Q50 820 44 720 Q38 620 46 520 Q52 440 44 360', 0.9)}
          <Umbel cx={44} cy={360} primary={[
            [-30,-20],[-8,-30],[16,-28],[36,-16],
          ]}/>

          {/* ── SUNFLOWER center (248, 275) ── */}
          <SunflowerPetals cx={248} cy={275} n={20} r={28} petalL={34} petalW={10}/>
          {/* inner row of petals (between outer and disk) */}
          <SunflowerPetals cx={248} cy={275} n={20} r={22} petalL={14} petalW={6}/>
          {/* disk rings */}
          <circle cx="248" cy="275" r="21" stroke={INK} strokeWidth="1.2" fill="none"/>
          <circle cx="248" cy="275" r="14" stroke={INK} strokeWidth="0.9" fill="none"/>
          {/* seed dots at r=5, r=9, r=13 */}
          {[5,9,13].map(r => Array.from({length: Math.round(2*Math.PI*r/4.5)}).map((_,i) => {
            const a = (i / Math.round(2*Math.PI*r/4.5)) * 2 * Math.PI
            return <circle key={`${r}-${i}`} cx={248+r*Math.cos(a)} cy={275+r*Math.sin(a)} r="1.2" fill={INK} opacity="0.65"/>
          }))}
          {/* sunflower stem */}
          {P('M248 303 Q242 368 235 440 Q228 510 222 582 Q215 655 208 730 Q203 768 198 800', 1.4)}
          {/* stem leaves */}
          {P('M238 390 Q202 368 185 342 Q172 320 185 306 Q200 295 220 308 Q238 324 238 362Z', 1.1)}
          {PF('M238 390 Q208 362 192 336 Q178 314 186 305')}
          {P('M228 472 Q262 452 278 424 Q288 404 278 388 Q264 376 246 390 Q232 406 228 445Z', 1.1)}
          {PF('M228 472 Q262 450 278 424 Q286 408 276 390')}

          {/* ── LARGE PUMPKIN LEAVES ── */}
          {/* Leaf 1 — sweeping upper-left, 5 lobes */}
          {P('M196 638 Q162 616 128 582 Q96 550 78 515 Q64 485 74 462 Q86 443 108 453 Q132 466 144 495 Q158 528 160 570 Q174 604 196 638Z', 1.2)}
          {PF('M196 638 Q158 602 116 558 Q84 524 76 488')}
          {PF('M108 453 Q128 485 138 522 Q148 558 158 598')}
          {PF('M78 520 Q105 508 130 522')}
          {/* Lobe sub-veins */}
          {PF('M90 478 Q82 462 85 448')}
          {PF('M120 455 Q118 440 122 428')}

          {/* Leaf 2 — sweeping upper-right */}
          {P('M198 638 Q228 598 258 562 Q282 528 294 490 Q302 458 286 434 Q268 412 244 424 Q222 438 216 475 Q210 512 204 558 Q198 596 198 638Z', 1.2)}
          {PF('M198 638 Q230 588 258 548 Q282 518 290 482 Q298 452 282 432')}
          {PF('M244 424 Q232 462 232 500')}
          {PF('M260 432 Q274 450 276 476')}

          {/* Leaf 3 — behind */}
          {P('M192 628 Q168 602 155 568 Q144 536 156 506 Q170 478 196 482 Q220 488 224 516 Q228 548 212 582Z', 0.95)}

          {/* ── PUMPKIN ── */}
          {P('M60 760 Q54 716 66 692 Q80 668 112 664 Q144 662 162 686 Q176 710 172 758 Q162 790 115 796 Q68 792 60 760Z', 1.35)}
          {/* ribs */}
          {PF('M114 664 Q120 730 116 796', 0.9)}
          {PF('M90 668 Q90 732 90 792', 0.85)}
          {PF('M138 668 Q140 732 138 792', 0.85)}
          {PF('M70 700 Q66 756 72 778', 0.75)}
          {PF('M158 700 Q162 756 158 776', 0.75)}
          {/* stem + tendril */}
          {P('M114 664 Q112 642 115 628 Q118 618 114 608', 1.15)}
          {PF('M115 628 Q133 616 148 604 Q160 594 158 580')}
          {PF('M114 630 Q96 618 82 606 Q70 594 73 578')}
        </svg>

        {/* ── RIGHT botanical ── */}
        <svg aria-hidden="true" fill="none"
          style={{ position:'absolute', right:0, top:0, bottom:0, width:'38%', pointerEvents:'none', zIndex:0 }}
          viewBox="0 0 480 900" preserveAspectRatio="xMaxYMid meet">

          {/* ── Tall stem A (far right) ── */}
          {P('M458 900 Q456 800 460 690 Q464 575 458 455 Q452 340 458 220 Q462 135 455 68', 1.3)}

          {/* ── DANDELION A at top ── */}
          <Dandelion cx={455} cy={68} spokes={28} r={58}/>

          {/* ── Tall stem B (second dandelion) ── */}
          {P('M390 900 Q392 820 388 720 Q384 620 390 525 Q396 442 388 365 Q382 308 386 248', 1.1)}

          {/* ── DANDELION B ── */}
          <Dandelion cx={386} cy={248} spokes={22} r={44}/>

          {/* leaf on stem B */}
          {P('M388 520 Q415 500 428 474 Q436 452 425 438 Q410 427 396 442 Q384 460 386 494Z')}
          {PF('M388 520 Q415 498 428 472 Q434 454 422 440')}

          {/* leaf on stem A */}
          {P('M458 460 Q432 440 418 412 Q408 388 422 375 Q438 365 455 382 Q466 400 462 434Z')}
          {PF('M458 460 Q434 434 422 406 Q412 386 424 375')}

          {/* ── LARGE COMPOUND LEAVES (centre-right, similar to pumpkin leaves) ── */}
          {/* main petiole */}
          {P('M350 710 Q338 652 330 592 Q322 535 330 480 Q336 440 326 392', 1.2)}

          {/* Leaf A (going left) */}
          {P('M330 480 Q288 456 258 424 Q234 398 238 368 Q244 340 270 336 Q300 334 322 358 Q342 382 342 424 Q342 458 330 480Z', 1.2)}
          {PF('M330 480 Q294 448 266 414 Q244 386 244 362')}
          {PF('M276 342 Q266 328 260 312')}
          {PF('M302 340 Q296 322 298 306')}
          {PF('M324 356 Q322 338 326 322')}

          {/* Leaf B (going right) */}
          {P('M334 550 Q368 528 390 500 Q406 476 400 452 Q390 430 368 430 Q346 430 335 454 Q325 478 328 516Z', 1.2)}
          {PF('M334 550 Q368 526 392 498 Q406 476 398 452')}
          {PF('M380 432 Q390 450 390 474')}

          {/* Leaf C (behind) */}
          {P('M336 618 Q300 598 276 568 Q256 540 262 510 Q270 484 296 482 Q324 482 336 508 Q346 534 344 576Z', 1.1)}
          {PF('M336 618 Q302 590 278 560 Q260 530 266 506')}

          {/* ── GARLIC BULB — center (172,748), left of compound leaves, below stem leaf ── */}
          <path d="M107 790 Q101 738 120 706 Q144 676 172 670 Q202 667 224 696 Q241 726 237 788 Q225 838 172 846 Q110 840 107 790Z" stroke={INK} strokeWidth="1.8" fill={INK} fillOpacity="0.04"/>
          {PF('M144 678 Q138 764 146 840', 1.3)}
          {PF('M172 670 Q172 760 172 846', 1.3)}
          {PF('M200 678 Q206 764 198 840', 1.3)}
          {PF('M114 760 Q144 740 172 737 Q202 737 228 757', 1.0)}
          {PF('M130 792 Q172 778 214 792', 0.8)}
          {/* garlic scapes */}
          {P('M172 670 Q169 640 172 620', 1.3)}
          {PF('M150 673 Q138 645 136 622')}
          {PF('M194 673 Q206 645 208 622')}
          <circle cx="172" cy="618" r="2.5" stroke={INK} strokeWidth="0.9" fill="none"/>
          <circle cx="136" cy="620" r="2.0" stroke={INK} strokeWidth="0.8" fill="none"/>
          <circle cx="208" cy="620" r="2.0" stroke={INK} strokeWidth="0.8" fill="none"/>

          {/* ── BEET — r=52, center (370,718), subtle fill for visibility ── */}
          <circle cx="370" cy="718" r="52" stroke={INK} strokeWidth="1.8" fill={INK} fillOpacity="0.04"/>
          {PF('M320 708 Q370 692 420 708', 1.0)}
          {PF('M318 730 Q370 714 422 730', 0.9)}
          {PF('M322 750 Q370 738 418 750', 0.75)}
          {/* root */}
          {P('M370 770 Q368 792 370 810', 1.1)}
          {PF('M356 784 Q346 798 340 808')}
          {PF('M370 796 Q362 804 357 810')}
          {PF('M384 790 Q394 800 398 808')}
          {/* leafy tops — 3 leaves connecting at cy-r=666 */}
          {P('M346 670 Q328 640 322 616 Q316 596 328 584 Q342 574 356 586 Q368 600 366 624 Q364 650 352 668Z', 1.2)}
          {PF('M346 670 Q330 638 324 612 Q318 592 330 584')}
          {P('M370 667 Q368 630 370 602 Q372 586 384 584 Q396 584 398 600 Q402 620 396 646 Q390 670 376 680Z', 1.2)}
          {P('M396 674 Q414 640 420 614 Q426 594 416 582 Q404 572 394 582', 1.1)}

          {/* ── Secondary stem (left-side of illustration) ── */}
          {P('M108 900 Q112 818 106 735 Q100 652 108 565 Q116 485 106 398', 0.95)}
          {P('M108 565 Q136 546 150 522 Q158 504 148 490 Q134 480 118 492 Q108 506 108 540Z', 0.95)}
          {P('M106 660 Q80 640 70 614 Q62 590 76 578 Q92 568 108 582 Q120 598 116 630Z', 0.9)}
        </svg>

        {/* ── NAV ── */}
        <nav style={{
          position: 'relative', zIndex: 20, flexShrink: 0,
          padding: '1rem 2.5rem',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.5rem, 2.8vw, 2.1rem)',
              fontWeight: 700, color: FG,
              lineHeight: 1.05, letterSpacing: '-0.015em',
              marginBottom: '0.3rem',
            }}>The Green Guild</p>
            <p style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.22em', color: INK, textTransform: 'uppercase' }}>
              Direct. Local. Seasonal.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', paddingTop: '0.25rem' }}>
            <Link href="#how-it-works" style={{ color: FG, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, padding: '0.5rem 1rem' }}>
              How the Green Guild works
            </Link>
            <Link href="/marketplace" style={{ color: FG, textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, padding: '0.5rem 1.625rem', border: `1.5px solid ${FG}`, borderRadius: '4px' }}>
              Shop Now
            </Link>
            <Link href="/auth/login" style={{ color: FG, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, padding: '0.5rem 1rem' }}>
              Login
            </Link>
          </div>
        </nav>

        {/* ── HERO TEXT ── */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', zIndex: 10,
          padding: '0 2rem 4vh', textAlign: 'center',
        }}>
          <div style={{ maxWidth: '860px' }}>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2rem, 3.8vw, 4rem)',
              fontWeight: 400, color: FG,
              lineHeight: 1.12, letterSpacing: '-0.02em',
              marginBottom: '1rem',
            }}>
              Fresh harvest,<br />
              direct from the growers
            </h1>

            {/* leaf divider */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ height: '1px', width: '68px', background: INK, opacity: 0.45 }} />
              <svg width="32" height="26" viewBox="0 0 32 26" fill="none">
                <line x1="16" y1="2" x2="16" y2="24" stroke={INK} strokeWidth="0.9"/>
                <path d="M16 8 Q9 5 7 2 Q9 0 14 5 Q16 8 16 8Z" stroke={INK} strokeWidth="0.9" fill="none"/>
                <path d="M16 13 Q23 10 25 7 Q23 5 18 10 Q16 13 16 13Z" stroke={INK} strokeWidth="0.9" fill="none"/>
                <path d="M16 4 Q13 1 12 0" stroke={INK} strokeWidth="0.7"/>
                <path d="M16 4 Q19 1 20 0" stroke={INK} strokeWidth="0.7"/>
              </svg>
              <div style={{ height: '1px', width: '68px', background: INK, opacity: 0.45 }} />
            </div>

            <p style={{ fontSize: 'clamp(0.95rem, 1.5vw, 1.15rem)', color: '#6B7252', lineHeight: 1.6, letterSpacing: '0.01em' }}>
              From farm to buyer, made simple.
            </p>

            {marketOpen && (
              <p style={{ fontSize: '0.72rem', fontWeight: 600, color: INK, letterSpacing: '0.05em', marginTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4CAF50', display: 'inline-block' }} />
                Market open · Order now
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════
          COMMUNITY
      ════════════════════════════════ */}
      <section style={{ background: FG }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '4rem 2rem 0', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem, 2.5vw, 1.875rem)', fontWeight: 500, color: BG, letterSpacing: '-0.01em', marginBottom: '3.5rem' }}>
            Join the Green Guild community
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
            {[
              {
                icon: (
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="19" stroke={BG} strokeWidth="1.1"/>
                    <path d="M20 28 Q16 22 16 18 Q16 13 20 11 Q24 13 24 18 Q24 22 20 28Z" stroke={BG} strokeWidth="1.1" fill="none"/>
                    <path d="M20 11 Q15 8 12 10" stroke={BG} strokeWidth="0.9"/>
                    <path d="M20 11 Q25 8 28 10" stroke={BG} strokeWidth="0.9"/>
                    <path d="M17 19 Q20 17 23 19" stroke={BG} strokeWidth="0.8"/>
                  </svg>
                ),
                title: 'Register – Grower',
                desc: 'Join our network\nof trusted growers.',
                href: '/auth/register?role=farmer',
              },
              {
                icon: (
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="19" stroke={BG} strokeWidth="1.1"/>
                    <rect x="11" y="18" width="18" height="12" rx="1" stroke={BG} strokeWidth="1.1"/>
                    <path d="M14 18 V15 Q14 10 20 10 Q26 10 26 15 V18" stroke={BG} strokeWidth="1.1" fill="none"/>
                    <path d="M17 10 Q16 7 16 5" stroke={BG} strokeWidth="0.9"/>
                    <path d="M23 10 Q24 7 24 5" stroke={BG} strokeWidth="0.9"/>
                    <line x1="20" y1="21" x2="20" y2="26" stroke={BG} strokeWidth="1"/>
                  </svg>
                ),
                title: 'Register – Hub',
                desc: 'Become a hub and\nconnect your region.',
                href: '/auth/register?role=coordinator',
              },
              {
                icon: (
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="19" stroke={BG} strokeWidth="1.1"/>
                    <path d="M11 15 H14 L17 26 H25 L28 17 H16" stroke={BG} strokeWidth="1.1" fill="none" strokeLinejoin="round"/>
                    <circle cx="18" cy="28.5" r="1.5" stroke={BG} strokeWidth="1"/>
                    <circle cx="24" cy="28.5" r="1.5" stroke={BG} strokeWidth="1"/>
                    <path d="M14 17 Q18 15 22 17 Q26 15 28 17" stroke={BG} strokeWidth="0.85"/>
                  </svg>
                ),
                title: 'Register – Buyer (free)',
                desc: 'Source fresh produce\ndirect from growers.',
                href: '/auth/register',
              },
            ].map((item, idx) => (
              <div key={idx} style={{ position: 'relative' }}>
                {idx > 0 && <div style={{ position: 'absolute', left: 0, top: '10%', height: '80%', width: '1px', background: 'rgba(237,233,223,0.15)' }} />}
                <Link href={item.href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0 2.5rem 3.5rem', gap: '1.25rem' }}>
                  <div style={{ width: '62px', height: '62px', borderRadius: '50%', border: '1.5px solid rgba(237,233,223,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.0rem', fontWeight: 600, color: BG, marginBottom: '0.5rem' }}>{item.title}</p>
                    <p style={{ fontSize: '0.875rem', color: 'rgba(237,233,223,0.55)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{item.desc}</p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
          <div style={{ height: '1px', background: 'rgba(237,233,223,0.15)' }} />
        </div>
        <div style={{ padding: '1.25rem 2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <Link href="/privacy" style={{ color: 'rgba(237,233,223,0.45)', textDecoration: 'none', fontSize: '0.82rem' }}>Privacy Policy</Link>
          <span style={{ color: 'rgba(237,233,223,0.25)', fontSize: '0.82rem' }}>|</span>
          <Link href="/terms" style={{ color: 'rgba(237,233,223,0.45)', textDecoration: 'none', fontSize: '0.82rem' }}>Terms &amp; Conditions</Link>
        </div>
      </section>

      {/* ════════════════════════════════
          SECONDARY SECTIONS
      ════════════════════════════════ */}
      <section id="how-it-works" style={{ padding: '6rem 2rem', background: '#F5F1E9' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: INK, marginBottom: '0.75rem' }}>How it works</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 3vw, 2.25rem)', fontWeight: 600, color: FG, letterSpacing: '-0.02em' }}>
              From field to buyer in 3 steps
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {[
              { num: '01', icon: '🌱', title: 'Growers list weekly', desc: 'Australian growers list fresh produce every Sunday to Tuesday. Flowers, herbs, vegetables, and more.' },
              { num: '02', icon: '🛒', title: 'Order on Wednesday', desc: "Buyers browse and order during the Wednesday market window. See who grew it and what you're paying." },
              { num: '03', icon: '🚚', title: 'Delivered fresh', desc: 'Growers harvest to order and dispatch direct. Hub pickup or home delivery anywhere in the zone.' },
            ].map(s => (
              <div key={s.num} style={{ background: 'white', borderRadius: '16px', padding: '2.25rem', border: '1px solid rgba(27,58,45,0.08)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-12px', right: '1.5rem', fontFamily: 'var(--font-display)', fontSize: '5rem', fontWeight: 900, color: 'rgba(27,58,45,0.04)', lineHeight: 1, userSelect: 'none' }}>{s.num}</div>
                <div style={{ width: '3rem', height: '3rem', borderRadius: '12px', background: 'rgba(137,140,98,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.375rem', marginBottom: '1.5rem' }}>{s.icon}</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: FG, marginBottom: '0.75rem' }}>{s.title}</h3>
                <p style={{ fontSize: '0.9rem', color: '#6B7252', lineHeight: 1.8 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: 'white', padding: '5rem 2rem', borderTop: '1px solid rgba(27,58,45,0.08)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: INK, marginBottom: '0.75rem' }}>Who shops here</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 3vw, 2.25rem)', fontWeight: 600, color: FG, letterSpacing: '-0.02em' }}>A market for everyone</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            <div style={{ background: FG, borderRadius: '16px', padding: '2.75rem' }}>
              <div style={{ fontSize: '1.875rem', marginBottom: '1.5rem' }}>💼</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600, color: BG, marginBottom: '1rem' }}>Florists & businesses</h3>
              <ul style={{ listStyle: 'none', marginBottom: '2.25rem', padding: 0 }}>
                {['Wholesale pricing ex-GST', 'ABN-verified accounts', 'No minimum spend', 'Weekly fresh stock'].map(f => (
                  <li key={f} style={{ color: 'rgba(237,233,223,0.65)', fontSize: '0.9rem', marginBottom: '0.625rem', paddingLeft: '1.5rem', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: '#a8d5a2', fontWeight: 700 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/register?role=buyer_b2b" style={{ background: BG, color: FG, textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.875rem', display: 'inline-block' }}>Open wholesale account</Link>
            </div>
            <div style={{ background: 'rgba(137,140,98,0.1)', borderRadius: '16px', padding: '2.75rem', border: '1px solid rgba(137,140,98,0.2)' }}>
              <div style={{ fontSize: '1.875rem', marginBottom: '1.5rem' }}>🌸</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600, color: FG, marginBottom: '1rem' }}>Flower & produce lovers</h3>
              <ul style={{ listStyle: 'none', marginBottom: '2.25rem', padding: 0 }}>
                {['Retail pricing inc-GST', 'No subscription needed', 'Know your grower', 'Fresh, seasonal varieties'].map(f => (
                  <li key={f} style={{ color: '#6B7252', fontSize: '0.9rem', marginBottom: '0.625rem', paddingLeft: '1.5rem', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: FG, fontWeight: 700 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/register?role=buyer_b2c" style={{ background: FG, color: BG, textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.875rem', display: 'inline-block' }}>Start shopping</Link>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '6rem 2rem', background: '#F5F1E9' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ background: FG, borderRadius: '20px', padding: '5rem 3rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)', width: '500px', height: '300px', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(168,213,162,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1.25rem' }}>🌻</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)', fontWeight: 600, color: BG, marginBottom: '1rem', letterSpacing: '-0.02em' }}>
                Grow your sales, <em style={{ color: '#a8d5a2', fontStyle: 'italic' }}>not your overheads</em>
              </h2>
              <p style={{ color: 'rgba(237,233,223,0.5)', maxWidth: '480px', margin: '0 auto 2.5rem', lineHeight: 1.8, fontSize: '1rem' }}>
                List your produce for free. Set your own price.<br />
                5% commission only when you sell. Payouts land automatically.
              </p>
              <Link href="/auth/register?role=farmer" style={{ background: '#a8d5a2', color: FG, textDecoration: 'none', padding: '0.925rem 2.25rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.95rem', display: 'inline-block' }}>
                List your produce for free →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <NewsletterSection />
    </main>
  )
}
