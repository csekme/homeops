// Vitest global setup: jest-dom matchers (toBeInTheDocument, …) + automatic cleanup.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
