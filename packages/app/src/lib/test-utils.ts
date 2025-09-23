import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Test wrapper with QueryClient for components that use React Query
export function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}