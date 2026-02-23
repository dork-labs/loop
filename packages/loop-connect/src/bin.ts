import { parseArgs } from 'node:util';
import { run } from './index.js';

const { values } = parseArgs({
  options: {
    yes: { type: 'boolean', short: 'y', default: false },
    'api-key': { type: 'string' },
    'api-url': { type: 'string', default: 'https://app.looped.me' },
  },
});

run({
  nonInteractive: values.yes ?? false,
  apiKey: values['api-key'],
  apiUrl: values['api-url'] ?? 'https://app.looped.me',
});
