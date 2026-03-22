import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Download, Settings, EllipsisVertical, Upload, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExtensionInstallDialog } from './extension-install-dialog';
import { ImportDialog } from '@/features/export/import-dialog';
import { articlesToCsv, downloadCsv } from '@/features/export/csv';
import { Article } from '@/lib/db';

interface TopBarMenuProps {
  articles?: Article[];
  filterSuffix?: string;
}

export function TopBarMenu({ articles, filterSuffix = 'all' }: TopBarMenuProps) {
  const [showExtensionDialog, setShowExtensionDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const extensionUrl = `${import.meta.env.BASE_URL}readlater-extension.zip`;
  const navigate = useNavigate();

  const handleExport = () => {
    if (!articles?.length) return;
    const csv = articlesToCsv(articles);
    const date = new Date().toISOString().split('T')[0];
    downloadCsv(csv, `readlater-${filterSuffix}-${date}.csv`);
  };

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
            onClick={() => navigate('/settings')}
            className="cursor-pointer"
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleExport}
            className="cursor-pointer"
            disabled={!articles?.length}
          >
            <FileDown className="mr-2 h-4 w-4" />
            <span>Export CSV</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowImportDialog(true)}
            className="cursor-pointer"
          >
            <Upload className="mr-2 h-4 w-4" />
            <span>Import CSV</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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

      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
      />
    </>
  );
}
