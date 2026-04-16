import { collectCategorySubtreeIds } from './product.service';

describe('collectCategorySubtreeIds', () => {
  it('returns null when root missing', () => {
    expect(
      collectCategorySubtreeIds([{ id: 1n, parentId: null }], 99n),
    ).toBeNull();
  });

  it('includes root and all descendants (DFS order from stack pop)', () => {
    const rows = [
      { id: 1n, parentId: null },
      { id: 2n, parentId: 1n },
      { id: 3n, parentId: 1n },
      { id: 4n, parentId: 2n },
    ];
    const got = collectCategorySubtreeIds(rows, 1n);
    expect(got).not.toBeNull();
    expect(new Set(got)).toEqual(new Set([1n, 2n, 3n, 4n]));
    expect(got!.length).toBe(4);
  });
});
