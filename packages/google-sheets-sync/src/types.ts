export interface GoogleDriveFile {
  id: string;
  name: string;
}

export interface GoogleDriveFileList {
  files: GoogleDriveFile[];
}

export interface SpreadsheetConfig {
  spreadsheetId: string;
}

export interface GoogleSpreadsheet {
  spreadsheetId: string;
}

export interface GoogleValueRange {
  values?: string[][];
}