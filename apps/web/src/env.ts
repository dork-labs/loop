import { z } from 'zod';

export const webEnvSchema = z.object({
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const result = webEnvSchema.safeParse(process.env);

if (!result.success) {
  console.error('\n  Missing or invalid environment variables:\n');
  result.error.issues.forEach((i) => console.error(`  - ${i.path.join('.')}: ${i.message}`));
  console.error('\n  Copy apps/web/.env.example to apps/web/.env\n');
  process.exit(1);
}

export const env = result.data;
export type Env = z.infer<typeof webEnvSchema>;
