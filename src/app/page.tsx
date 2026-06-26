import Link from 'next/link'
import { isMarketOpen } from '@/lib/utils/timezone'
import { getSessionUserFromCookie } from '@/lib/supabase/server'
import NewsletterSection from './_components/NewsletterSection'
import styles from './page.module.css'

const FG  = '#173a33'
const INK = '#898C62'

const P  = (d: string, w = 1.1) => <path d={d} stroke={INK} strokeWidth={w} fill="none"/>
const PF = (d: string, w = 0.7) => <path d={d} stroke={INK} strokeWidth={w} fill="none"/>
const n2 = (v: number) => Math.round(v * 100) / 100

export default async function HomePage() {
  const marketOpen = isMarketOpen()
  const sessionUser = await getSessionUserFromCookie()

  function Umbel({ cx, cy, primary, dr = 1.8 }: {
    cx: number; cy: number;
    primary: [number, number][];
    dr?: number;
  }) {
    return (
      <>
        {primary.map(([dx, dy], pi) => {
          const ex = n2(cx + dx), ey = n2(cy + dy)
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
                const sx = n2(ex+sdx), sy = n2(ey+sdy)
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
                        <line x1={sx} y1={sy} x2={n2(sx+tdx)} y2={n2(sy+tdy)} stroke={INK} strokeWidth="0.55"/>
                        <circle cx={n2(sx+tdx)} cy={n2(sy+tdy)} r={dr} stroke={INK} strokeWidth="0.55" fill="none"/>
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

  function Daisy({ cx, cy, n=13, r=18, petalL=30 }: {
    cx: number; cy: number; n?: number; r?: number; petalL?: number
  }) {
    return (
      <>
        {Array.from({length: n}).map((_, i) => {
          const angle = (i / n) * 2 * Math.PI - Math.PI / 2
          const cos = Math.cos(angle), sin = Math.sin(angle)
          const pw = 5.5
          const px = -sin * pw, py = cos * pw
          const bx = cx + r * cos, by = cy + r * sin
          const tx = cx + (r + petalL) * cos, ty = cy + (r + petalL) * sin
          const mx = (bx + tx) / 2, my = (by + ty) / 2
          return (
            <path key={i}
              d={`M${n2(bx+px*0.4)} ${n2(by+py*0.4)} Q${n2(mx+px)} ${n2(my+py)} ${n2(tx)} ${n2(ty)} Q${n2(mx-px)} ${n2(my-py)} ${n2(bx-px*0.4)} ${n2(by-py*0.4)}Z`}
              stroke={INK} strokeWidth="0.85" fill="none"
            />
          )
        })}
        <circle cx={cx} cy={cy} r={r} stroke={INK} strokeWidth="1.1" fill={INK} fillOpacity="0.07"/>
        {[r*0.28, r*0.62].map((rd, ri) => (
          <g key={ri}>
            {Array.from({length: Math.max(1, Math.round(2*Math.PI*rd/3.5))}).map((_,i,arr) => {
              const a = (i / arr.length) * 2 * Math.PI
              return <circle key={i} cx={n2(cx+rd*Math.cos(a))} cy={n2(cy+rd*Math.sin(a))} r="1.0" fill={INK} opacity="0.6"/>
            })}
          </g>
        ))}
        <circle cx={cx} cy={cy} r="1.5" fill={INK} opacity="0.8"/>
      </>
    )
  }

  function Dandelion({ cx, cy, spokes=26, r=55 }: {
    cx: number; cy: number; spokes?: number; r?: number
  }) {
    return (
      <>
        {Array.from({length: spokes}).map((_, i) => {
          const deg = n2(i * (360 / spokes))
          return (
            <g key={i} transform={`translate(${cx},${cy}) rotate(${deg})`}>
              <line x1="0" y1="-5" x2="0" y2={`-${r}`} stroke={INK} strokeWidth="0.6"/>
              <ellipse cx="0" cy={-(r+4)} rx="2.5" ry="1.5"
                stroke={INK} strokeWidth="0.6" fill="none"/>
            </g>
          )
        })}
        <circle cx={cx} cy={cy} r="5" stroke={INK} strokeWidth="1.0" fill="none"/>
        <circle cx={cx} cy={cy} r="2" fill={INK} opacity="0.5"/>
      </>
    )
  }

  return (
    <main className={styles.page}>
      <div className={styles.firstScreen}>

      {/* ── HEADER ── */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.logo}>The Green Guild</h1>
          <p className={styles.tagline}>DIRECT. LOCAL. SEASONAL.</p>
        </div>
        <nav className={styles.nav}>
          <Link href="#how-it-works">How the Green Guild works</Link>
          <Link href="/marketplace" className={styles.shopBtn} style={{ textDecoration: 'none', display: 'inline-block' }}>
            Shop Now
          </Link>
          {sessionUser
            ? <Link href="/dashboard">My Account</Link>
            : <Link href="/auth/login">Sign in</Link>
          }
        </nav>
      </header>

      {/* ── HERO ── */}
      <section className={styles.hero}>

        {/* LEFT botanical */}
        <div aria-hidden="true" className={styles.botanicalLeft}>
          <img src="/botanicals-leaves.png" alt="" style={{
            position:'absolute', left:0, top:'-5%',
            height:'110%', width:'auto',
            mixBlendMode:'multiply',
            filter:'sepia(0.2) hue-rotate(55deg) saturate(0.55) brightness(0.95)',
            opacity: 0.55,
          }}/>
        </div>
        {/* LEFT botanical — pumpkin + daisy + wildflowers — HIDDEN */}
        <svg aria-hidden="true" fill="none" style={{display:'none'}}
          viewBox="0 0 520 900" preserveAspectRatio="xMinYMid meet">

          {/* ── Tall stem A — umbellate top (far left) ── */}
          {P('M42 900 Q38 760 42 620 Q46 490 40 358 Q34 240 46 130', 1.1)}
          <Umbel cx={46} cy={130} dr={3.2} primary={[
            [-36,-28],[-14,-46],[10,-56],[34,-52],[56,-40],[74,-22],
          ]}/>
          {P('M40 420 Q14 400 4 372 Q-2 350 12 340 Q28 332 40 352 Q48 372 44 404Z')}
          {PF('M40 420 Q16 394 6 364 Q0 344 14 340')}

          {/* ── Stem B — secondary umbellate (centre-left) ── */}
          {P('M108 900 Q104 790 108 670 Q112 560 106 450 Q100 356 112 270 Q120 212 118 175', 1.0)}
          <Umbel cx={118} cy={175} dr={2.8} primary={[
            [-42,-22],[-20,-38],[4,-48],[28,-44],[50,-32],[66,-14],
          ]}/>
          {P('M106 500 Q80 480 70 454 Q64 432 76 420 Q92 412 104 430 Q112 450 108 482Z')}
          {PF('M106 500 Q80 474 72 446 Q66 426 78 420')}

          {/* ── MAIN stem to daisy ── */}
          {P('M278 900 Q274 820 278 740 Q282 670 278 600 Q274 540 278 470 Q282 410 284 360', 1.3)}

          {/* ── DAISY — hero flower ── */}
          <Daisy cx={286} cy={316} n={14} r={26} petalL={42}/>

          {/* stem leaf right of daisy */}
          {P('M280 470 Q316 450 330 422 Q340 402 328 388 Q314 376 296 392 Q282 410 278 446Z', 1.05)}
          {PF('M280 470 Q314 442 326 414 Q336 396 326 386')}

          {/* stem leaf left */}
          {P('M276 560 Q240 540 224 512 Q212 490 224 476 Q238 464 256 478 Q268 494 272 528Z', 1.0)}
          {PF('M276 560 Q242 532 226 504 Q214 482 226 476')}

          {/* ── FERN BRANCH left ── */}
          {P('M196 650 Q158 628 128 596 Q104 568 112 542 Q122 520 148 530 Q170 542 178 572 Q190 608 196 642Z', 1.1)}
          {PF('M196 650 Q160 618 132 586 Q108 558 116 540')}
          {PF('M148 530 Q162 558 170 588')}
          {PF('M120 574 Q144 562 160 572')}
          {PF('M112 546 Q124 538 136 542')}
          {PF('M130 562 Q122 548 122 534')}
          {PF('M150 548 Q146 532 148 520')}
          {PF('M168 542 Q168 526 170 512')}

          {/* ── FERN BRANCH right ── */}
          {P('M296 650 Q332 626 350 596 Q364 570 354 546 Q342 526 320 534 Q302 546 298 576 Q294 608 294 640Z', 1.0)}
          {PF('M296 650 Q330 622 348 592 Q360 564 350 544')}
          {PF('M322 534 Q312 558 308 584')}
          {PF('M340 542 Q334 562 330 582')}
          {PF('M354 556 Q352 572 348 586')}

          {/* ── PUMPKIN LEAVES — shifted up ── */}
          {P('M188 644 Q144 618 108 582 Q76 548 82 514 Q90 486 118 494 Q144 504 162 538 Q178 570 188 610 Q192 628 190 642Z', 1.2)}
          {PF('M188 644 Q146 612 112 574 Q80 538 84 512 Q92 488 120 496')}
          {PF('M120 496 Q134 520 140 550')}
          {PF('M86 528 Q108 518 124 532')}
          {PF('M82 558 Q106 550 118 566')}
          {PF('M88 588 Q112 582 122 598')}
          {PF('M104 616 Q126 612 134 628')}

          {P('M234 640 Q272 614 296 580 Q316 548 306 516 Q294 490 268 496 Q246 506 240 538 Q232 572 232 610 Q232 628 234 640Z', 1.2)}
          {PF('M234 640 Q270 608 292 574 Q312 540 302 512 Q290 488 266 496')}
          {PF('M266 496 Q258 520 256 548')}
          {PF('M300 518 Q282 524 274 540')}
          {PF('M306 548 Q288 554 282 572')}
          {PF('M300 578 Q282 584 278 600')}

          {P('M210 634 Q188 602 184 564 Q180 532 196 512 Q214 496 232 512 Q244 530 242 564 Q240 600 216 634Z', 1.0)}
          {PF('M210 634 Q190 596 186 558 Q182 528 198 514 Q216 500 232 516')}
          {PF('M200 516 Q208 538 208 562')}
          {PF('M226 516 Q222 538 220 560')}
          {PF('M186 546 Q204 542 212 556')}
          {PF('M188 578 Q208 574 214 590')}

          {/* ── PUMPKIN — shifted up 100 units ── */}
          {P('M106 698 Q100 660 114 634 Q130 604 164 594 Q196 586 228 598 Q260 612 272 642 Q282 672 276 708 Q264 744 224 754 Q188 758 158 746 Q116 728 106 698Z', 1.4)}
          {PF('M166 594 Q168 674 164 754', 0.9)}
          {PF('M192 588 Q192 674 192 756', 0.9)}
          {PF('M216 588 Q216 674 216 756', 0.95)}
          {PF('M240 594 Q242 674 240 752', 0.85)}
          {PF('M260 606 Q262 672 260 742', 0.8)}
          {PF('M118 670 Q120 708 122 732', 0.75)}
          {PF('M112 706 Q162 692 218 694 Q262 694 276 704', 0.7)}
          {PF('M106 730 Q158 720 216 722 Q260 720 276 730', 0.65)}
          {P('M198 588 Q196 570 198 556 Q200 544 196 532', 1.2)}
          {PF('M197 558 Q216 546 228 532 Q238 520 236 508')}
          {PF('M198 560 Q180 548 170 534 Q160 520 164 506')}
        </svg>

        {/* HERO TEXT */}
        <div className={styles.heroContent}>
          <h2>
            Fresh harvest,<br />
            direct from the growers
          </h2>

          <div className={styles.divider}>
            <span />
            <svg width="32" height="26" viewBox="0 0 32 26" fill="none">
              <line x1="16" y1="2" x2="16" y2="24" stroke={INK} strokeWidth="0.9"/>
              <path d="M16 8 Q9 5 7 2 Q9 0 14 5 Q16 8 16 8Z" stroke={INK} strokeWidth="0.9" fill="none"/>
              <path d="M16 13 Q23 10 25 7 Q23 5 18 10 Q16 13 16 13Z" stroke={INK} strokeWidth="0.9" fill="none"/>
            </svg>
            <span />
          </div>

          <p className={styles.heroSubtitle}>From farm to buyer, made simple.</p>

          {marketOpen && (
            <p suppressHydrationWarning style={{ fontSize: '0.85rem', fontWeight: 600, color: INK, letterSpacing: '0.05em', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4CAF50', display: 'inline-block' }} />
              Market open · Order now
            </p>
          )}
        </div>

        {/* RIGHT botanical */}
        <div aria-hidden="true" className={styles.botanicalRight}>
          <img src="/botanicals.png" alt="" style={{
            position:'absolute', right:0, top:'-5%',
            height:'110%', width:'auto',
            mixBlendMode:'multiply',
            filter:'sepia(0.2) hue-rotate(55deg) saturate(0.55) brightness(0.95)',
            opacity: 0.55,
          }}/>
        </div>
        {/* RIGHT botanical — HIDDEN */}
        <svg aria-hidden="true" fill="none" style={{display:'none'}}
          viewBox="0 0 480 900" preserveAspectRatio="xMaxYMid meet">

          {/* ── DANDELION — far right ── */}
          {P('M430 900 Q426 720 430 540 Q434 380 430 250 Q426 162 430 126', 1.1)}
          <Dandelion cx={430} cy={104} spokes={28} r={72}/>

          {/* ── CENTRAL STEM ── */}
          {P('M166 602 Q162 540 166 478 Q170 418 166 358', 1.1)}

          {/* ── LEAF PAIR 1 — upper (y≈240-360) ── */}
          {P('M164 354 Q132 334 104 306 Q80 280 82 256 Q86 236 108 234 Q132 234 148 258 Q160 284 164 320 Q164 338 164 354Z', 1.1)}
          {PF('M164 354 Q134 328 108 300 Q82 272 84 256 Q88 238 110 236')}
          {PF('M110 236 Q118 256 120 282')}
          {PF('M86 260 Q106 256 114 272')}
          {PF('M88 288 Q108 286 114 302')}
          {PF('M100 322 Q120 320 120 338')}
          {P('M170 350 Q202 330 226 302 Q248 276 244 252 Q240 232 220 230 Q198 230 184 254 Q172 280 168 318 Q166 336 166 350Z', 1.1)}
          {PF('M170 350 Q200 328 224 300 Q246 274 242 252 Q238 234 220 232')}
          {PF('M220 232 Q210 252 208 278')}
          {PF('M240 256 Q228 264 222 280')}
          {PF('M238 286 Q226 292 222 308')}

          {/* ── LEAF PAIR 2 — mid (y≈330-460) ── */}
          {P('M162 456 Q128 434 100 406 Q74 380 76 356 Q80 334 104 334 Q130 336 144 362 Q156 388 160 424 Q162 440 162 456Z', 1.05)}
          {PF('M162 456 Q130 428 104 400 Q76 370 78 354 Q82 336 106 336')}
          {PF('M106 336 Q114 356 114 382')}
          {PF('M80 360 Q100 356 108 372')}
          {PF('M82 388 Q104 386 108 402')}
          {PF('M96 420 Q116 420 118 438')}
          {P('M172 452 Q206 430 228 402 Q250 376 246 352 Q242 330 222 328 Q200 326 186 352 Q174 378 170 416 Q168 436 168 452Z', 1.0)}
          {PF('M172 452 Q204 428 226 400 Q248 374 244 352 Q240 332 222 330')}
          {PF('M222 330 Q212 352 208 378')}
          {PF('M242 356 Q228 364 222 380')}
          {PF('M240 384 Q228 390 224 408')}

          {/* ── LEAF PAIR 3 — lower (y≈420-544) ── */}
          {P('M160 540 Q122 516 94 488 Q68 460 72 436 Q78 414 104 416 Q130 420 144 448 Q156 476 160 510 Q162 528 162 540Z', 0.95)}
          {PF('M160 540 Q124 510 98 480 Q70 450 74 434 Q80 416 106 418')}
          {PF('M106 418 Q114 440 114 466')}
          {PF('M76 442 Q96 438 104 454')}
          {PF('M78 468 Q100 466 102 484')}
          {P('M174 536 Q210 512 232 482 Q254 454 250 430 Q246 408 224 406 Q202 404 188 432 Q176 460 174 496 Q172 518 172 536Z', 0.95)}
          {PF('M174 536 Q208 510 230 480 Q252 452 248 430 Q244 410 224 408')}
          {PF('M224 408 Q214 432 212 458')}
          {PF('M246 434 Q232 442 226 460')}

          {/* ── GARLIC — bottom left (cy=664, clearly visible) ── */}
          <path d="M80 672 Q76 634 98 606 Q122 574 162 568 Q202 570 224 600 Q244 628 240 674 Q232 714 198 726 Q170 736 142 728 Q106 720 88 696 Q78 684 80 672Z" stroke={INK} strokeWidth="2.2" fill={INK} fillOpacity="0.07"/>
          {PF('M102 576 Q98 650 102 726', 1.3)}
          {PF('M130 570 Q126 650 128 728', 1.5)}
          {PF('M162 568 Q162 650 162 730', 1.7)}
          {PF('M192 570 Q194 650 192 728', 1.5)}
          {PF('M216 580 Q218 650 216 724', 1.2)}
          {PF('M84 634 Q122 618 162 616 Q202 618 236 632', 1.1)}
          {PF('M82 698 Q122 686 162 684 Q202 686 236 698', 0.9)}
          {/* Neck */}
          {P('M148 568 Q146 544 148 526 Q150 512 146 498', 1.0)}
          {P('M174 568 Q174 544 172 528 Q170 514 174 500', 0.95)}
          {/* Scape curling up-right */}
          {P('M162 498 Q170 472 188 448 Q208 424 230 416 Q250 410 258 424 Q264 438 254 450', 1.1)}
          <circle cx="254" cy="448" r="3" stroke={INK} strokeWidth="0.9" fill="none"/>
          {/* Roots */}
          {PF('M100 724 Q94 736 92 746')}
          {PF('M130 728 Q126 740 124 750')}
          {PF('M162 730 Q160 742 158 752')}
          {PF('M194 728 Q198 740 200 750')}
          {PF('M216 724 Q222 734 226 744')}

          {/* ── BEET — bottom right (cy=658, clearly visible) ── */}
          <circle cx="348" cy="658" r="74" stroke={INK} strokeWidth="1.9" fill={INK} fillOpacity="0.05"/>
          {PF('M276 644 Q312 628 348 626 Q384 628 420 644', 1.0)}
          {PF('M274 668 Q312 654 348 652 Q384 654 422 668', 0.85)}
          {PF('M278 692 Q312 680 348 678 Q384 680 418 692', 0.7)}
          {/* Taproot */}
          {P('M348 732 Q346 744 348 756', 1.0)}
          {PF('M332 744 Q324 754 320 764')}
          {PF('M358 750 Q366 760 372 770')}
          {/* Beet leaf stems */}
          {P('M358 584 Q368 548 366 512 Q364 482 350 460 Q338 442 326 430', 0.95)}
          {P('M326 430 Q350 410 354 384 Q358 360 342 348 Q326 338 314 358 Q306 380 312 412Z', 0.9)}
          {PF('M326 430 Q348 408 352 382 Q356 360 340 350')}
          {P('M334 586 Q314 548 310 512 Q306 480 316 458 Q328 438 340 426', 0.9)}
          {P('M340 426 Q316 406 308 380 Q300 358 318 348 Q336 340 348 360 Q354 382 348 414Z', 0.85)}
          {PF('M340 426 Q318 404 310 378 Q302 358 320 350')}
        </svg>
      </section>

      {/* ── COMMUNITY ── */}
      <section className={styles.community}>
        <h3>Join the Green Guild community</h3>

        <div className={styles.cards}>

          {/* Grower */}
          <Link href="/auth/register?role=farmer" className={styles.card} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className={styles.icon}>
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <line x1="22" y1="38" x2="22" y2="18" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M22 18 Q14 11 8 14 Q11 21 18 23 Q20 23 22 22" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 18 Q30 11 36 14 Q33 21 26 23 Q24 23 22 22" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 27 Q14 20 8 23 Q11 30 18 32 Q20 32 22 31" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 27 Q30 20 36 23 Q33 30 26 32 Q24 32 22 31" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h4>Register – Grower</h4>
              <p>Join our network of trusted growers.</p>
            </div>
          </Link>

          {/* Hub */}
          <Link href="/auth/register?role=coordinator" className={styles.card} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className={styles.icon}>
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <path d="M6 20 L22 8 L38 20" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="9" y="20" width="26" height="16" stroke="white" strokeWidth="1.4"/>
                <path d="M18 36 L18 28 Q18 24 22 24 Q26 24 26 28 L26 36" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
                <line x1="13" y1="24" x2="16" y2="24" stroke="white" strokeWidth="1.1" strokeLinecap="round"/>
                <line x1="13" y1="28" x2="16" y2="28" stroke="white" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h4>Register – Hub</h4>
              <p>Become a hub and connect your region.</p>
            </div>
          </Link>

          {/* Buyer */}
          <Link href="/auth/register" className={styles.card} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className={styles.icon}>
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <path d="M8 18 L36 18 L32 34 L12 34 Z" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 18 Q14 10 22 10 Q30 10 30 18" stroke="white" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                <line x1="17" y1="22" x2="16" y2="32" stroke="white" strokeWidth="1.1" strokeLinecap="round"/>
                <line x1="22" y1="22" x2="22" y2="32" stroke="white" strokeWidth="1.1" strokeLinecap="round"/>
                <line x1="27" y1="22" x2="28" y2="32" stroke="white" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h4>Register – Buyer (free)</h4>
              <p>Source fresh produce direct from growers.</p>
            </div>
          </Link>

        </div>

        <div className={styles.footerLinks}>
          <Link href="/privacy">Privacy Policy</Link>
          <span style={{ color: 'rgba(255,255,255,0.35)' }}>|</span>
          <Link href="/terms">Terms &amp; Conditions</Link>
        </div>
      </section>
      </div>{/* /firstScreen */}

      {/* ════════════════════════════════
          HOW IT WORKS
      ════════════════════════════════ */}
      <section id="how-it-works" style={{ padding: '6rem 2rem', background: '#F5F1E9' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: INK, marginBottom: '0.75rem' }}>How it works</p>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(1.6rem, 3vw, 2.25rem)', fontWeight: 600, color: FG, letterSpacing: '-0.02em' }}>
              From field to buyer in 3 steps
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {[
              { num: '01', icon: '🌱', title: 'Growers list weekly', desc: 'Australian growers list fresh produce every Sunday to Tuesday. Flowers, herbs, vegetables, and more.' },
              { num: '02', icon: '🛒', title: 'Order on Wednesday', desc: "Buyers browse and order during the Wednesday market window. See who grew it and what you're paying." },
              { num: '03', icon: '🚚', title: 'Delivered fresh', desc: 'Growers harvest to order and dispatch direct. Hub pickup or home delivery anywhere in the zone.' },
            ].map(s => (
              <div key={s.num} style={{ background: 'white', borderRadius: '16px', padding: '2.25rem', border: '1px solid rgba(23,58,51,0.08)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-12px', right: '1.5rem', fontFamily: 'Georgia, serif', fontSize: '5rem', fontWeight: 900, color: 'rgba(23,58,51,0.04)', lineHeight: 1, userSelect: 'none' }}>{s.num}</div>
                <div style={{ width: '3rem', height: '3rem', borderRadius: '12px', background: 'rgba(137,140,98,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.375rem', marginBottom: '1.5rem' }}>{s.icon}</div>
                <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '1.1rem', fontWeight: 600, color: FG, marginBottom: '0.75rem' }}>{s.title}</h3>
                <p style={{ fontSize: '0.9rem', color: '#6B7252', lineHeight: 1.8 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <NewsletterSection />
    </main>
  )
}
