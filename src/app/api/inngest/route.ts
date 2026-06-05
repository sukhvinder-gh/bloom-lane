// src/app/api/inngest/route.ts
import { serve } from 'inngest/next'
import { inngest, inngestFunctions } from '@/lib/inngest/functions'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
})
