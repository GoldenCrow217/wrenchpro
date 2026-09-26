# WrenchPro Install and Backup Guide

Status: First-pass draft for early private beta users

> Important: WrenchPro is still in private beta. Back up data before updates, uninstall/reinstall tests, or serious use with real customer/business records.

## Install on Windows

1. Get the latest approved private beta installer from Brandon.
2. Close any running copy of WrenchPro.
3. Run `WrenchPro Setup X.Y.Z.exe`.
4. If Windows shows a security warning, continue only if the installer came from Brandon.
5. Choose install location if prompted.
6. Keep Desktop and Start Menu shortcuts enabled unless you prefer otherwise.
7. Launch **WrenchPro** from the Desktop shortcut or Start Menu.
8. Confirm the Dashboard loads.
9. Use **WrenchPro > About WrenchPro** to confirm the installed version.

Known repo details:

- App version in `package.json`: `1.0.8`
- Installer output folder: `dist/`
- Existing installer pattern: `WrenchPro Setup X.Y.Z.exe`
- **Assumption:** Windows is the first private beta platform.

## Updating WrenchPro

WrenchPro has installed-app update checking:

- Automatic update check may run after launch.
- Manual update check is under **Help > Check for Updates...**.
- Updates may download in the background and prompt for restart.

Before updating, use **File > Back Up Now** (or **Settings > Backup > Back up now**). After the update, verify old customers, vehicles, jobs, payments, and settings are still present.

## Backups

WrenchPro backs up your data automatically **once a day** while the app is open. Each backup is a single `.db` file that holds everything: customers, vehicles, jobs, payments, settings, and inspection photos.

- **Where:** `%APPDATA%\WrenchPro\Backups` by default. The last 14 automatic backups are kept; manual backups are never deleted automatically.
- **Protect against losing the computer:** go to **Settings > Backup > Change folder…** and pick a OneDrive, Dropbox, or USB-drive folder. WrenchPro makes a backup there straight away to confirm it works.
- **If that folder goes missing** (USB drive unplugged), backups are saved to the default folder instead and Settings shows a warning.
- **Back up any time:** **File > Back Up Now**, or **Settings > Backup > Back up now**.
- **Save a copy somewhere else:** **File > Save Backup As…** (for example, before handing the laptop in for repair).
- **Status:** **Settings > Backup** shows when the last backup ran and turns amber if there hasn't been one for 3 days.

## Restore From Backup

1. Open **File > Restore from Backup…** (or **Settings > Backup > Restore…**).
2. Choose a backup `.db` file.
3. WrenchPro checks the file and shows what it contains (business name, number of customers and jobs). Damaged files and files that aren't WrenchPro backups are refused.
4. Click **Restore and restart**. Your current data is saved first as a `WrenchPro-before-restore-….db` safety backup, so a restore can be undone by restoring that file.
5. WrenchPro restarts with the restored data. Confirm customers, jobs, payments, and settings look correct.

## Data Location

WrenchPro stores data in a local SQLite database, `%APPDATA%\WrenchPro\wrenchpro.db` for the installed app (`wrenchpro.db` in the project folder when running the plain dev server). **Tools > Open Data Folder** opens it. Don't copy the live `wrenchpro.db` by hand while the app is running; use the backup features above, which produce a consistent copy.

## Uninstall Note

The Windows installer config currently has:

```text
deleteAppDataOnUninstall: false
```

That means uninstalling should not intentionally delete app data. Still, use **File > Save Backup As…** before uninstalling.

## Post-Install / Post-Update Smoke Test

Verify:

- app opens from Desktop shortcut
- Dashboard loads
- existing customers and vehicles are visible
- a test customer can be created/edited
- a test vehicle can be created/edited
- a test job or estimate can be created
- a payment or expense can be recorded
- Settings stay saved
- About screen shows expected version

## Current Limitations / Assumptions

- Data is local to the computer where WrenchPro is installed. Point automatic backups at a synced or external folder to protect against losing the computer.
- Backup and restore are available in the desktop app only, not when running the plain browser/dev server.
- There is no CSV/spreadsheet export yet (**File > Export Data** is disabled).
