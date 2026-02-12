import { KlipyGif, getApiKey, saveApiKey, fetchTrendingGifs, searchGifs, getPasteLinkInline, savePasteLinkInline } from '@/utils/klipy';

// Inline CSS import
import styles from '@/utils/styles.css?inline';

export default defineContentScript({
  matches: ['https://app.element.io/*'],
  runAt: 'document_idle',
  main() {
    // Inject styles into the page
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // SVG icon for the GIF button
    const GIF_ICON = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <text x="12" y="14" text-anchor="middle" font-size="7" font-weight="bold" fill="currentColor" stroke="none">GIF</text>
    </svg>
    `;

    // Gear icon for settings
    const GEAR_ICON = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
    `;

    // State
    let popover: HTMLElement | null = null;
    let button: HTMLElement | null = null;
    let searchTimeout: ReturnType<typeof setTimeout> | null = null;
    let isSettingsView = false;

    // Debounce delay in ms
    const DEBOUNCE_DELAY = 300;

    /**
     * Render GIFs in the grid
     */
    function renderGifs(gifs: KlipyGif[]): void {
      if (!popover) return;
      const body = popover.querySelector('.mx_EmojiPicker_body');
      if (!body) return;

      if (!gifs || gifs.length === 0) {
        body.innerHTML =
          '<p style="color: #888; text-align: center; padding: 20px;">No GIFs found</p>';
        return;
      }

      body.innerHTML = `<div class="eg-gif-grid">
        <div class="eg-gif-column"></div>
        <div class="eg-gif-column"></div>
      </div>`;
      const columns = body.querySelectorAll('.eg-gif-column');
      if (columns.length !== 2) return;

      // Track column heights to distribute GIFs evenly
      const columnHeights = [0, 0];

      gifs.forEach((gif) => {
        const img = document.createElement('img');
        const previewUrl =
          gif.file?.sm?.webp?.url ||
          gif.file?.xs?.webp?.url ||
          gif.file?.sm?.gif?.url ||
          gif.file?.md?.webp?.url ||
          '';
        const fullUrl =
          gif.file?.hd?.webp?.url ||
          gif.file?.md?.webp?.url ||
          gif.file?.sm?.webp?.url ||
          gif.file?.hd?.gif?.url ||
          '';

        // Show blur preview while loading
        if (gif.blur_preview) {
          img.src = gif.blur_preview;
        }
        img.alt = gif.title || 'GIF';
        img.className = 'eg-gif-item';
        img.dataset.gifUrl = fullUrl;
        img.loading = 'lazy';

        // Load actual preview
        const actualImg = new Image();
        actualImg.onload = () => {
          img.src = previewUrl;
        };
        actualImg.src = previewUrl;

        img.addEventListener('click', () => insertGif(fullUrl));

        const shorterColumn = columnHeights[0] <= columnHeights[1] ? 0 : 1;
        columns[shorterColumn].appendChild(img);

        const width = gif.file?.sm?.webp?.width || gif.file?.sm?.gif?.width || 150;
        const height =
          gif.file?.sm?.webp?.height || gif.file?.sm?.gif?.height || 150;
        columnHeights[shorterColumn] += height / width;
      });

      // Add footer
      const footer = document.createElement('div');
      footer.className = 'eg-footer';
      footer.innerHTML =
        'made with ❤️ by <a href="https://github.com/RobinHeidenis" target="_blank">Robin Heidenis</a>';
      body.appendChild(footer);
    }

    /**
     * Insert GIF link inline into the composer
     */
    function insertGifLink(gifUrl: string, composer: HTMLElement): void {
      composer.focus();
      document.execCommand('insertText', false, gifUrl);
      composer.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }

    /**
     * Insert GIF into Element's composer by downloading and uploading as file
     */
    async function insertGifAsFile(gifUrl: string, composer: HTMLElement): Promise<void> {
      try {
        // Fetch the GIF as a blob
        const response = await fetch(gifUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch GIF: ${response.status}`);
        }

        const blob = await response.blob();

        // Create a File object from the blob
        const filename = gifUrl.split('/').pop() || 'gif.gif';
        const file = new File([blob], filename, { type: blob.type || 'image/gif' });

        // Create a DataTransfer to hold the file
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);

        composer.focus();

        // Try to find Element's hidden file input and set files directly
        // This works cross-browser including Firefox
        const fileInput = document.querySelector<HTMLInputElement>(
          'input[type="file"][multiple]',
        );

        if (fileInput) {
          // Set files directly on the input (works in Firefox!)
          fileInput.files = dataTransfer.files;
          // Trigger change event to notify Element
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
          return;
        }

        // Fallback: try paste event (works in Chrome)
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dataTransfer,
        });

        composer.dispatchEvent(pasteEvent);
      } catch (err) {
        console.error('[Element GIFs] Error inserting GIF:', err);
        // Fallback to URL if fetch fails
        insertGifLink(gifUrl, composer);
      }
    }

    /**
     * Insert GIF into Element's composer
     */
    async function insertGif(gifUrl: string): Promise<void> {
      popover?.hidePopover();

      const composer = document.querySelector<HTMLElement>(
        '[role="textbox"][contenteditable="true"]',
      );

      if (!composer) return;

      const pasteLinkInline = await getPasteLinkInline();

      if (pasteLinkInline) {
        insertGifLink(gifUrl, composer);
      } else {
        await insertGifAsFile(gifUrl, composer);
      }
    }

    /**
     * Show API key input screen
     */
    function showApiKeyInput(): void {
      if (!popover) return;
      const body = popover.querySelector('.mx_EmojiPicker_body');
      if (!body) return;

      body.innerHTML = `
        <div class="eg-api-key-form">
          <p>Enter your Klipy API key to use GIFs</p>
          <p style="font-size: 12px; margin-bottom: 12px;">
            Get a key at <a href="https://partner.klipy.com/api-keys" target="_blank" style="color: #0dbd8b;">partner.klipy.com</a>
          </p>
          <input type="text" id="eg-api-key-input" placeholder="Your API key" />
          <button id="eg-api-key-save">Save</button>
        </div>
      `;

      const saveBtn = body.querySelector<HTMLButtonElement>('#eg-api-key-save');
      const input = body.querySelector<HTMLInputElement>('#eg-api-key-input');

      saveBtn?.addEventListener('click', async () => {
        const key = input?.value.trim();
        if (key) {
          await saveApiKey(key);
          await loadTrendingGifs();
        }
      });

      input?.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          const key = input.value.trim();
          if (key) {
            await saveApiKey(key);
            await loadTrendingGifs();
          }
        }
      });
    }

    /**
     * Show settings screen
     */
    async function showSettings(): Promise<void> {
      if (!popover) return;
      isSettingsView = true;

      // Update header to show back button instead of gear
      updateHeader();

      const body = popover.querySelector('.mx_EmojiPicker_body');
      if (!body) return;

      const apiKey = await getApiKey();
      const maskedKey = apiKey ? apiKey.substring(0, 5) + '...' : 'Not set';
      const pasteLinkInline = await getPasteLinkInline();

      body.innerHTML = `
        <div class="eg-settings">
          <div class="eg-settings-section">
            <label class="eg-settings-label">
              <input type="checkbox" id="eg-paste-link-inline" ${pasteLinkInline ? 'checked' : ''} />
              <span>Paste links inline instead of uploading</span>
            </label>
            <p class="eg-settings-hint">When enabled, GIF URLs will be pasted as text instead of uploading the file.</p>
          </div>

          <div class="eg-settings-section">
            <p class="eg-settings-title">Current API key</p>
            <p class="eg-settings-value">${maskedKey}</p>
          </div>

          <div class="eg-settings-section">
            <p class="eg-settings-title">New API key</p>
            <input type="text" id="eg-new-api-key" placeholder="Enter new API key" />
            <button id="eg-save-api-key">Save</button>
          </div>
        </div>
      `;

      // Handle checkbox change
      const checkbox = body.querySelector<HTMLInputElement>('#eg-paste-link-inline');
      checkbox?.addEventListener('change', async () => {
        await savePasteLinkInline(checkbox.checked);
      });

      // Handle API key save
      const saveBtn = body.querySelector<HTMLButtonElement>('#eg-save-api-key');
      const input = body.querySelector<HTMLInputElement>('#eg-new-api-key');

      saveBtn?.addEventListener('click', async () => {
        const key = input?.value.trim();
        if (key) {
          await saveApiKey(key);
          // Refresh settings to show new masked key
          await showSettings();
        }
      });

      input?.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          const key = input.value.trim();
          if (key) {
            await saveApiKey(key);
            await showSettings();
          }
        }
      });
    }

    /**
     * Hide settings and go back to GIF view
     */
    async function hideSettings(): Promise<void> {
      isSettingsView = false;
      updateHeader();
      await loadTrendingGifs();
    }

    /**
     * Update header based on current view
     */
    function updateHeader(): void {
      if (!popover) return;
      const header = popover.querySelector('.mx_EmojiPicker_header');
      if (!header) return;

      if (isSettingsView) {
        header.innerHTML = `
          <div class="eg-header">
            <button id="eg-back-btn" class="eg-header-btn" aria-label="Back">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <span class="eg-header-title">Settings</span>
          </div>
        `;

        const backBtn = header.querySelector('#eg-back-btn');
        backBtn?.addEventListener('click', hideSettings);
      } else {
        header.innerHTML = `
          <div class="eg-header">
            <span class="eg-header-title">GIFs</span>
            <button id="eg-settings-btn" class="eg-header-btn" aria-label="Settings">
              ${GEAR_ICON}
            </button>
          </div>
          <div class="mx_EmojiPicker_search">
            <input
              id="element-gifs-search"
              placeholder="Search GIFs"
              aria-label="Search GIFs"
              type="text"
              value=""
            >
            <span class="mx_EmojiPicker_search_icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15.05 16.463a7.5 7.5 0 1 1 1.414-1.414l3.243 3.244a1 1 0 0 1-1.414 1.414zM16 10.5a5.5 5.5 0 1 0-11 0 5.5 5.5 0 0 0 11 0"></path>
              </svg>
            </span>
          </div>
        `;

        const settingsBtn = header.querySelector('#eg-settings-btn');
        settingsBtn?.addEventListener('click', showSettings);

        const searchInput = header.querySelector('#element-gifs-search');
        searchInput?.addEventListener('input', onSearchInput);
      }
    }

    /**
     * Load trending GIFs on popover open
     */
    async function loadTrendingGifs(): Promise<void> {
      if (!popover) return;
      const body = popover.querySelector('.mx_EmojiPicker_body');
      if (!body) return;

      body.innerHTML =
        '<p style="color: #888; text-align: center; padding: 20px;">Loading...</p>';

      const gifs = await fetchTrendingGifs();
      renderGifs(gifs);
    }

    /**
     * Debounced search handler
     */
    async function handleSearch(query: string): Promise<void> {
      if (!query) {
        await loadTrendingGifs();
        return;
      }

      if (!popover) return;
      const body = popover.querySelector('.mx_EmojiPicker_body');
      if (!body) return;

      body.innerHTML =
        '<p style="color: #888; text-align: center; padding: 20px;">Searching...</p>';

      const gifs = await searchGifs(query);
      renderGifs(gifs);
    }

    /**
     * Input handler with debounce
     */
    function onSearchInput(e: Event): void {
      const target = e.target as HTMLInputElement;
      const query = target.value.trim();

      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      searchTimeout = setTimeout(() => {
        handleSearch(query);
      }, DEBOUNCE_DELAY);
    }

    function tryInjectButton(): void {
      if (!window.location.hash.includes('/room/')) {
        return;
      }

      if (document.getElementById('element-gifs-button')) {
        return;
      }

      const emojiButton = document.querySelector('[aria-label="Emoji"]');
      if (!emojiButton) {
        return;
      }

      injectButton(emojiButton as HTMLElement);
    }

    function injectButton(emojiButton: HTMLElement): void {
      const container = document.createElement('div');
      container.id = 'element-gifs-root';
      container.style.position = 'relative';
      container.style.display = 'inline-flex';
      container.style.alignItems = 'center';

      button = document.createElement('div');
      button.id = 'element-gifs-button';
      button.className = 'mx_AccessibleButton mx_MessageComposer_button';
      button.setAttribute('tabindex', '0');
      button.setAttribute('role', 'button');
      button.setAttribute('aria-label', 'GIFs');
      button.innerHTML = GIF_ICON;
      let isPopoverOpen = false;

      // Track popover state via toggle event
      popover = createPopover();
      popover.addEventListener('toggle', (e) => {
        const newState = (e as ToggleEvent).newState;
        isPopoverOpen = newState === 'open';

        // Reset state when popover closes
        if (newState === 'closed') {
          const searchInput = popover?.querySelector<HTMLInputElement>(
            '#element-gifs-search',
          );
          if (searchInput) {
            searchInput.value = '';
          }
          // Reset settings view
          if (isSettingsView) {
            isSettingsView = false;
            updateHeader();
          }
        }
      });

      button.addEventListener('click', async () => {
        // Toggle popover - close if open, open if closed
        if (isPopoverOpen) {
          popover?.hidePopover();
          return;
        }

        popover?.showPopover();

        // Focus search input when opening
        const searchInput = popover?.querySelector<HTMLInputElement>(
          '#element-gifs-search',
        );
        searchInput?.focus();

        const hasApiKey = await getApiKey();
        if (!hasApiKey) {
          showApiKeyInput();
        } else {
          await loadTrendingGifs();
        }
      });

      document.body.appendChild(popover);

      container.appendChild(button);
      emojiButton.parentNode?.insertBefore(container, emojiButton);

      console.log('[Element GIFs] Button injected successfully');
    }

    function createPopover(): HTMLElement {
      const el = document.createElement('div');
      el.id = 'element-gifs-popover';
      el.className = 'mx_ContextualMenu';
      el.setAttribute('popover', 'auto');

      el.innerHTML = `
        <div class="mx_EmojiPicker_header">
          <div class="eg-header">
            <span class="eg-header-title">GIFs</span>
            <button id="eg-settings-btn" class="eg-header-btn" aria-label="Settings">
              ${GEAR_ICON}
            </button>
          </div>
          <div class="mx_EmojiPicker_search">
            <input
              id="element-gifs-search"
              placeholder="Search GIFs"
              aria-label="Search GIFs"
              type="text"
              value=""
            >
            <span class="mx_EmojiPicker_search_icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15.05 16.463a7.5 7.5 0 1 1 1.414-1.414l3.243 3.244a1 1 0 0 1-1.414 1.414zM16 10.5a5.5 5.5 0 1 0-11 0 5.5 5.5 0 0 0 11 0"></path>
              </svg>
            </span>
          </div>
        </div>
        <div class="mx_EmojiPicker_body">
          <p>Loading...</p>
        </div>
      `;

      const settingsBtn = el.querySelector('#eg-settings-btn');
      settingsBtn?.addEventListener('click', showSettings);

      const searchInput = el.querySelector('#element-gifs-search');
      searchInput?.addEventListener('input', onSearchInput);

      return el;
    }

    // Initialize
    const observer = new MutationObserver(tryInjectButton);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    tryInjectButton();
  },
});

