/// <reference types="vitest/globals" />

import { createMockGameContext } from '../../test/test-utils';

describe('createMockGameContext', () => {
  it('includes galaxyJumpTarget and setGalaxyJumpTarget', () => {
    const ctx = createMockGameContext();

    expect(ctx.galaxyJumpTarget).toBeNull();
    expect(typeof ctx.setGalaxyJumpTarget).toBe('function');
  });
});
