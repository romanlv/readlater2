import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExtensionInstallDialog } from './extension-install-dialog';

export function ExtensionDownloadLink() {
  const [showDialog, setShowDialog] = useState(false);
  const extensionUrl = `${import.meta.env.BASE_URL}readlater-extension.zip`;

  return (
    <>
      <div className="hidden md:block">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs h-8"
          onClick={() => setShowDialog(true)}
          title="Download Chrome Extension"
        >
          <Download className="w-3 h-3" />
          Extension
        </Button>
      </div>

      <ExtensionInstallDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        downloadUrl={extensionUrl}
      />
    </>
  );
}
