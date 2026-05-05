// ── Themes ────────────────────────────────────────────────────────────────────

const THEMES: Record<string, Theme> = {
    'dark-blue': {
        label: 'Dark Blue',
        vars: {
            '--bg': '#0f1117', '--bg-2': '#161b27', '--bg-3': '#1e2535', '--bg-4': '#252d3d',
            '--border': '#2a3347', '--border-light': '#344060',
            '--accent': '#4f8ef7', '--accent-hover': '#6aa0ff', '--accent-dim': 'rgba(79,142,247,.12)',
            '--text': '#e2e8f4', '--text-muted': '#7a8aaa', '--text-dim': '#4a5568',
            '--color-num': '#a78bfa', '--color-date': '#fbbf24', '--color-str': '#e2e8f4',
        }
    },
    'dark-gray': {
        label: 'Dark Gray',
        vars: {
            '--bg': '#111111', '--bg-2': '#1a1a1a', '--bg-3': '#222222', '--bg-4': '#2a2a2a',
            '--border': '#333333', '--border-light': '#444444',
            '--accent': '#4f8ef7', '--accent-hover': '#6aa0ff', '--accent-dim': 'rgba(79,142,247,.12)',
            '--text': '#e8e8e8', '--text-muted': '#888888', '--text-dim': '#555555',
            '--color-num': '#a78bfa', '--color-date': '#fbbf24', '--color-str': '#e8e8e8',
        }
    },
    'dark-green': {
        label: 'Dark Green',
        vars: {
            '--bg': '#0d1410', '--bg-2': '#141f18', '--bg-3': '#1a2820', '--bg-4': '#203028',
            '--border': '#2a3d30', '--border-light': '#34503e',
            '--accent': '#34d399', '--accent-hover': '#4ade80', '--accent-dim': 'rgba(52,211,153,.12)',
            '--text': '#e2f0ea', '--text-muted': '#7aaa90', '--text-dim': '#4a6858',
            '--color-num': '#6ee7b7', '--color-date': '#f9a825', '--color-str': '#e2f0ea',
        }
    },
    'dark-purple': {
        label: 'Dark Purple',
        vars: {
            '--bg': '#0f0d17', '--bg-2': '#17142a', '--bg-3': '#1e1a35', '--bg-4': '#252040',
            '--border': '#2e2850', '--border-light': '#3d3668',
            '--accent': '#a78bfa', '--accent-hover': '#c4b5fd', '--accent-dim': 'rgba(167,139,250,.12)',
            '--text': '#ede9f4', '--text-muted': '#9a8aaa', '--text-dim': '#5a4a78',
            '--color-num': '#f472b6', '--color-date': '#fbbf24', '--color-str': '#ede9f4',
        }
    },
    'one-dark-pro-night': {
        label: 'One Dark Pro Night',
        vars: {
            '--bg': '#1e2127', '--bg-2': '#21252b', '--bg-3': '#272c35', '--bg-4': '#2c313c',
            '--border': '#3a3f4b', '--border-light': '#4b5263',
            '--accent': '#61afef', '--accent-hover': '#82c0f7', '--accent-dim': 'rgba(97,175,239,.12)',
            '--text': '#dde1e8', '--text-muted': '#9099aa', '--text-dim': '#4b5263',
            '--color-num': '#d19a66', '--color-date': '#e5c07b', '--color-str': '#98c379',
        }
    },
    'one-dark': {
        label: 'One Dark',
        vars: {
            '--bg': '#21252b', '--bg-2': '#282c34', '--bg-3': '#2c313a', '--bg-4': '#333842',
            '--border': '#3e4451', '--border-light': '#4b5263',
            '--accent': '#61afef', '--accent-hover': '#82c0f7', '--accent-dim': 'rgba(97,175,239,.12)',
            '--text': '#dde1e8', '--text-muted': '#7a8499', '--text-dim': '#4b5263',
            '--color-num': '#d19a66', '--color-date': '#e5c07b', '--color-str': '#98c379',
        }
    },
    'light': {
        label: 'Light',
        vars: {
            '--bg': '#e8eaf0', '--bg-2': '#f0f2f7', '--bg-3': '#e2e5ed', '--bg-4': '#d8dce6',
            '--border': '#c8cdd8', '--border-light': '#b0b7c8',
            '--accent': '#3b6fd4', '--accent-hover': '#2d5bbf', '--accent-dim': 'rgba(59,111,212,.1)',
            '--text': '#1a2033', '--text-muted': '#5a6480', '--text-dim': '#8a93aa',
            '--color-num': '#6d28d9', '--color-date': '#b45309', '--color-str': '#1a2033',
        }
    },
};

const THEME_STORAGE_KEY = 'yoursql_theme';

// All configurable CSS variables shown in the color editor
const CUSTOM_COLORS = [
    { key: '--bg',           label: 'Background' },
    { key: '--bg-2',         label: 'Sidebar / panels' },
    { key: '--bg-3',         label: 'Inputs / table rows' },
    { key: '--bg-4',         label: 'Hover / subtle bg' },
    { key: '--border',       label: 'Border' },
    { key: '--border-light', label: 'Border light' },
    { key: '--accent',       label: 'Accent' },
    { key: '--accent-hover', label: 'Accent hover' },
    { key: '--text',         label: 'Text' },
    { key: '--text-muted',   label: 'Text muted' },
    { key: '--text-dim',     label: 'Text dim' },
    { key: '--color-str',    label: 'String values' },
    { key: '--color-num',    label: 'Number values' },
    { key: '--color-date',   label: 'Date values' },
];

// ── Apply theme to :root ───────────────────────────────────────────────────────

function applyThemeVars(vars: Record<string, string>): void {
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

function applyTheme(themeId: string, overrides: Record<string, string> = {}): void {
    const base = THEMES[themeId] || THEMES['dark-blue'];
    applyThemeVars({ ...base.vars, ...overrides });
}

// ── Startup: apply saved theme or server-injected custom theme ─────────────────

function loadSavedTheme(): void {
    // If server injected a custom theme, it's already in CSS via <style id="server-theme">.
    // We still call applyThemeVars so JS-driven changes (live preview) override cleanly.
    if ((window as any).__serverTheme) {
        const st = (window as any).__serverTheme;
        const base = THEMES[st.base] || THEMES['dark-blue'];
        applyThemeVars({ ...base.vars, ...st.vars });
        return;
    }
    const themeId = localStorage.getItem(THEME_STORAGE_KEY) || 'dark-blue';
    applyTheme(themeId);
}

loadSavedTheme();

// ── Helpers ────────────────────────────────────────────────────────────────────

function cssColorToHex(color: string): string {
    if (!color) return '#000000';
    color = color.trim();
    if (color.startsWith('#')) {
        if (color.length === 4) {
            return '#' + color[1]+color[1]+color[2]+color[2]+color[3]+color[3];
        }
        return color.slice(0, 7);
    }
    const m = color.match(/[\d.]+/g);
    if (m && m.length >= 3) {
        return '#' + [m[0], m[1], m[2]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
    }
    return '#000000';
}

// ── Settings modal ─────────────────────────────────────────────────────────────

function openSettings(): void {
    if (document.getElementById('settings-overlay')) return;

    // Determine active theme: server custom > localStorage > default
    const serverTheme  = (window as any).__serverTheme as { vars: Record<string,string>; base: string | null } | null;
    const hasCustom    = !!serverTheme;
    const activeTheme  = hasCustom ? (serverTheme!.base || 'dark-blue') : (localStorage.getItem(THEME_STORAGE_KEY) || 'dark-blue');

    // Current vars for pickers: merge base + server overrides
    function getActiveVars(themeId: string, customOverrides: Record<string,string> = {}): Record<string,string> {
        return { ...(THEMES[themeId] || THEMES['dark-blue']).vars, ...customOverrides };
    }

    let currentTheme   = activeTheme;
    let currentCustom: Record<string,string> = hasCustom ? { ...serverTheme!.vars } : {};
    let isCustomActive = hasCustom;

    const overlay = document.createElement('div');
    overlay.id = 'settings-overlay';

    function buildThemeButtons(): string {
        const btns = Object.entries(THEMES).map(([id, t]) => `
            <button class="theme-btn${!isCustomActive && id === currentTheme ? ' active' : ''}" data-theme="${id}">
                <span class="theme-swatch" style="
                    background: linear-gradient(135deg, ${t.vars['--bg-2']} 50%, ${t.vars['--accent']} 50%);
                    border-color: ${t.vars['--border-light']};
                "></span>
                ${escHtml(t.label)}
            </button>
        `).join('');

        const customSwatch = isCustomActive
            ? (() => {
                const v = getActiveVars(currentTheme, currentCustom);
                return `background: linear-gradient(135deg, ${v['--bg-2'] || '#222'} 50%, ${v['--accent'] || '#4f8ef7'} 50%); border-color: ${v['--border-light'] || '#444'};`;
              })()
            : 'background: linear-gradient(135deg, #1a1a2e 50%, #e94560 50%); border-color: #444;';

        const customBtn = `
            <button class="theme-btn${isCustomActive ? ' active' : ''}" id="theme-btn-custom" data-theme="__custom__">
                <span class="theme-swatch" style="${customSwatch}"></span>
                Custom
                ${isCustomActive ? '<span class="theme-custom-badge">saved</span>' : ''}
            </button>
        `;

        return btns + customBtn;
    }

    function buildColorPickers(): string {
        const vars = getActiveVars(currentTheme, currentCustom);
        return CUSTOM_COLORS.map(c => {
            const val = vars[c.key] || '#000000';
            const hex = cssColorToHex(val);
            return `
            <div class="custom-color-row">
                <label class="custom-color-label">${escHtml(c.label)}</label>
                <div class="custom-color-right">
                    <input type="color" class="color-picker" data-var="${c.key}" value="${hex}">
                    <span class="color-val">${escHtml(val)}</span>
                </div>
            </div>`;
        }).join('');
    }

    function renderModal(): void {
        overlay.innerHTML = `
            <div class="settings-modal" id="settings-modal">
                <div class="rem-header">
                    <span class="rem-title">Settings</span>
                    <button class="rem-close" id="settings-close">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
                        </svg>
                    </button>
                </div>
                <div class="rem-body">
                    <div class="settings-section-title">Theme</div>
                    <div class="theme-grid" id="theme-grid">${buildThemeButtons()}</div>

                    <div class="settings-section-title" style="margin-top:18px;display:flex;align-items:center;gap:10px">
                        <span>Colors</span>
                        <button class="settings-reset-btn" id="settings-reset">Reset to theme defaults</button>
                    </div>
                    <div class="custom-colors-grid" id="colors-grid">${buildColorPickers()}</div>

                    <div class="settings-custom-actions">
                        <button class="btn btn-accent btn-sm" id="btn-save-custom">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style="margin-right:4px">
                                <path d="M2 1a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4.5L10.5 1H2zm5 11a3 3 0 110-6 3 3 0 010 6zM3 3h6v2H3V3z"/>
                            </svg>
                            Save Custom Theme
                        </button>
                        ${isCustomActive ? `
                        <button class="btn btn-danger btn-sm" id="btn-delete-custom">
                            Delete Custom Theme
                        </button>` : ''}
                    </div>
                </div>
            </div>
        `;
        bindEvents();
    }

    function bindEvents(): void {
        overlay.querySelector('#settings-close')!.addEventListener('click', closeSettings);

        // Theme buttons
        overlay.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = (btn as HTMLElement).dataset.theme!;
                if (id === '__custom__') {
                    if (!isCustomActive) return;
                    // Re-activate saved custom
                    currentTheme  = serverTheme?.base || 'dark-blue';
                    currentCustom = { ...(serverTheme?.vars || {}) };
                    isCustomActive = true;
                } else {
                    currentTheme   = id;
                    currentCustom  = {};
                    isCustomActive = false;
                    localStorage.setItem(THEME_STORAGE_KEY, id);
                }
                applyTheme(currentTheme, currentCustom);
                renderModal();
            });
        });

        // Color pickers — live preview
        overlay.querySelectorAll('.color-picker').forEach(p => {
            const picker = p as HTMLInputElement;
            picker.addEventListener('input', () => {
                currentCustom[picker.dataset.var!] = picker.value;
                picker.closest('.custom-color-row')!.querySelector('.color-val')!.textContent = picker.value;
                applyTheme(currentTheme, currentCustom);
            });
        });

        // Reset to current theme defaults
        overlay.querySelector('#settings-reset')!.addEventListener('click', () => {
            currentCustom = {};
            applyTheme(currentTheme);
            const themeVars = (THEMES[currentTheme] || THEMES['dark-blue']).vars;
            overlay.querySelectorAll('.color-picker').forEach(p => {
                const picker = p as HTMLInputElement;
                const val = themeVars[picker.dataset.var!] || '#000000';
                picker.value = cssColorToHex(val);
                picker.closest('.custom-color-row')!.querySelector('.color-val')!.textContent = val;
            });
        });

        // Save custom theme to server
        overlay.querySelector('#btn-save-custom')!.addEventListener('click', async () => {
            const btn = overlay.querySelector('#btn-save-custom') as HTMLButtonElement;
            btn.disabled    = true;
            btn.textContent = 'Saving…';
            try {
                await api('settings', {
                    action: 'set',
                    pairs: {
                        custom_theme_vars: JSON.stringify(currentCustom),
                        custom_theme_base: currentTheme,
                    },
                });
                // Update window.__serverTheme so re-renders are consistent
                (window as any).__serverTheme = { vars: { ...currentCustom }, base: currentTheme };
                isCustomActive = true;
                toast('Custom theme saved', 'success');
                renderModal();
            } catch (err: any) {
                toast('Error: ' + err.message, 'error');
                btn.disabled    = false;
                btn.textContent = 'Save Custom Theme';
            }
        });

        // Delete custom theme
        const delBtn = overlay.querySelector('#btn-delete-custom');
        if (delBtn) {
            delBtn.addEventListener('click', async () => {
                (delBtn as HTMLButtonElement).disabled = true;
                try {
                    await api('settings', {
                        action: 'delete',
                        keys: ['custom_theme_vars', 'custom_theme_base'],
                    });
                    (window as any).__serverTheme = null;
                    isCustomActive = false;
                    currentCustom  = {};
                    // Fall back to localStorage theme
                    const saved = localStorage.getItem(THEME_STORAGE_KEY) || 'dark-blue';
                    currentTheme   = saved;
                    applyTheme(currentTheme);
                    toast('Custom theme deleted', 'success');
                    renderModal();
                } catch (err: any) {
                    toast('Error: ' + err.message, 'error');
                    (delBtn as HTMLButtonElement).disabled = false;
                }
            });
        }
    }

    function closeSettings(): void { overlay.remove(); }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSettings(); });

    document.body.appendChild(overlay);
    renderModal();
}

document.getElementById('btn-settings')!.addEventListener('click', openSettings);
