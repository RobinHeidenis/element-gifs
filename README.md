<p align="center">
  <img src="assets/icon.png" alt="Element GIFs" width="128" height="128">
</p>

<h1 align="center">Element GIFs</h1>

<p align="center">
  Browser extension to add GIF support to Element (app.element.io). Powered by <a href="https://klipy.com/">Klipy</a>.
</p>

## Features

- Search and browse trending GIFs
- Upload GIFs directly to Element (works with E2E encrypted rooms)
- Optional: paste GIF links inline instead of uploading
- Works on both Chrome and Firefox

## Setup

You'll need a Klipy API key to use this extension. Get one at [partner.klipy.com](https://partner.klipy.com/api-keys).

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (Chrome)
pnpm dev

# Start dev server (Firefox)
pnpm dev:firefox

# Build for production (Chrome)
pnpm build

# Build for production (Firefox)
pnpm build:firefox

# Build and create zip for store submission (Chrome)
pnpm zip

# Build and create zip for store submission (Firefox)
pnpm zip:firefox
```

## Loading the Extension

### Chrome
1. Run `pnpm build`
2. Go to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `.output/chrome-mv3` folder

### Firefox
1. Run `pnpm build:firefox`
2. Go to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select any file in the `.output/firefox-mv2` folder

## Settings

Click the gear icon in the GIF popover to access settings:

- **Paste links inline**: When enabled, GIF URLs are pasted as text instead of uploading the file. Useful for non-encrypted rooms or when you prefer link previews.
- **API key management**: View your current API key (masked) or set a new one.

## Credits

This extension was mostly built by [Augment Code](https://www.augmentcode.com/) AI assistant (Claude Opus 4.5), with guidance and direction from Robin Heidenis.
