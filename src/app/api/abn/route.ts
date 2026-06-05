// src/app/api/abn/route.ts
// ABN verification endpoint — used during registration

import { NextRequest, NextResponse } from 'next/server'
import { verifyABN, formatABN } from '@/lib/utils/abn'

export async function POST(request: NextRequest) {
  const { abn } = await request.json()

  if (!abn) {
    return NextResponse.json({ error: 'ABN is required' }, { status: 400 })
  }

  const result = await verifyABN(abn)

  return NextResponse.json({
    abn: formatABN(abn),
    ...result,
  })
}
