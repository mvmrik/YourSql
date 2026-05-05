// ── Tab management ────────────────────────────────────────────────────────────

let _tabCounter = 0;

function generateTabId(): string {
    return 'tab-' + (++_tabCounter);
}

// ── Persist tabs to localStorage ──────────────────────────────────────────────

const TABS_STORAGE_KEY = 'yoursql_tabs';

function persistTabs(): void {
    const data = {
        tabs: state.tabs.map(t => ({ dbName: t.dbName, tableName: t.tableName })),
        activeDb:    state.tabs.find(t => t.id === state.activeTabId)?.dbName    ?? null,
        activeTable: state.tabs.find(t => t.id === state.activeTabId)?.tableName ?? null,
    };
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(data));
}

async function loadPersistedTabs(): Promise<void> {
    try {
        const raw = localStorage.getItem(TABS_STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!Array.isArray(data.tabs) || !data.tabs.length) return;

        // Create ghost tabs (no data loaded yet)
        data.tabs.forEach((t: { dbName: string; tableName: string }) => {
            if (!findTab(t.dbName, t.tableName)) createTab(t.dbName, t.tableName);
        });

        // Activate the previously active tab and load its data
        const activeTab = state.tabs.find(
            t => t.dbName === data.activeDb && t.tableName === data.activeTable
        ) ?? state.tabs[0];

        if (activeTab) {
            state.activeTabId = activeTab.id;
            renderTabBar();

            // Expand the DB in the sidebar and load its tables so the active
            // table item can be rendered and marked as active
            await expandSidebarToTable(activeTab.dbName, activeTab.tableName);

            _restoringTab = true;
            loadTableData(activeTab.dbName, activeTab.tableName, 1);
        }
    } catch {
        localStorage.removeItem(TABS_STORAGE_KEY);
    }
}

// ── Tab state ─────────────────────────────────────────────────────────────────

function saveCurrentTabState(): void {
    if (!state.activeTabId || !state.currentTable) return;
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab) return;

    const area = document.getElementById('content-area')!;
    tab.html         = area.innerHTML;
    tab.scrollTop    = area.scrollTop;
    tab.page         = state.page;
    tab.pageSize     = state.pageSize;
    tab.totalRows    = state.totalRows;
    tab.filters      = state.filters.map(f => ({ ...f }));
    tab.sort         = state.sort.map(s => ({ ...s }));
    tab.lastSql      = state.lastSql;
    tab.sqlPanelOpen = state.sqlPanelOpen;
    tab.colMeta      = { ...state.colMeta };
    tab.selection    = { mode: state.selection.mode, pageRows: [...state.selection.pageRows] };
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
    persistTabs();

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
    state.activeTabId  = tab.id;
    state.currentDb    = tab.dbName;
    state.currentTable = tab.tableName;
    state.page         = tab.page;
    state.pageSize     = tab.pageSize;
    state.totalRows    = tab.totalRows;
    state.filters      = tab.filters.map(f => ({ ...f }));
    state.sort         = tab.sort.map(s => ({ ...s }));
    state.lastSql      = tab.lastSql;
    state.sqlPanelOpen = tab.sqlPanelOpen;
    state.colMeta      = { ...tab.colMeta };
    state.selection    = { mode: tab.selection.mode, pageRows: [...tab.selection.pageRows] };

    persistTabs();
    renderTabBar();

    expandSidebarToTable(tab.dbName, tab.tableName);

    _restoringTab = true;
    loadTableData(tab.dbName, tab.tableName, tab.page);
}

// ── Tab context menu ──────────────────────────────────────────────────────────

function showTabContextMenu(e: MouseEvent, tabId: string): void {
    e.preventDefault();
    removeTabContextMenu();

    const idx = state.tabs.findIndex(t => t.id === tabId);
    const hasOthers = state.tabs.length > 1;
    const hasRight  = idx < state.tabs.length - 1;

    const menu = document.createElement('div');
    menu.id = 'tab-context-menu';
    menu.className = 'tab-context-menu';
    menu.innerHTML = `
        <div class="tab-ctx-item" data-action="close">Close</div>
        <div class="tab-ctx-item${hasOthers ? '' : ' disabled'}" data-action="close-others">Close Others</div>
        <div class="tab-ctx-item${hasRight ? '' : ' disabled'}" data-action="close-right">Close to the Right</div>
        <div class="tab-ctx-divider"></div>
        <div class="tab-ctx-item" data-action="close-all">Close All</div>
    `;

    menu.style.left = e.clientX + 'px';
    menu.style.top  = e.clientY + 'px';
    document.body.appendChild(menu);

    menu.querySelectorAll('.tab-ctx-item:not(.disabled)').forEach(item => {
        item.addEventListener('click', () => {
            const action = (item as HTMLElement).dataset.action!;
            removeTabContextMenu();

            if (action === 'close') {
                closeTab(tabId);
            } else if (action === 'close-others') {
                state.tabs.filter(t => t.id !== tabId).map(t => t.id).forEach(id => closeTab(id));
            } else if (action === 'close-right') {
                state.tabs.slice(idx + 1).map(t => t.id).forEach(id => closeTab(id));
            } else if (action === 'close-all') {
                [...state.tabs].map(t => t.id).forEach(id => closeTab(id));
            }
        });
    });

    setTimeout(() => document.addEventListener('click', removeTabContextMenu, { once: true }), 0);
}

function removeTabContextMenu(): void {
    document.getElementById('tab-context-menu')?.remove();
}

// ── Drag & drop ───────────────────────────────────────────────────────────────

let _dragTabId: string | null = null;

function setupTabDrag(el: HTMLElement, tabId: string): void {
    el.draggable = true;

    el.addEventListener('dragstart', (e: DragEvent) => {
        _dragTabId = tabId;
        el.classList.add('dragging');
        e.dataTransfer!.effectAllowed = 'move';
    });

    el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('drag-over'));
        _dragTabId = null;
    });

    el.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        if (!_dragTabId || _dragTabId === tabId) return;
        e.dataTransfer!.dropEffect = 'move';
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('drag-over'));
        el.classList.add('drag-over');
    });

    el.addEventListener('dragleave', () => {
        el.classList.remove('drag-over');
    });

    el.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        if (!_dragTabId || _dragTabId === tabId) return;

        const fromIdx = state.tabs.findIndex(t => t.id === _dragTabId);
        const toIdx   = state.tabs.findIndex(t => t.id === tabId);
        if (fromIdx === -1 || toIdx === -1) return;

        const [moved] = state.tabs.splice(fromIdx, 1);
        state.tabs.splice(toIdx, 0, moved);

        persistTabs();
        renderTabBar();
    });
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

    bar.querySelectorAll<HTMLElement>('.tab-item').forEach(el => {
        const tabId = el.dataset.tabId!;

        el.addEventListener('click', (e: Event) => {
            if ((e.target as Element).classList.contains('tab-close')) return;
            if (tabId === state.activeTabId) return;
            saveCurrentTabState();
            const tab = state.tabs.find(t => t.id === tabId)!;
            restoreTab(tab);
        });

        el.addEventListener('contextmenu', (e: Event) => {
            showTabContextMenu(e as MouseEvent, tabId);
        });

        setupTabDrag(el, tabId);
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

    state.activeTabId = tab.id;
    persistTabs();
    renderTabBar();

    return { isExisting, tab };
}

function tabsAfterLoad(): void {
    _restoringTab = false;
    renderTabBar();
}
