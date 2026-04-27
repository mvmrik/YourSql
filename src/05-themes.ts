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
            '--text': '#dde1e8', '--text-muted': '#6b717d', '--text-dim': '#4b5263',
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
const THEME_CUSTOM_KEY  = 'yoursql_custom_vars';

function applyTheme(themeId: string, customVars: Record<string, string> = {}): void {
    const theme = THEMES[themeId] || THEMES['dark-blue'];
    const vars  = { ...theme.vars, ...customVars };
    const root  = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

function loadSavedTheme(): void {
    const themeId   = localStorage.getItem(THEME_STORAGE_KEY) || 'light';
    const customRaw = localStorage.getItem(THEME_CUSTOM_KEY);
    const custom    = customRaw ? JSON.parse(customRaw) : {};
    applyTheme(themeId, custom);
}

function saveTheme(themeId: string, customVars: Record<string, string>): void {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
    localStorage.setItem(THEME_CUSTOM_KEY, JSON.stringify(customVars));
}

loadSavedTheme();

// ── Settings modal ────────────────────────────────────────────────────────────

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

function openSettings(): void {
    if (document.getElementById('settings-overlay')) return;

    const themeId   = localStorage.getItem(THEME_STORAGE_KEY) || 'light';
    const customRaw = localStorage.getItem(THEME_CUSTOM_KEY);
    let custom: Record<string, string> = customRaw ? JSON.parse(customRaw) : {};

    const CUSTOM_COLORS = [
        { key: '--accent',     label: 'Accent color' },
        { key: '--bg',         label: 'Background' },
        { key: '--bg-2',       label: 'Sidebar / panels' },
        { key: '--bg-3',       label: 'Inputs' },
        { key: '--text',       label: 'Text' },
        { key: '--text-muted', label: 'Text muted' },
        { key: '--border',     label: 'Border' },
        { key: '--color-str',  label: 'Text values' },
        { key: '--color-num',  label: 'Number values' },
        { key: '--color-date', label: 'Date values' },
    ];

    const themeButtons = Object.entries(THEMES).map(([id, t]) => `
        <button class="theme-btn${id === themeId ? ' active' : ''}" data-theme="${id}">
            <span class="theme-swatch" style="
                background: linear-gradient(135deg, ${t.vars['--bg-2']} 50%, ${t.vars['--accent']} 50%);
                border-color: ${t.vars['--border-light']};
            "></span>
            ${escHtml(t.label)}
        </button>
    `).join('');

    const overlay = document.createElement('div');
    overlay.id = 'settings-overlay';
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
                <div class="theme-grid" id="theme-grid">${themeButtons}</div>

                <div class="settings-section-title" style="margin-top:18px">Custom colors
                    <button class="settings-reset-btn" id="settings-reset">Reset to theme defaults</button>
                </div>
                <div class="custom-colors-grid">
                    ${CUSTOM_COLORS.map(c => {
                        const theme  = THEMES[themeId] || THEMES['dark-blue'];
                        const val    = custom[c.key] || theme.vars[c.key] || '#000000';
                        const hex    = cssColorToHex(val);
                        return `
                        <div class="custom-color-row">
                            <label class="custom-color-label">${escHtml(c.label)}</label>
                            <div class="custom-color-right">
                                <input type="color" class="color-picker" data-var="${c.key}" value="${hex}">
                                <span class="color-val">${val}</span>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    let currentTheme  = themeId;
    let currentCustom = { ...custom };

    function rerender() {
        applyTheme(currentTheme, currentCustom);
        saveTheme(currentTheme, currentCustom);
    }

    overlay.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            overlay.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTheme  = (btn as HTMLElement).dataset.theme!;
            currentCustom = {};
            const themeVars = THEMES[currentTheme].vars;
            overlay.querySelectorAll('.color-picker').forEach(p => {
                const picker = p as HTMLInputElement;
                const val = themeVars[picker.dataset.var!] || '#000000';
                picker.value = cssColorToHex(val);
                picker.closest('.custom-color-row')!.querySelector('.color-val')!.textContent = val;
            });
            rerender();
        });
    });

    overlay.querySelectorAll('.color-picker').forEach(p => {
        const picker = p as HTMLInputElement;
        picker.addEventListener('input', () => {
            currentCustom[picker.dataset.var!] = picker.value;
            picker.closest('.custom-color-row')!.querySelector('.color-val')!.textContent = picker.value;
            rerender();
        });
    });

    overlay.querySelector('#settings-reset')!.addEventListener('click', () => {
        currentCustom = {};
        const themeVars = THEMES[currentTheme].vars;
        overlay.querySelectorAll('.color-picker').forEach(p => {
            const picker = p as HTMLInputElement;
            const val = themeVars[picker.dataset.var!] || '#000000';
            picker.value = cssColorToHex(val);
            picker.closest('.custom-color-row')!.querySelector('.color-val')!.textContent = val;
        });
        rerender();
    });

    function closeSettings() { overlay.remove(); }
    overlay.querySelector('#settings-close')!.addEventListener('click', closeSettings);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSettings(); });
}

document.getElementById('btn-settings')!.addEventListener('click', openSettings);
