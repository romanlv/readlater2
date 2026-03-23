import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useSettings } from '@/features/settings/use-settings';

function SettingRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="space-y-0.5 pr-4">
        <Label htmlFor={id} className="text-base font-medium cursor-pointer">
          {label}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

type ConnectionStatus = 'idle' | 'checking' | 'connected' | 'disconnected';

function useBackendStatus(url: string, enabled: boolean) {
  const [status, setStatus] = useState<ConnectionStatus>('idle');

  const check = useCallback(async () => {
    if (!enabled || !url) {
      setStatus('idle');
      return;
    }
    setStatus('checking');
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      setStatus(data.status === 'ok' ? 'connected' : 'disconnected');
    } catch {
      setStatus('disconnected');
    }
  }, [url, enabled]);

  useEffect(() => {
    check();
  }, [check]);

  return { status, check };
}

function ConnectionIndicator({ status, onRetry }: { status: ConnectionStatus; onRetry: () => void }) {
  switch (status) {
    case 'checking':
      return (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking...
        </span>
      );
    case 'connected':
      return (
        <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" /> Connected
        </span>
      );
    case 'disconnected':
      return (
        <button onClick={onRetry} className="flex items-center gap-1.5 text-sm text-destructive hover:underline">
          <XCircle className="h-4 w-4" /> Disconnected — tap to retry
        </button>
      );
    default:
      return null;
  }
}

export function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { status, check } = useBackendStatus(settings.backendUrl, settings.backendEnabled);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="outline" asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Articles
            </Link>
          </Button>
        </div>

        <h1 className="text-2xl font-bold mb-6">Settings</h1>

        <div className="space-y-1">
          <h2 className="text-lg font-semibold">General</h2>
          <p className="text-sm text-muted-foreground">
            Manage your app preferences.
          </p>
        </div>

        <Separator className="my-4" />

        <div>
          <SettingRow
            id="auto-sync"
            label="Auto sync"
            description="Automatically sync with Google Sheets when online."
            checked={settings.autoSync}
            onCheckedChange={(v) => updateSettings({ autoSync: v })}
          />
          <Separator />
          <SettingRow
            id="open-in-preview"
            label="Open articles in preview"
            description="Show articles in an embedded preview instead of opening in a new tab."
            checked={settings.openInPreview}
            onCheckedChange={(v) => updateSettings({ openInPreview: v })}
          />
        </div>

        <div className="space-y-1 mt-8">
          <h2 className="text-lg font-semibold">Backend Server</h2>
          <p className="text-sm text-muted-foreground">
            Optional server for auto-fetching article metadata when adding URLs.
          </p>
        </div>

        <Separator className="my-4" />

        <div>
          <SettingRow
            id="backend-enabled"
            label="Enable backend server"
            description="Use a backend server to automatically extract article metadata."
            checked={settings.backendEnabled}
            onCheckedChange={(v) => updateSettings({ backendEnabled: v })}
          />

          {settings.backendEnabled && (
            <div className="space-y-3 pb-4">
              <Label htmlFor="backend-url" className="text-sm font-medium">Server URL</Label>
              <Input
                id="backend-url"
                value={settings.backendUrl}
                onChange={(e) => updateSettings({ backendUrl: e.target.value })}
                placeholder="http://localhost:4080"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
              />
              <ConnectionIndicator status={status} onRetry={check} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
