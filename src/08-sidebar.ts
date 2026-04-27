// ── Sidebar collapse ──────────────────────────────────────────────────────────

const sidebar     = document.getElementById('sidebar')!;
const overlay     = document.getElementById('sidebar-overlay')!;
const mobileMenuBtn  = document.getElementById('mobile-menu-btn')!;
const sidebarToggle  = document.getElementById('sidebar-toggle')!;
const sidebarExpand  = document.getElementById('sidebar-expand')!;

sidebarToggle.addEventListener('click', () => {
    sidebar.classList.add('collapsed');
    document.body.classList.add('sidebar-collapsed');
});

sidebarExpand.addEventListener('click', () => {
    sidebar.classList.remove('collapsed');
    document.body.classList.remove('sidebar-collapsed');
});

mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.add('mobile-open');
    overlay.classList.add('visible');
});

overlay.addEventListener('click', closeMobileSidebar);

function closeMobileSidebar(): void {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('visible');
}

// ── Search ────────────────────────────────────────────────────────────────────

document.getElementById('db-search')!.addEventListener('input', function (this: HTMLInputElement) {
    const q = this.value.toLowerCase();
    if (state.currentDb) {
        const dbItem = document.querySelector(`.db-item[data-db="${CSS.escape(state.currentDb)}"]`);
        if (dbItem) {
            dbItem.querySelectorAll('.table-item').forEach((item: Element) => {
                const el   = item as HTMLElement;
                const name = (el.dataset.table || el.querySelector('.table-name')?.textContent || '').toLowerCase();
                el.style.display = name.includes(q) ? '' : 'none';
            });
        }
    } else {
        document.querySelectorAll('.db-item').forEach((item: Element) => {
            const el   = item as HTMLElement;
            const name = (el.dataset.db || '').toLowerCase();
            el.style.display = name.includes(q) ? '' : 'none';
        });
    }
});

function updateSearchContext(dbName: string | null): void {
    const input = document.getElementById('db-search') as HTMLInputElement;
    input.value = '';
    input.placeholder = dbName ? 'Search tables...' : 'Search databases...';
    document.querySelectorAll('.db-item').forEach((i: Element) => (i as HTMLElement).style.display = '');
}

// ── Database tree ─────────────────────────────────────────────────────────────

async function loadDatabases(): Promise<void> {
    const nav = document.getElementById('db-tree')!;
    nav.innerHTML = '<div class="loading-tree"><div class="spinner"></div><span>Loading databases...</span></div>';

    try {
        const data = await api('databases');
        renderDbTree(data.databases || []);
    } catch (err) {
        nav.innerHTML = '<div class="loading-tree" style="color:var(--danger)">Failed to load databases</div>';
    }
}

function renderDbTree(databases: { name: string; table_count: number }[]): void {
    const nav = document.getElementById('db-tree')!;
    nav.innerHTML = '';

    if (!databases.length) {
        nav.innerHTML = '<div class="loading-tree">No databases found</div>';
        return;
    }

    databases.forEach(db => {
        const item = document.createElement('div');
        item.className = 'db-item';
        item.dataset.db = db.name;

        item.innerHTML = `
            <div class="db-header">
                <svg class="db-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M4.5 2.5l4 3.5-4 3.5V2.5z"/>
                </svg>
                <svg class="db-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <ellipse cx="8" cy="4" rx="6" ry="2"/>
                    <path d="M2 4v2c0 1.1 2.686 2 6 2s6-.9 6-2V4"/>
                    <path d="M2 8v2c0 1.1 2.686 2 6 2s6-.9 6-2V8"/>
                    <path d="M2 12v1c0 1.1 2.686 2 6 2s6-.9 6-2v-1"/>
                </svg>
                <span class="db-name">${escHtml(db.name)}</span>
                <span class="db-count">${db.table_count ?? ''}</span>
            </div>
            <div class="db-tables" id="tables-${escAttr(db.name)}"></div>
        `;

        item.querySelector('.db-header')!.addEventListener('click', () => toggleDb(item, db.name));
        nav.appendChild(item);
    });

    if (databases.length === 1) {
        const item = nav.querySelector('.db-item') as HTMLElement;
        toggleDb(item, databases[0].name);
    }
}

async function toggleDb(item: HTMLElement, dbName: string): Promise<void> {
    const isOpen = item.classList.contains('open');

    document.querySelectorAll('.db-item.open').forEach(el => {
        if (el !== item) el.classList.remove('open');
    });

    if (isOpen) {
        item.classList.remove('open');
        state.currentDb    = null;
        state.currentTable = null;
        updateSearchContext(null);
        return;
    }

    item.classList.add('open');
    selectDatabase(dbName);

    const tablesEl = item.querySelector('.db-tables') as HTMLElement;
    if (tablesEl.dataset.loaded) return;

    tablesEl.innerHTML = '<div class="loading-tree" style="padding-left:36px"><div class="spinner"></div></div>';

    try {
        const data = await api('tables', { database: dbName });
        tablesEl.dataset.loaded = '1';
        renderTables(tablesEl, dbName, data.tables || []);
    } catch (err) {
        tablesEl.innerHTML = '<div class="loading-tree" style="color:var(--danger);padding-left:36px">Error loading tables</div>';
    }
}

function renderTables(container: HTMLElement, dbName: string, tables: { name: string }[]): void {
    container.innerHTML = '';

    if (!tables.length) {
        container.innerHTML = '<div class="table-item" style="color:var(--text-dim)">No tables</div>';
        return;
    }

    tables.forEach(t => {
        const el = document.createElement('div');
        el.className = 'table-item';
        el.dataset.table = t.name;
        el.innerHTML = `
            <svg class="table-icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H2a2 2 0 01-2-2V2zm15 2H1v3h14V4zm0 4H1v3h14V8zm0 4H1v2a1 1 0 001 1h12a1 1 0 001-1v-2z"/>
            </svg>
            <span class="table-name">${escHtml(t.name)}</span>
        `;
        el.addEventListener('click', () => {
            closeMobileSidebar();
            document.querySelectorAll('.table-item.active').forEach(e => e.classList.remove('active'));
            el.classList.add('active');
            loadTableData(dbName, t.name, 1);
        });
        container.appendChild(el);
    });
}

// ── Select database ───────────────────────────────────────────────────────────

function selectDatabase(dbName: string): void {
    updateSearchContext(dbName);
    state.currentDb    = dbName;
    state.currentTable = null;

    document.querySelectorAll('.db-header.active').forEach(e => e.classList.remove('active'));
    const header = document.querySelector(`.db-item[data-db="${CSS.escape(dbName)}"] .db-header`);
    if (header) header.classList.add('active');

    setBreadcrumb([{ label: dbName }]);
    setTopbarActions([
        { label: 'Actions ▾', dropdown: [
            { label: 'Create Table',  onClick: () => showCreateTable(dbName) },
            { label: 'Import',        onClick: () => showImportExportModal(dbName, 'import') },
            { label: 'Export',        onClick: () => showImportExportModal(dbName, 'export') },
            { label: 'Manage Tables', onClick: () => showImportExportModal(dbName, 'manage') },
        ]},
    ]);
    showDbOverview(dbName);
}

// ── DB overview ───────────────────────────────────────────────────────────────

async function showDbOverview(dbName: string): Promise<void> {
    const area = document.getElementById('content-area')!;
    area.innerHTML = `
        <div class="table-view-header">
            <div class="table-view-title">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="color:var(--accent)">
                    <ellipse cx="8" cy="4" rx="6" ry="2"/>
                    <path d="M2 4v2c0 1.1 2.686 2 6 2s6-.9 6-2V4"/>
                    <path d="M2 8v2c0 1.1 2.686 2 6 2s6-.9 6-2V8"/>
                    <path d="M2 12v1c0 1.1 2.686 2 6 2s6-.9 6-2v-1"/>
                </svg>
                ${escHtml(dbName)}
            </div>
        </div>
        <div id="overview-loading" style="display:flex;gap:10px;color:var(--text-muted);align-items:center">
            <div class="spinner"></div> Loading tables...
        </div>
        <div class="db-overview-grid" id="overview-grid" style="display:none"></div>
    `;

    try {
        const data = await api('tables', { database: dbName });
        document.getElementById('overview-loading')!.style.display = 'none';
        const grid = document.getElementById('overview-grid') as HTMLElement;
        grid.style.display = 'grid';

        if (!data.tables || !data.tables.length) {
            grid.innerHTML = '<div style="color:var(--text-muted)">No tables in this database.</div>';
            return;
        }

        data.tables.forEach((t: any) => {
            const card = document.createElement('div');
            card.className = 'db-table-card';
            card.innerHTML = `
                <div class="db-table-card-name">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style="color:var(--text-dim)">
                        <path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H2a2 2 0 01-2-2V2zm15 2H1v3h14V4zm0 4H1v3h14V8zm0 4H1v2a1 1 0 001 1h12a1 1 0 001-1v-2z"/>
                    </svg>
                    ${escHtml(t.name)}
                </div>
                <div class="db-table-card-info">${t.rows != null ? t.rows + ' rows' : ''}</div>
            `;
            card.addEventListener('click', () => loadTableData(dbName, t.name, 1));
            grid.appendChild(card);
        });
    } catch (err: any) {
        document.getElementById('overview-loading')!.textContent = 'Error: ' + err.message;
    }
}
