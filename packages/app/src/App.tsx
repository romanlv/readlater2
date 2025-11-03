import { useEffect } from "react"
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { syncService } from "@/features/articles/sync-service"
import { config } from "@/config"
import PWABadge from "./PWABadge"
import { DebugPanel } from "@/components/debug-panel"
import { BuildInfo } from "@/components/build-info"
import { queryClient } from "@/lib/query-client"
import { ThemeProvider } from "@/hooks/use-theme"
import { AppRouter } from "@/router"

function AppContent() {
  const isDebugMode = new URLSearchParams(window.location.search).get('debug') === 'true';

  useEffect(() => {
    // Configure sync service
    syncService.configure(config);

    // Check for authentication redirect
    if (window.location.hash.includes('access_token')) {
      console.log('🔐 Authentication redirect detected');
      syncService.authenticate().then(result => {
        if (result.success) {
          // Auto-sync after successful authentication
          console.log('🔄 Starting auto-sync after authentication');
          syncService.syncNow();
        }
      });
    } else {
      // Check auth status on normal app load
      syncService.checkAuthStatus();
    }
  }, []);

  return (
    <>
      <AppRouter />
      <PWABadge />
      {isDebugMode && <DebugPanel />}
      <BuildInfo className="fixed bottom-2 left-1/2 transform -translate-x-1/2" />
      <ReactQueryDevtools initialIsOpen={false} />
    </>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="readlater-theme">
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App