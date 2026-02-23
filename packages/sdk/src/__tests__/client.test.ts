import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoopClient } from '../client';
import { IssuesResource } from '../resources/issues';
import { ProjectsResource } from '../resources/projects';
import { GoalsResource } from '../resources/goals';
import { LabelsResource } from '../resources/labels';
import { SignalsResource } from '../resources/signals';
import { CommentsResource } from '../resources/comments';
import { RelationsResource } from '../resources/relations';
import { TemplatesResource } from '../resources/templates';
import { ReviewsResource } from '../resources/reviews';
import { DashboardResource } from '../resources/dashboard';
import { DispatchResource } from '../resources/dispatch';

// Mock ky so that createHttpClient() doesn't make real network calls
vi.mock('ky', () => {
  const kyInstance = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    extend: vi.fn(),
  };
  return {
    default: {
      create: vi.fn().mockReturnValue(kyInstance),
    },
  };
});

describe('LoopClient', () => {
  let client: LoopClient;

  beforeEach(() => {
    client = new LoopClient({ apiKey: 'loop_test_key' });
  });

  describe('constructor', () => {
    it('creates a LoopClient without throwing', () => {
      expect(() => new LoopClient({ apiKey: 'loop_abc' })).not.toThrow();
    });

    it('accepts a baseURL option', () => {
      expect(
        () =>
          new LoopClient({
            apiKey: 'loop_abc',
            baseURL: 'https://api.example.com',
          })
      ).not.toThrow();
    });

    it('accepts all optional options', () => {
      expect(
        () =>
          new LoopClient({
            apiKey: 'loop_abc',
            baseURL: 'https://api.example.com',
            timeout: 10_000,
            maxRetries: 3,
            retryStatusCodes: [429, 503],
          })
      ).not.toThrow();
    });
  });

  describe('resource properties', () => {
    it('exposes dispatch as DispatchResource', () => {
      expect(client.dispatch).toBeInstanceOf(DispatchResource);
    });

    it('exposes issues as IssuesResource', () => {
      expect(client.issues).toBeInstanceOf(IssuesResource);
    });

    it('exposes projects as ProjectsResource', () => {
      expect(client.projects).toBeInstanceOf(ProjectsResource);
    });

    it('exposes goals as GoalsResource', () => {
      expect(client.goals).toBeInstanceOf(GoalsResource);
    });

    it('exposes labels as LabelsResource', () => {
      expect(client.labels).toBeInstanceOf(LabelsResource);
    });

    it('exposes signals as SignalsResource', () => {
      expect(client.signals).toBeInstanceOf(SignalsResource);
    });

    it('exposes comments as CommentsResource', () => {
      expect(client.comments).toBeInstanceOf(CommentsResource);
    });

    it('exposes relations as RelationsResource', () => {
      expect(client.relations).toBeInstanceOf(RelationsResource);
    });

    it('exposes templates as TemplatesResource', () => {
      expect(client.templates).toBeInstanceOf(TemplatesResource);
    });

    it('exposes reviews as ReviewsResource', () => {
      expect(client.reviews).toBeInstanceOf(ReviewsResource);
    });

    it('exposes dashboard as DashboardResource', () => {
      expect(client.dashboard).toBeInstanceOf(DashboardResource);
    });
  });

  describe('resource stability', () => {
    it('returns the same resource instance on repeated access', () => {
      expect(client.issues).toBe(client.issues);
      expect(client.dispatch).toBe(client.dispatch);
      expect(client.projects).toBe(client.projects);
    });

    it('two clients share no resource instances', () => {
      const clientA = new LoopClient({ apiKey: 'loop_a' });
      const clientB = new LoopClient({ apiKey: 'loop_b' });
      expect(clientA.issues).not.toBe(clientB.issues);
      expect(clientA.dispatch).not.toBe(clientB.dispatch);
    });
  });
});
