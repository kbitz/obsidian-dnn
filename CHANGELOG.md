# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.1.1] - 2026-09-21

### Fixed

- Correct the minimum Obsidian version from 1.13.7 to 1.9.0 so compatible 1.9.x installations can load the plugin and install it through BRAT.
- Correct the 0.1.0 compatibility entry in `versions.json` to 1.9.0.

## [0.1.0] - 2026-09-17

### Added

- Browse existing daily notes from the note header: previous/next arrows skip missing days and disable at the earliest and latest notes you have
- Click the date to open a calendar of existing daily notes, with month selection, direct year entry, and full keyboard navigation
- "Open date picker" and "Open today's existing daily note" commands, ready to bind your own shortcuts in Settings → Hotkeys (no default bindings)
- Works across multiple panes and pop-out windows, follows the core Daily notes plugin's folder and date-format settings, and never creates, edits, renames, or deletes a note
