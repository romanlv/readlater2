import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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

export function SettingsPage() {
  const { settings, updateSettings } = useSettings();

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
        </div>
      </div>
    </div>
  );
}
