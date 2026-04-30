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

Before updating:

1. Close WrenchPro.
2. Back up the database files.
3. Install the new version or accept the update prompt.
4. Reopen WrenchPro.
5. Verify old customers, vehicles, jobs, payments, and settings are still present.

## Data Location

WrenchPro stores data in a local SQLite database named:

```text
wrenchpro.db
```

Installed Electron app path, based on the current code:

```text
%APPDATA%\WrenchPro\wrenchpro.db
```

Developer/plain server path:

```text
C:\Users\imajo\wrenchpro\wrenchpro.db
```

Because the database uses SQLite WAL mode, also back up these companion files if present:

```text
wrenchpro.db-wal
wrenchpro.db-shm
```

## Manual Backup

1. Close WrenchPro completely.
2. Open File Explorer.
3. Paste this in the address bar:

```text
%APPDATA%\WrenchPro
```

4. Copy these files if they exist:

```text
wrenchpro.db
wrenchpro.db-wal
wrenchpro.db-shm
```

5. Paste them into a dated backup folder, for example:

```text
Documents\WrenchPro Backups\2026-04-29-before-update\
```

6. Keep more than one backup while testing.

## Restore From Backup

Only restore while WrenchPro is closed.

1. Close WrenchPro.
2. Open `%APPDATA%\WrenchPro`.
3. Make a safety copy of the current database files first.
4. Copy the backed-up `wrenchpro.db` into the folder.
5. Copy `wrenchpro.db-wal` and `wrenchpro.db-shm` too if they were included in the backup.
6. Reopen WrenchPro.
7. Confirm customers, vehicles, jobs, payments, and settings look correct.

## Uninstall Note

The Windows installer config currently has:

```text
deleteAppDataOnUninstall: false
```

That means uninstalling should not intentionally delete app data. Still, make a manual backup before uninstalling.

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

- **Assumption:** There is not yet a dedicated in-app backup/export button.
- Backups are currently manual file copies.
- Data is local to the computer where WrenchPro is installed.
- No cloud sync, cloud backup, or account recovery process is documented yet.
