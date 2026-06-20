import Link from 'next/link'
import { isMarketOpen } from '@/lib/utils/timezone'
import NewsletterSection from './_components/NewsletterSection'

const BG  = '#EDE9DF'
const FG  = '#1B3A2D'
const INK = '#898C62'   // muted olive for illustrations

export default function HomePage() {
  const marketOpen = isMarketOpen()

  return (
    <main style={{ fontFamily: 'var(--font-body)', background: BG }}>

      {/* ══════════════════════════════════════════
          HERO — full viewport, cream
      ══════════════════════════════════════════ */}
      <section style={{
        height: '100vh',
        minHeight: '680px',
        background: BG,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* ── LEFT botanical ── */}
        <svg
          aria-hidden="true"
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '42%', pointerEvents: 'none', zIndex: 0 }}
          viewBox="0 0 520 900"
          preserveAspectRatio="xMinYMid meet"
          fill="none"
        >
          {/* ── Umbel stem A (far left) ── */}
          <path d="M28 900 Q32 760 25 620 Q18 490 28 350 Q35 240 22 110 Q16 55 18 10" stroke={INK} strokeWidth="1.2"/>
          {/* Umbel A top branches */}
          {[[-60,18,-42,-15],[-35,8,-18,-28],[-8,2,8,-38],[18,10,36,-25],[50,22,68,-12]].map(([bx,by,tx,ty],i)=>(
            <g key={i}>
              <line x1={18+bx} y1={10+by} x2={18+tx} y2={10+ty} stroke={INK} strokeWidth="0.85"/>
              {[-8,0,8].map((dx,j)=>(
                <g key={j}>
                  <line x1={18+tx} y1={10+ty} x2={18+tx+dx} y2={10+ty-14} stroke={INK} strokeWidth="0.65"/>
                  <circle cx={18+tx+dx} cy={10+ty-16} r="2.2" stroke={INK} strokeWidth="0.65" fill="none"/>
                </g>
              ))}
            </g>
          ))}

          {/* ── Umbel stem B ── */}
          <path d="M88 900 Q90 780 82 650 Q75 520 85 390 Q92 278 80 155 Q74 85 78 20" stroke={INK} strokeWidth="1.1"/>
          {[[-52,20,-38,-18],[-25,10,-12,-32],[5,2,18,-40],[42,12,58,-22],[72,25,85,-8]].map(([bx,by,tx,ty],i)=>(
            <g key={i}>
              <line x1={78+bx} y1={20+by} x2={78+tx} y2={20+ty} stroke={INK} strokeWidth="0.8"/>
              {[-7,0,7].map((dx,j)=>(
                <g key={j}>
                  <line x1={78+tx} y1={20+ty} x2={78+tx+dx} y2={20+ty-13} stroke={INK} strokeWidth="0.6"/>
                  <circle cx={78+tx+dx} cy={20+ty-15} r="2" stroke={INK} strokeWidth="0.6" fill="none"/>
                </g>
              ))}
            </g>
          ))}

          {/* ── Umbel stem C (short, between A and B) ── */}
          <path d="M52 900 Q55 810 50 700 Q44 600 52 490 Q58 400 50 300" stroke={INK} strokeWidth="0.9"/>
          {[[-22,5,-8,-22],[10,2,24,-28]].map(([bx,by,tx,ty],i)=>(
            <g key={i}>
              <line x1={50+bx} y1={300+by} x2={50+tx} y2={300+ty} stroke={INK} strokeWidth="0.7"/>
              {[-6,0,6].map((dx,j)=>(
                <g key={j}>
                  <line x1={50+tx} y1={300+ty} x2={50+tx+dx} y2={300+ty-12} stroke={INK} strokeWidth="0.55"/>
                  <circle cx={50+tx+dx} cy={300+ty-14} r="1.8" stroke={INK} strokeWidth="0.55" fill="none"/>
                </g>
              ))}
            </g>
          ))}

          {/* ── Leaf on stem B (mid-height) ── */}
          <path d="M82 395 Q58 372 46 342 Q38 318 52 305 Q68 296 86 316 Q100 338 96 370Z" stroke={INK} strokeWidth="1.0" fill="none"/>
          <path d="M82 395 Q60 358 52 326 Q44 306 55 302" stroke={INK} strokeWidth="0.6"/>

          {/* ── SUNFLOWER — center ~(268, 355) ── */}
          {Array.from({length:18}).map((_,i)=>{
            const a=(i/18)*2*Math.PI, cx=268+42*Math.cos(a), cy=355+42*Math.sin(a)
            return <ellipse key={i} cx={cx} cy={cy} rx="16" ry="7" transform={`rotate(${(i/18)*360+90} ${cx} ${cy})`} stroke={INK} strokeWidth="1.0" fill="none"/>
          })}
          <circle cx="268" cy="355" r="28" stroke={INK} strokeWidth="1.2" fill="none"/>
          <circle cx="268" cy="355" r="20" stroke={INK} strokeWidth="0.85" fill="none"/>
          {Array.from({length:7}).map((_,row)=>Array.from({length:7}).map((_,col)=>{
            const x=250+col*8, y=337+row*8
            if(Math.sqrt((x-268)**2+(y-355)**2)<19) return <circle key={`${row}-${col}`} cx={x} cy={y} r="1.3" fill={INK} opacity="0.55"/>
            return null
          }))}
          {/* Stem */}
          <path d="M268 383 Q262 450 255 520 Q248 590 242 660 Q236 730 230 810 Q225 860 218 900" stroke={INK} strokeWidth="1.4"/>
          {/* Leaf off stem (upper) */}
          <path d="M258 490 Q222 470 202 442 Q188 420 202 405 Q218 393 240 408 Q258 426 260 462Z" stroke={INK} strokeWidth="1.1" fill="none"/>
          <path d="M258 490 Q230 460 210 432 Q196 412 205 405" stroke={INK} strokeWidth="0.62"/>
          {/* Leaf off stem (lower) */}
          <path d="M250 570 Q284 550 302 522 Q314 500 304 484 Q290 472 272 485 Q258 500 255 535Z" stroke={INK} strokeWidth="1.1" fill="none"/>
          <path d="M250 570 Q284 548 302 522 Q312 502 305 486" stroke={INK} strokeWidth="0.62"/>

          {/* ── LARGE PUMPKIN LEAVES ── */}
          {/* Leaf 1 — sweeping left */}
          <path d="M190 725 Q145 692 105 655 Q68 618 55 578 Q44 542 64 520 Q88 500 115 522 Q142 545 152 585 Q162 625 160 672 Q172 698 190 725Z" stroke={INK} strokeWidth="1.2" fill="none"/>
          <path d="M190 725 Q148 675 98 618 Q64 580 58 548" stroke={INK} strokeWidth="0.68"/>
          <path d="M115 522 Q135 562 142 608 Q148 648 155 685" stroke={INK} strokeWidth="0.58"/>
          <path d="M72 590 Q100 578 128 590" stroke={INK} strokeWidth="0.52"/>
          {/* Leaf 2 — sweeping right */}
          <path d="M192 725 Q222 680 252 642 Q278 606 290 568 Q298 535 282 510 Q264 488 240 500 Q218 514 212 552 Q206 588 200 632 Q194 672 192 725Z" stroke={INK} strokeWidth="1.2" fill="none"/>
          <path d="M192 725 Q224 668 252 628 Q276 595 285 558 Q292 528 278 508" stroke={INK} strokeWidth="0.68"/>
          <path d="M240 500 Q228 540 228 578" stroke={INK} strokeWidth="0.58"/>
          {/* Leaf 3 (behind) */}
          <path d="M186 715 Q162 686 152 650 Q144 616 158 584 Q174 554 200 560 Q224 568 226 598 Q228 632 212 668Z" stroke={INK} strokeWidth="0.95" fill="none"/>

          {/* ── PUMPKIN — center ~(118, 845) ── */}
          <path d="M58 848 Q52 805 64 782 Q80 758 112 754 Q144 750 162 774 Q176 798 172 844 Q160 876 115 882 Q68 880 58 848Z" stroke={INK} strokeWidth="1.3" fill="none"/>
          {/* Ribs */}
          <path d="M114 755 Q120 818 116 882" stroke={INK} strokeWidth="0.88"/>
          <path d="M90 760 Q92 822 90 878" stroke={INK} strokeWidth="0.82"/>
          <path d="M140 760 Q142 822 140 878" stroke={INK} strokeWidth="0.82"/>
          <path d="M68 782 Q65 835 70 866" stroke={INK} strokeWidth="0.72"/>
          <path d="M160 778 Q164 832 160 862" stroke={INK} strokeWidth="0.72"/>
          {/* Stem & tendrils */}
          <path d="M115 754 Q112 734 115 720 Q118 710 115 700" stroke={INK} strokeWidth="1.15"/>
          <path d="M115 718 Q132 706 148 695 Q160 685 158 672" stroke={INK} strokeWidth="0.88"/>
          <path d="M114 720 Q98 708 84 696 Q72 685 74 670" stroke={INK} strokeWidth="0.8"/>
        </svg>

        {/* ── RIGHT botanical ── */}
        <svg
          aria-hidden="true"
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '38%', pointerEvents: 'none', zIndex: 0 }}
          viewBox="0 0 480 900"
          preserveAspectRatio="xMaxYMid meet"
          fill="none"
        >
          {/* ── TALL STEM (far right) ── */}
          <path d="M458 900 Q456 800 460 700 Q464 590 458 470 Q452 355 458 235 Q462 145 455 65" stroke={INK} strokeWidth="1.3"/>

          {/* ── DANDELION SEED HEAD at top ── */}
          {Array.from({length:26}).map((_,i)=>{
            const a=(i/26)*2*Math.PI
            return (
              <g key={i}>
                <line x1={455+5*Math.cos(a)} y1={65+5*Math.sin(a)} x2={455+58*Math.cos(a)} y2={65+58*Math.sin(a)} stroke={INK} strokeWidth="0.6"/>
                <circle cx={455+62*Math.cos(a)} cy={65+62*Math.sin(a)} r="2.2" stroke={INK} strokeWidth="0.6" fill="none"/>
              </g>
            )
          })}
          <circle cx="455" cy="65" r="5" stroke={INK} strokeWidth="1.0" fill="none"/>

          {/* Small leaf off tall stem */}
          <path d="M458 460 Q432 440 418 412 Q408 390 422 376 Q438 364 455 382 Q466 400 462 432Z" stroke={INK} strokeWidth="1.0" fill="none"/>
          <path d="M458 460 Q434 434 422 405 Q412 384 424 375" stroke={INK} strokeWidth="0.62"/>

          {/* ── LARGE COMPOUND/LOBED LEAVES (centre of right side) ── */}
          {/* Main leaf petiole */}
          <path d="M355 705 Q342 645 335 585 Q328 530 336 478 Q342 438 332 392" stroke={INK} strokeWidth="1.2"/>
          {/* Leaf 1 (left-going) */}
          <path d="M336 478 Q294 454 265 422 Q242 396 246 366 Q252 338 278 334 Q308 332 330 356 Q350 382 350 422 Q350 455 336 478Z" stroke={INK} strokeWidth="1.2" fill="none"/>
          <path d="M336 478 Q300 446 272 412 Q250 385 252 362" stroke={INK} strokeWidth="0.68"/>
          <path d="M282 342 Q272 328 265 312" stroke={INK} strokeWidth="0.58"/>
          <path d="M308 338 Q300 322 300 306" stroke={INK} strokeWidth="0.58"/>
          <path d="M330 350 Q328 335 332 320" stroke={INK} strokeWidth="0.58"/>
          {/* Leaf 2 (right-going) */}
          <path d="M340 545 Q375 522 398 494 Q415 470 408 446 Q398 424 376 424 Q354 424 343 448 Q333 472 336 510Z" stroke={INK} strokeWidth="1.2" fill="none"/>
          <path d="M340 545 Q376 518 400 490 Q415 468 408 446" stroke={INK} strokeWidth="0.68"/>
          {/* Leaf 3 (behind, left) */}
          <path d="M342 610 Q305 590 282 560 Q262 532 268 504 Q276 478 302 476 Q330 476 342 504 Q352 530 350 572Z" stroke={INK} strokeWidth="1.1" fill="none"/>
          <path d="M342 610 Q308 582 286 552 Q266 524 272 502" stroke={INK} strokeWidth="0.62"/>

          {/* ── GARLIC BULB ~(230, 820) ── */}
          <path d="M184 822 Q180 788 192 768 Q207 750 232 746 Q258 744 272 764 Q285 784 280 820 Q272 852 232 858 Q190 852 184 822Z" stroke={INK} strokeWidth="1.2" fill="none"/>
          <path d="M208 754 Q204 804 210 850" stroke={INK} strokeWidth="0.88"/>
          <path d="M232 748 Q232 804 232 858" stroke={INK} strokeWidth="0.88"/>
          <path d="M258 755 Q262 804 256 850" stroke={INK} strokeWidth="0.88"/>
          <path d="M188 798 Q208 784 232 782 Q256 782 274 798" stroke={INK} strokeWidth="0.78"/>
          {/* Garlic scapes */}
          <path d="M232 746 Q230 725 232 710" stroke={INK} strokeWidth="1.0"/>
          <path d="M215 748 Q208 728 206 712" stroke={INK} strokeWidth="0.88"/>
          <path d="M250 748 Q256 728 258 712" stroke={INK} strokeWidth="0.88"/>

          {/* ── ROUND ROOT VEGETABLE ~(370, 838) ── */}
          <circle cx="372" cy="833" r="36" stroke={INK} strokeWidth="1.2" fill="none"/>
          {/* Root */}
          <path d="M372 869 Q370 888 372 900" stroke={INK} strokeWidth="1.0"/>
          <path d="M358 882 Q350 892 344 898" stroke={INK} strokeWidth="0.7"/>
          <path d="M372 892 Q364 898 360 902" stroke={INK} strokeWidth="0.7"/>
          <path d="M381 888 Q388 895 392 900" stroke={INK} strokeWidth="0.7"/>
          {/* Leafy tops */}
          <path d="M350 800 Q336 770 330 748 Q324 730 334 720 Q344 712 356 722 Q366 734 364 756 Q362 778 356 798Z" stroke={INK} strokeWidth="1.1" fill="none"/>
          <path d="M370 798 Q368 762 370 738 Q373 724 382 722 Q392 722 394 736 Q397 750 392 772 Q387 794 376 806Z" stroke={INK} strokeWidth="1.1" fill="none"/>
          <path d="M392 806 Q406 776 412 754 Q416 738 408 728 Q398 720 390 730" stroke={INK} strokeWidth="1.0" fill="none"/>

          {/* ── Secondary thin stem (left of main) ── */}
          <path d="M112 900 Q116 820 110 740 Q104 658 112 570 Q120 490 110 400" stroke={INK} strokeWidth="0.95"/>
          {/* Leaf off secondary */}
          <path d="M112 570 Q140 550 155 526 Q164 508 154 494 Q140 482 124 494 Q112 508 112 542Z" stroke={INK} strokeWidth="0.95" fill="none"/>
          <path d="M110 648 Q86 628 76 604 Q68 582 80 568 Q94 558 110 572 Q122 588 118 618Z" stroke={INK} strokeWidth="0.9" fill="none"/>
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
              fontWeight: 700,
              color: FG,
              lineHeight: 1.05,
              letterSpacing: '-0.015em',
              marginBottom: '0.3rem',
            }}>The Green Guild</p>
            <p style={{
              fontSize: '0.6rem', fontWeight: 700,
              letterSpacing: '0.22em', color: INK,
              textTransform: 'uppercase',
            }}>Direct. Local. Seasonal.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', paddingTop: '0.25rem' }}>
            <Link href="#how-it-works" style={{ color: FG, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, padding: '0.5rem 1rem' }}>
              How the Green Guild works
            </Link>
            <Link href="/marketplace" style={{
              color: FG, textDecoration: 'none',
              fontSize: '0.9rem', fontWeight: 600,
              padding: '0.5rem 1.625rem',
              border: `1.5px solid ${FG}`,
              borderRadius: '4px',
            }}>
              Shop Now
            </Link>
            <Link href="/auth/login" style={{ color: FG, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, padding: '0.5rem 1rem' }}>
              Login
            </Link>
          </div>
        </nav>

        {/* ── HERO TEXT ── */}
        <div style={{
          flex: 1,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          position: 'relative', zIndex: 10,
          paddingTop: 'clamp(3.5rem, 16vh, 8rem)',
          padding: 'clamp(3.5rem, 16vh, 8rem) 2rem 0',
          textAlign: 'center',
        }}>
          <div style={{ maxWidth: '680px' }}>
            {marketOpen && (
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: INK, letterSpacing: '0.04em', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4CAF50', display: 'inline-block', animation: 'pulse-dot 1.8s ease infinite' }} />
                Market open · Order now
              </p>
            )}

            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.8rem, 5.5vw, 4.75rem)',
              fontWeight: 400,
              color: FG,
              lineHeight: 1.1,
              letterSpacing: '-0.025em',
              marginBottom: '1.75rem',
            }}>
              Fresh harvest,<br />
              direct from the growers
            </h1>

            {/* ── Leaf divider ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ height: '1px', width: '72px', background: INK, opacity: 0.5 }} />
              <svg width="28" height="24" viewBox="0 0 28 24" fill="none">
                <path d="M14 3 Q10 12 6 22 Q10 12 14 3 Q18 12 22 22 Q18 12 14 3Z" stroke={INK} strokeWidth="1.1" fill="none"/>
                <line x1="14" y1="3" x2="14" y2="22" stroke={INK} strokeWidth="0.75"/>
                <path d="M8 13 Q11 11 14 13 Q17 11 20 13" stroke={INK} strokeWidth="0.7"/>
              </svg>
              <div style={{ height: '1px', width: '72px', background: INK, opacity: 0.5 }} />
            </div>

            <p style={{
              fontSize: 'clamp(1rem, 1.8vw, 1.2rem)',
              color: '#6B7252',
              lineHeight: 1.7,
              fontStyle: 'italic',
              letterSpacing: '0.005em',
            }}>
              From farm to buyer, made simple.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          COMMUNITY — dark forest green
      ══════════════════════════════════════════ */}
      <section style={{ background: FG }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '4rem 2rem 0', textAlign: 'center' }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.4rem, 2.5vw, 1.875rem)',
            fontWeight: 500,
            color: BG,
            letterSpacing: '-0.01em',
            marginBottom: '3.5rem',
          }}>
            Join the Green Guild community
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, position: 'relative' }}>
            {[
              {
                icon: (
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="19" stroke={BG} strokeWidth="1.1"/>
                    <path d="M20 28 Q16 22 16 18 Q16 13 20 11 Q24 13 24 18 Q24 22 20 28Z" stroke={BG} strokeWidth="1.1" fill="none"/>
                    <path d="M20 11 Q15 9 13 12" stroke={BG} strokeWidth="1" fill="none"/>
                    <path d="M20 11 Q16 8 14 10" stroke={BG} strokeWidth="0.8" fill="none"/>
                  </svg>
                ),
                title: 'Register – Grower',
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
                title: 'Register – Hub',
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
                title: 'Register – Buyer (free)',
                desc: 'Source fresh produce\ndirect from growers.',
                href: '/auth/register',
              },
            ].map((item, idx) => (
              <div key={idx} style={{ position: 'relative' }}>
                {/* divider between columns */}
                {idx > 0 && (
                  <div style={{ position: 'absolute', left: 0, top: '10%', height: '80%', width: '1px', background: 'rgba(237,233,223,0.15)' }} />
                )}
                <Link href={item.href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0 2.5rem 3.5rem', gap: '1.25rem' }}>
                  <div style={{ width: '62px', height: '62px', borderRadius: '50%', border: `1.5px solid rgba(237,233,223,0.4)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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

          {/* Thin divider */}
          <div style={{ height: '1px', background: 'rgba(237,233,223,0.15)', margin: '0 0 0' }} />
        </div>

        {/* Footer links */}
        <div style={{ padding: '1.25rem 2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <Link href="/privacy" style={{ color: 'rgba(237,233,223,0.45)', textDecoration: 'none', fontSize: '0.82rem' }}>Privacy Policy</Link>
          <span style={{ color: 'rgba(237,233,223,0.25)', fontSize: '0.82rem' }}>|</span>
          <Link href="/terms" style={{ color: 'rgba(237,233,223,0.45)', textDecoration: 'none', fontSize: '0.82rem' }}>Terms &amp; Conditions</Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECONDARY SECTIONS
      ══════════════════════════════════════════ */}

      {/* How it works */}
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
              <div key={s.num} style={{ background: 'white', borderRadius: '16px', padding: '2.25rem', border: `1px solid rgba(27,58,45,0.08)`, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-12px', right: '1.5rem', fontFamily: 'var(--font-display)', fontSize: '5rem', fontWeight: 900, color: `rgba(27,58,45,0.04)`, lineHeight: 1, userSelect: 'none' }}>{s.num}</div>
                <div style={{ width: '3rem', height: '3rem', borderRadius: '12px', background: `rgba(137,140,98,0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.375rem', marginBottom: '1.5rem' }}>{s.icon}</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: FG, marginBottom: '0.75rem' }}>{s.title}</h3>
                <p style={{ fontSize: '0.9rem', color: '#6B7252', lineHeight: 1.8 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Buyer types */}
      <section style={{ background: 'white', padding: '5rem 2rem', borderTop: `1px solid rgba(27,58,45,0.08)` }}>
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
            <div style={{ background: `rgba(137,140,98,0.1)`, borderRadius: '16px', padding: '2.75rem', border: `1px solid rgba(137,140,98,0.2)` }}>
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

      {/* Grower CTA */}
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
