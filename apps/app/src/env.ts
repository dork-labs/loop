import { z } from 'zod';

export const appEnvSchema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:5667'),
  VITE_LOOP_API_KEY: z.string().min(1),
});

const ENV_HINTS: Record<string, string> = {
  VITE_LOOP_API_KEY: [
    'Generate one with:',
    "  node -e \"console.log('loop_' + require('crypto').randomBytes(32).toString('hex'))\"",
    'Or run: npm run setup',
  ].join('\n'),
};

const result = appEnvSchema.safeParse(import.meta.env);

if (!result.success) {
  console.error('\n  Missing or invalid environment variables:\n');
  result.error.issues.forEach((i: z.ZodIssue) =>
    console.error(`  - ${i.path.join('.')}: ${i.message}`)
  );
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && ENV_HINTS[key]) {
      console.error(`\n  Hint for ${key}:\n  ${ENV_HINTS[key]}`);
    }
  }
  console.error('\n  Copy apps/app/.env.example to apps/app/.env\n');
  throw new Error('Invalid environment variables');
}

export const env = result.data;
export type Env = z.infer<typeof appEnvSchema>;
