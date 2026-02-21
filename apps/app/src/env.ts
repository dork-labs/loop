import { z } from 'zod'

export const appEnvSchema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:5667'),
  VITE_LOOP_API_KEY: z.string().min(1),
})

const result = appEnvSchema.safeParse(import.meta.env)

if (!result.success) {
  console.error('\n  Missing or invalid environment variables:\n')
  result.error.issues.forEach((i: z.ZodIssue) =>
    console.error(`  - ${i.path.join('.')}: ${i.message}`)
  )
  console.error('\n  Copy apps/app/.env.example to apps/app/.env\n')
  throw new Error('Invalid environment variables')
}

export const env = result.data
export type Env = z.infer<typeof appEnvSchema>
