# Privacy Policy

**Last Updated: November 2, 2025**

## Overview

ReadLater2 is an open-source, privacy-first read-it-later application. We are committed to protecting your privacy and giving you full control over your data.

## Data Collection and Storage

### What Data We Collect

When you use ReadLater2, the following data is stored:

- **Link Information**: URLs, titles, descriptions, featured images, domains, tags, and notes for links you save
- **Metadata**: Timestamps, archived status, and favorite flags for your saved links
- **Google Account Information**: Your email address and name (provided by Google OAuth) to authenticate with Google Sheets API

### Where Your Data is Stored

- **Your Device**: All data is stored locally in your browser's IndexedDB
- **Your Google Sheets**: When you choose to sync, your data is stored in a Google Spreadsheet ("ReadLater") that you own and control
- **Our Servers**: We do not operate any servers. No data is ever sent to us or stored on third-party servers (except Google Sheets, which you control)

### How We Use Your Data

- **Local Storage**: To provide offline access and fast performance
- **Google Sheets Sync**: To synchronize your saved links across devices using your own Google Sheets
- **No Analytics**: We do not collect usage analytics, telemetry, or tracking data
- **No Sharing**: We never share, sell, or transfer your data to third parties

## Google Sheets API Access

### Permissions

ReadLater2 requests the following Google API permissions:

- `https://www.googleapis.com/auth/spreadsheets`: To read and write data to your Google Sheets
- `identity.email`: To identify your Google account for authentication

### How We Use Google Sheets

- **Auto-Creation**: We create a "ReadLater" spreadsheet in your Google Drive (if it doesn't exist)
- **Data Sync**: We read and write data to this spreadsheet
- **Your Control**: You own the spreadsheet and can view, edit, or delete it at any time
- **No Access to Other Files**: We only access the "ReadLater" spreadsheet we create

## Data Security

- **Client-Side Only**: All operations happen in your browser
- **OAuth 2.0**: Secure authentication with Google using industry-standard OAuth 2.0
- **No Backend**: Since we have no servers, there's no central database to breach
- **Open Source**: Our code is publicly available on GitHub for transparency and security audits

## Your Rights

You have complete control over your data:

- **Access**: View your data anytime in your browser's IndexedDB or your Google Sheets
- **Export**: Your data is already in Google Sheets, easily exportable to CSV/Excel
- **Delete**: Delete individual items or clear all data from the app settings
- **Revoke Access**: Revoke Google Sheets API access at [Google Account Permissions](https://myaccount.google.com/permissions)

## Third-Party Services

ReadLater2 integrates with:

- **Google Sheets API**: Subject to [Google Privacy Policy](https://policies.google.com/privacy)
- **Google OAuth**: Subject to [Google's OAuth 2.0 Policies](https://developers.google.com/identity/protocols/oauth2)

We do not use any other third-party services, analytics, or tracking tools.

## Data Retention

- **Local Data**: Retained until you manually delete it or clear browser data
- **Google Sheets**: Retained in your Google Drive until you delete the spreadsheet
- **No Server Storage**: We retain nothing because we have no servers

## Children's Privacy

ReadLater2 is not directed to children under 13. We do not knowingly collect data from children. If you believe a child has provided data, please contact us.

## Changes to This Policy

We may update this privacy policy occasionally. Changes will be posted on this page with an updated "Last Updated" date. Continued use after changes constitutes acceptance.

## Open Source

ReadLater2 is open-source software licensed under the MIT License. You can review our source code at: [https://github.com/romanlv/readlater2](https://github.com/romanlv/readlater2)

## Contact

For questions about this privacy policy or data practices:

- **GitHub Issues**: [https://github.com/romanlv/readlater2/issues](https://github.com/romanlv/readlater2/issues)
- **Source Code**: [https://github.com/romanlv/readlater2](https://github.com/romanlv/readlater2)

## Summary

**In plain terms**: ReadLater2 is built to be privacy-first. Your data lives on your device and in your own Google Sheets. We don't collect analytics, we don't have servers, and we never see your data. You have complete control.
