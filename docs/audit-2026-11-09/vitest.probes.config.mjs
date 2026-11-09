import base from '../../vitest.config.ts';

const config = {
  ...base,
  test: {
    ...base.test,
    environment: 'jsdom',
    include: ['docs/audit-2026-11-09/editor-probes.test.jsx'],
  },
};

export default config;
