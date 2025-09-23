import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ServiceWorkerInfo {
  isSupported: boolean;
  registration: ServiceWorkerRegistration | null;
  isRegistered: boolean;
  isActivated: boolean;
  scope: string;
  scriptURL: string;
  state: string;
  isInstalled: boolean;
}

export function DebugPanel() {
  const [swInfo, setSwInfo] = useState<ServiceWorkerInfo>({
    isSupported: false,
    registration: null,
    isRegistered: false,
    isActivated: false,
    scope: '',
    scriptURL: '',
    state: '',
    isInstalled: false,
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    updateServiceWorkerInfo();
    
    // Listen to service worker messages (logs)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_LOG') {
          const logMessage = event.data.args.join(' ');
          setLogs(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${logMessage}`]);
        }
      });
    }

    // Update SW info periodically
    const interval = setInterval(updateServiceWorkerInfo, 2000);
    return () => clearInterval(interval);
  }, []);

  const updateServiceWorkerInfo = async () => {
    if (!('serviceWorker' in navigator)) {
      setSwInfo(prev => ({ ...prev, isSupported: false }));
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
      
      setSwInfo({
        isSupported: true,
        registration: registration || null,
        isRegistered: !!registration,
        isActivated: !!(registration?.active),
        scope: registration?.scope || '',
        scriptURL: registration?.active?.scriptURL || '',
        state: registration?.active?.state || 'not active',
        isInstalled,
      });
    } catch (error) {
      console.error('Failed to get SW registration:', error);
    }
  };

  const testShareTarget = async () => {
    try {
      const response = await fetch(import.meta.env.BASE_PATH, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: new FormData(),
      });
      
      setLogs(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: Test POST response: ${response.status} ${response.statusText}`]);
    } catch (error) {
      setLogs(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: Test POST error: ${error}`]);
    }
  };

  const clearLogs = () => setLogs([]);

  if (!isVisible) {
    return (
      <Button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 bg-purple-600 hover:bg-purple-700"
        size="sm"
      >
        Debug SW
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Service Worker Debug Panel</CardTitle>
            <Button onClick={() => setIsVisible(false)} variant="outline" size="sm">
              Close
            </Button>
          </div>
          <CardDescription>Debug share target functionality</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 overflow-y-auto">
          {/* Service Worker Status */}
          <div className="space-y-2">
            <h4 className="font-medium">Service Worker Status</h4>
            <div className="text-sm space-y-1 font-mono">
              <div>Supported: <span className={swInfo.isSupported ? 'text-green-600' : 'text-red-600'}>{swInfo.isSupported ? 'Yes' : 'No'}</span></div>
              <div>Registered: <span className={swInfo.isRegistered ? 'text-green-600' : 'text-red-600'}>{swInfo.isRegistered ? 'Yes' : 'No'}</span></div>
              <div>Activated: <span className={swInfo.isActivated ? 'text-green-600' : 'text-red-600'}>{swInfo.isActivated ? 'Yes' : 'No'}</span></div>
              <div>State: <span className="text-blue-600">{swInfo.state}</span></div>
              {swInfo.scope && <div>Scope: <span className="text-gray-600">{swInfo.scope}</span></div>}
              {swInfo.scriptURL && <div>Script: <span className="text-gray-600">{swInfo.scriptURL}</span></div>}
            </div>
          </div>

          {/* PWA Installation Status */}
          <div className="space-y-2">
            <h4 className="font-medium">PWA Status</h4>
            <div className="text-sm font-mono">
              <div>Installed: <span className={swInfo.isInstalled ? 'text-green-600' : 'text-orange-600'}>{swInfo.isInstalled ? 'Yes (standalone)' : 'No (browser)'}</span></div>
            </div>
          </div>

          {/* Test Buttons */}
          <div className="space-y-2">
            <h4 className="font-medium">Test Actions</h4>
            <div className="flex gap-2">
              <Button onClick={testShareTarget} size="sm">Test POST Request</Button>
              <Button onClick={updateServiceWorkerInfo} size="sm" variant="outline">Refresh Status</Button>
              <Button onClick={clearLogs} size="sm" variant="outline">Clear Logs</Button>
            </div>
          </div>

          {/* Service Worker Logs */}
          <div className="space-y-2">
            <h4 className="font-medium">Service Worker Logs ({logs.length})</h4>
            <div className="bg-gray-100 p-2 rounded text-xs font-mono max-h-40 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-gray-500">No logs yet...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">{log}</div>
                ))
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-2 text-sm">
            <h4 className="font-medium">Testing Instructions</h4>
            <div className="text-gray-600 space-y-1">
              <div>1. Wait for Service Worker to be "activated"</div>
              <div>2. Use curl to test: <code className="bg-gray-100 px-1">curl -X POST http://localhost:3030/ -F "title=Test" -F "url=https://example.com"</code></div>
              <div>3. For mobile: Install PWA first (Add to Home Screen)</div>
              <div>4. Share content from another app to this PWA</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}