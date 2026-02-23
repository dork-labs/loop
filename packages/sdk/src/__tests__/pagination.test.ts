import { describe, it, expect, vi } from 'vitest';
import { PaginatedList, paginate } from '../pagination';

describe('PaginatedList', () => {
  it('stores data and total', () => {
    const list = new PaginatedList([1, 2, 3], 10);
    expect(list.data).toEqual([1, 2, 3]);
    expect(list.total).toBe(10);
  });

  it('hasMore is true when data.length < total', () => {
    expect(new PaginatedList([1, 2], 5).hasMore).toBe(true);
  });

  it('hasMore is false when data.length equals total', () => {
    expect(new PaginatedList([1, 2, 3], 3).hasMore).toBe(false);
  });

  it('hasMore is false for empty results', () => {
    expect(new PaginatedList([], 0).hasMore).toBe(false);
  });
});

describe('paginate', () => {
  it('yields all items across multiple pages', async () => {
    const fetchPage = vi
      .fn<(params: { limit?: number; offset?: number }) => Promise<PaginatedList<string>>>()
      .mockResolvedValueOnce(new PaginatedList(['a', 'b'], 5))
      .mockResolvedValueOnce(new PaginatedList(['c', 'd'], 5))
      .mockResolvedValueOnce(new PaginatedList(['e'], 5));

    const items: string[] = [];
    for await (const item of paginate(fetchPage, {}, 2)) {
      items.push(item);
    }

    expect(items).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenCalledWith({ limit: 2, offset: 0 });
    expect(fetchPage).toHaveBeenCalledWith({ limit: 2, offset: 2 });
    expect(fetchPage).toHaveBeenCalledWith({ limit: 2, offset: 4 });
  });

  it('stops when page returns fewer items than pageSize', async () => {
    const fetchPage = vi
      .fn<(params: { limit?: number; offset?: number }) => Promise<PaginatedList<string>>>()
      .mockResolvedValueOnce(new PaginatedList(['a'], 1));

    const items: string[] = [];
    for await (const item of paginate(fetchPage, {}, 2)) {
      items.push(item);
    }

    expect(items).toEqual(['a']);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('handles empty result', async () => {
    const fetchPage = vi
      .fn<(params: { limit?: number; offset?: number }) => Promise<PaginatedList<string>>>()
      .mockResolvedValueOnce(new PaginatedList([], 0));

    const items: string[] = [];
    for await (const item of paginate<string, { limit?: number; offset?: number }>(
      fetchPage,
      {},
      50
    )) {
      items.push(item);
    }

    expect(items).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('respects initial offset from params', async () => {
    const fetchPage = vi
      .fn<(params: { limit?: number; offset?: number }) => Promise<PaginatedList<string>>>()
      .mockResolvedValueOnce(new PaginatedList(['c'], 3));

    const items: string[] = [];
    for await (const item of paginate(fetchPage, { offset: 2 }, 2)) {
      items.push(item);
    }

    expect(items).toEqual(['c']);
    expect(fetchPage).toHaveBeenCalledWith({ limit: 2, offset: 2 });
  });
});
