import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface ExtensionInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  downloadUrl: string;
}

export function ExtensionInstallDialog({ open, onOpenChange, downloadUrl }: ExtensionInstallDialogProps) {
  const handleDownload = () => {
    // Trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'readlater-extension.crx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Install ReadLater Chrome Extension</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Follow these steps to install the extension in Chrome
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                1
              </div>
              <div>
                <p className="font-medium">Download the extension</p>
                <p className="text-sm text-muted-foreground">
                  Click the download button below to get the extension CRX file
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                2
              </div>
              <div>
                <p className="font-medium">Open Chrome Extensions</p>
                <p className="text-sm text-muted-foreground">
                  Go to <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">chrome://extensions</code> in your Chrome browser
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                3
              </div>
              <div>
                <p className="font-medium">Enable Developer Mode</p>
                <p className="text-sm text-muted-foreground">
                  Toggle the "Developer mode" switch in the top-right corner
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                4
              </div>
              <div>
                <p className="font-medium">Install the extension</p>
                <p className="text-sm text-muted-foreground">
                  Drag and drop the downloaded CRX file onto the extensions page, or click on the downloaded CRX file
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                5
              </div>
              <div>
                <p className="font-medium">Start saving articles!</p>
                <p className="text-sm text-muted-foreground">
                  The ReadLater extension is now installed and ready to use
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button onClick={handleDownload} className="w-full gap-2">
              <Download className="w-4 h-4" />
              Download Extension
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
