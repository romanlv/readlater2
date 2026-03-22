import { useState } from 'react';
import { Download, EllipsisVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExtensionInstallDialog } from './extension-install-dialog';

export function TopBarMenu() {
  const [showExtensionDialog, setShowExtensionDialog] = useState(false);
  const extensionUrl = `${import.meta.env.BASE_URL}readlater-extension.zip`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
            <EllipsisVertical className="h-4 w-4" />
            <span className="sr-only">More options</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => setShowExtensionDialog(true)}
            className="cursor-pointer"
          >
            <Download className="mr-2 h-4 w-4" />
            <span>Download Extension</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ExtensionInstallDialog
        open={showExtensionDialog}
        onOpenChange={setShowExtensionDialog}
        downloadUrl={extensionUrl}
      />
    </>
  );
}
