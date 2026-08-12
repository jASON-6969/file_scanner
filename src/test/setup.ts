import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:test';
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => undefined;
