// ── Auto-refresh ──────────────────────────────────────────────────────────────

const AUTO_REFRESH_OPTIONS = [1, 5, 30, 60];

function startAutoRefresh(sec: number): void {
    stopAutoRefresh();
    state.autoRefresh.intervalSec = sec;
    state.autoRefresh._remaining  = sec;
    _arTick();
    _arUpdateRefreshBtnState();
}

function stopAutoRefresh(): void {
    clearTimeout(state.autoRefresh._timerId);
    clearInterval(state.autoRefresh._tickId);
    state.autoRefresh.intervalSec = 0;
    state.autoRefresh._remaining  = 0;
    state.autoRefresh._timerId    = null;
    state.autoRefresh._tickId     = null;
    _arUpdateCountdown(0);
    _arUpdateRefreshBtnState();
}

function _arTick(): void {
    const ar = state.autoRefresh;
    clearInterval(ar._tickId);
    _arUpdateCountdown(ar._remaining);
    ar._tickId = setInterval(() => {
        ar._remaining--;
        _arUpdateCountdown(ar._remaining);
        if (ar._remaining <= 0) {
            clearInterval(ar._tickId);
            ar._tickId = null;
            if (state.currentDb && state.currentTable) {
                loadTableData(state.currentDb, state.currentTable, state.page);
            }
            ar._remaining = ar.intervalSec;
            _arTick();
        }
    }, 1000);
}

function _arUpdateCountdown(sec: number): void {
    const el = document.getElementById('ar-countdown');
    if (!el) return;
    if (!sec || state.autoRefresh.intervalSec === 0) {
        el.textContent = '';
        el.style.display = 'none';
    } else {
        el.style.display = 'inline';
        el.textContent = sec + 's';
    }
}

function triggerManualRefresh(): void {
    if (!state.currentDb || !state.currentTable) return;
    if (state.autoRefresh.intervalSec > 0) {
        clearInterval(state.autoRefresh._tickId);
        state.autoRefresh._remaining = state.autoRefresh.intervalSec;
        _arTick();
    }
    loadTableData(state.currentDb, state.currentTable, state.page);
}

function _bindRefreshBtn(): void {
    const btn = document.getElementById('btn-refresh') as HTMLButtonElement;
    if (!btn) return;

    let hoverTimer: any = null;
    let dropdownEl: HTMLElement | null = null;

    function removeDropdown() {
        if (dropdownEl) { dropdownEl.remove(); dropdownEl = null; }
        clearTimeout(hoverTimer);
        hoverTimer = null;
    }

    function showDropdown() {
        if (dropdownEl) return;
        const rect = btn.getBoundingClientRect();
        const isActive = state.autoRefresh.intervalSec > 0;

        dropdownEl = document.createElement('div');
        dropdownEl.className = 'ar-dropdown';
        dropdownEl.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;z-index:9999`;

        const opts = AUTO_REFRESH_OPTIONS.map(sec => {
            const active = state.autoRefresh.intervalSec === sec;
            return `<div class="ar-option${active ? ' active' : ''}" data-sec="${sec}">Every ${sec}s</div>`;
        }).join('');

        const stopRow = isActive ? `<div class="ar-option ar-stop">Stop auto-refresh</div>` : '';

        dropdownEl.innerHTML = opts + stopRow;
        document.body.appendChild(dropdownEl);

        dropdownEl.addEventListener('mouseenter', () => clearTimeout(hoverTimer));
        dropdownEl.addEventListener('mouseleave', () => {
            hoverTimer = setTimeout(removeDropdown, 200);
        });

        dropdownEl.addEventListener('click', (e: MouseEvent) => {
            const opt = (e.target as Element).closest('[data-sec], .ar-stop') as HTMLElement;
            if (!opt) return;
            if (opt.classList.contains('ar-stop')) {
                stopAutoRefresh();
                _arUpdateRefreshBtnState();
            } else {
                const sec = parseInt(opt.dataset.sec!, 10);
                startAutoRefresh(sec);
                _arUpdateRefreshBtnState();
            }
            removeDropdown();
        });
    }

    btn.addEventListener('mouseenter', () => {
        const delay = state.autoRefresh.intervalSec > 0 ? 400 : 1000;
        hoverTimer = setTimeout(showDropdown, delay);
    });
    btn.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(removeDropdown, 200);
    });

    btn.addEventListener('click', () => {
        if (dropdownEl) { removeDropdown(); return; }
        triggerManualRefresh();
        btn.classList.add('spinning');
        setTimeout(() => btn.classList.remove('spinning'), 600);
    });

    document.addEventListener('click', (e: MouseEvent) => {
        if (dropdownEl && !dropdownEl.contains(e.target as Node) && e.target !== btn) removeDropdown();
    }, { capture: true });
}

function _arUpdateRefreshBtnState(): void {
    const btn = document.getElementById('btn-refresh') as HTMLButtonElement;
    if (!btn) return;
    const active = state.autoRefresh.intervalSec > 0;
    btn.classList.toggle('ar-active', active);
    btn.title = active ? `Auto-refresh every ${state.autoRefresh.intervalSec}s (hover to change)` : 'Refresh';
}
