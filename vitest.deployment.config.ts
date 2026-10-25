import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['deployment-tests/**/*.test.ts'], testTimeout: 15000, hookTimeout: 15000 },
});
