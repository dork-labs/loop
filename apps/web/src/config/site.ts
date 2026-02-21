/**
 * Site-wide configuration for the Loop marketing site.
 *
 * Centralizes branding, URLs, and metadata so changes propagate
 * to layout metadata, JSON-LD, sitemap, robots, and OG images.
 */
export const siteConfig = {
  name: 'Loop',
  tagline: 'The Autonomous Improvement Engine',
  description:
    'Loop collects signals from your stack, organizes them into prioritized issues, and dispatches hydrated prompts to AI agents. Open-source feedback loop infrastructure for AI-powered development.',
  url: 'https://www.looped.me',
  contactEmail: 'hey@looped.me',
  github: 'https://github.com/dork-labs/loop',
  npm: 'https://www.npmjs.com/package/looped',
  ogImage: '/og-image.png',

  /**
   * Disable the cookie consent banner across the entire site.
   * Set to `true` to hide the banner completely.
   */
  disableCookieBanner: true,
} as const

export type SiteConfig = typeof siteConfig
