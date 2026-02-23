/**
 * Marketing feature layer — public-facing marketing page components and utilities.
 *
 * @module features/marketing
 */

// UI components
export { ContactSection } from './ui/ContactSection';
export { LoopHero } from './ui/LoopHero';
export { LoopValueProps } from './ui/LoopValueProps';
export { MarketingNav } from './ui/MarketingNav';
export { MarketingHeader } from './ui/MarketingHeader';
export { MarketingFooter } from './ui/MarketingFooter';

export { IntegrationsBar } from './ui/IntegrationsBar';
export { HowItWorksFlow } from './ui/HowItWorksFlow';
export { QuickStartSection } from './ui/QuickStartSection';

// Agent integrations
export { AgentGrid } from './ui/AgentGrid';
export { AgentPlatforms } from './ui/AgentPlatforms';
export { AgentSetupSection } from './ui/AgentSetupSection';
export { CodeTabs } from './ui/CodeTabs';
export { CopyCommand } from './ui/CopyCommand';
export { DeeplinkButton } from './ui/DeeplinkButton';
export { AGENTS, MCP_SERVER_CONFIG } from './lib/agents';

// Motion
export { SPRING, VIEWPORT, REVEAL, STAGGER, SCALE_IN, DRAW_PATH } from './lib/motion-variants';

// Types
export type { NavLink } from './ui/MarketingNav';
export type { AgentPlatform } from './lib/agents';
