// ── Tab management ────────────────────────────────────────────────────────────

let _tabCounter = 0;

function generateTabId(): string {
    return 'tab-' + (++_tabCounter);
}

function saveCurrentTabState(): void {
    if (!state.activeTabId || !state.currentTable) return;
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab) return;

    const area = document.getElementById('content-area')!;
    tab.html        = area.innerHTML;
    tab.scrollTop   = area.scrollTop;
    tab.page        = state.page;
    tab.pageSize    = state.pageSize;
    tab.totalRows   = state.totalRows;
    tab.filters     = state.filters.map(f => ({ ...f }));
    tab.sort        = state.sort.map(s => ({ ...s }));
    tab.lastSql     = state.lastSql;
    tab.sqlPanelOpen = state.sqlPanelOpen;
    tab.colMeta     = { ...state.colMeta };
    tab.selection   = { mode: state.selection.mode, pageRows: [...state.selection.pageRows] };
}

function findTab(dbName: string, tableName: string): TabState | undefined {
    return state.tabs.find(t => t.dbName === dbName && t.tableName === tableName);
}

function createTab(dbName: string, tableName: string): TabState {
    const tab: TabState = {
        id: generateTabId(),
        dbName, tableName,
        page: 1, pageSize: 50, totalRows: 0,
        filters: [], sort: [],
        lastSql: null, sqlPanelOpen: false,
        colMeta: {}, selection: { mode: 'none', pageRows: [] },
        html: '', scrollTop: 0,
    };
    state.tabs.push(tab);
    return tab;
}

function closeTab(tabId: string): void {
    const idx = state.tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;

    state.tabs.splice(idx, 1);

    if (state.activeTabId === tabId) {
        state.activeTabId = null;
        if (state.tabs.length > 0) {
            const nextTab = state.tabs[Math.min(idx, state.tabs.length - 1)];
            restoreTab(nextTab);
        } else {
            state.currentDb = null;
            state.currentTable = null;
            const area = document.getElementById('content-area')!;
            area.innerHTML = `
                <div class="welcome-screen">
                    <div class="welcome-icon">
                        <svg width="64" height="64" viewBox="0 0 48 48" fill="none">
                            <ellipse cx="24" cy="12" rx="18" ry="6" fill="#4f8ef7" opacity=".2"/>
                            <path d="M6 12v8c0 3.314 8.059 6 18 6s18-2.686 18-6v-8" stroke="#4f8ef7" stroke-width="2" fill="none" opacity=".4"/>
                            <path d="M6 20v8c0 3.314 8.059 6 18 6s18-2.686 18-6v-8" stroke="#4f8ef7" stroke-width="2" fill="none" opacity=".7"/>
                            <path d="M6 28v8c0 3.314 8.059 6 18 6s18-2.686 18-6v-8" stroke="#4f8ef7" stroke-width="2" fill="none"/>
                        </svg>
                    </div>
                    <h2>Select a database</h2>
                    <p>Choose a database from the left panel to start browsing tables and data.</p>
                </div>`;
            setBreadcrumb([{ label: 'Dashboard' }]);
            setTopbarActions([]);
        }
    }

    renderTabBar();
}

function restoreTab(tab: TabState): void {
    state.activeTabId   = tab.id;
    state.currentDb     = tab.dbName;
    state.currentTable  = tab.tableName;
    state.page          = tab.page;
    state.pageSize      = tab.pageSize;
    state.totalRows     = tab.totalRows;
    state.filters       = tab.filters.map(f => ({ ...f }));
    state.sort          = tab.sort.map(s => ({ ...s }));
    state.lastSql       = tab.lastSql;
    state.sqlPanelOpen  = tab.sqlPanelOpen;
    state.colMeta       = { ...tab.colMeta };
    state.selection     = { mode: tab.selection.mode, pageRows: [...tab.selection.pageRows] };

    // Restore sidebar active state before triggering load
    document.querySelectorAll('.table-item.active').forEach(e => e.classList.remove('active'));
    const tEl = document.querySelector(`.db-item[data-db="${CSS.escape(tab.dbName)}"] .table-item[data-table="${CSS.escape(tab.tableName)}"]`);
    if (tEl) tEl.classList.add('active');

    renderTabBar();

    // Re-fetch data to restore all live listeners (insert, edit, sort, pagination).
    // State (filters, sort, page) is already restored above so the view looks identical.
    _restoringTab = true;
    loadTableData(tab.dbName, tab.tableName, tab.page);
}

// ── Tab bar rendering ─────────────────────────────────────────────────────────

function renderTabBar(): void {
    const bar = document.getElementById('tab-bar')!;

    if (state.tabs.length === 0) {
        bar.innerHTML = '';
        bar.style.display = 'none';
        return;
    }

    bar.style.display = 'flex';
    bar.innerHTML = state.tabs.map(tab => `
        <div class="tab-item${tab.id === state.activeTabId ? ' active' : ''}" data-tab-id="${escAttr(tab.id)}">
            <svg class="tab-icon" width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H2a2 2 0 01-2-2V2zm15 2H1v3h14V4zm0 4H1v3h14V8zm0 4H1v2a1 1 0 001 1h12a1 1 0 001-1v-2z"/>
            </svg>
            <span class="tab-label" title="${escAttr(tab.dbName + '.' + tab.tableName)}">${escHtml(tab.tableName)}</span>
            <span class="tab-db">${escHtml(tab.dbName)}</span>
            <button class="tab-close" data-tab-id="${escAttr(tab.id)}" title="Close tab">×</button>
        </div>
    `).join('');

    bar.querySelectorAll('.tab-item').forEach(el => {
        el.addEventListener('click', (e: Event) => {
            if ((e.target as Element).classList.contains('tab-close')) return;
            const tabId = (el as HTMLElement).dataset.tabId!;
            if (tabId === state.activeTabId) return;
            saveCurrentTabState();
            const tab = state.tabs.find(t => t.id === tabId)!;
            restoreTab(tab);
        });
    });

    bar.querySelectorAll('.tab-close').forEach(btn => {
        btn.addEventListener('click', (e: Event) => {
            e.stopPropagation();
            closeTab((btn as HTMLElement).dataset.tabId!);
        });
    });
}

// ── Hook into loadTableData ───────────────────────────────────────────────────

let _restoringTab = false;

function tabsBeforeLoad(dbName: string, tableName: string): { isExisting: boolean; tab: TabState } {
    if (!_restoringTab) saveCurrentTabState();

    let tab = findTab(dbName, tableName);
    const isExisting = !!tab;
    if (!tab) tab = createTab(dbName, tableName);

    state.activeTabId  = tab.id;
    renderTabBar();

    return { isExisting, tab };
}

function tabsAfterLoad(): void {
    _restoringTab = false;
    renderTabBar();
}
