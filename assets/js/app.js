// ── State ─────────────────────────────────────────────────────────────────────
const state = {
    currentDb: null,
    currentTable: null,
    colMeta: {},
    page: 1,
    pageSize: 50,
    totalRows: 0,
    filters: [],
    sort: [],
    lastSql: null,       // last SQL string shown in panel
    sqlPanelOpen: false,
    selection: {
        mode: 'none',
        pageRows: [],
    },
    autoRefresh: {
        intervalSec: 0,   // 0 = off
        _timerId:    null,
        _remaining:  0,
        _tickId:     null,
    },
};

// ── Auto-refresh ──────────────────────────────────────────────────────────────
const AUTO_REFRESH_OPTIONS = [1, 5, 30, 60];

function startAutoRefresh(sec) {
    stopAutoRefresh();
    state.autoRefresh.intervalSec = sec;
    state.autoRefresh._remaining  = sec;
    _arTick();
    _arUpdateRefreshBtnState();
}

function stopAutoRefresh() {
    clearTimeout(state.autoRefresh._timerId);
    clearInterval(state.autoRefresh._tickId);
    state.autoRefresh.intervalSec = 0;
    state.autoRefresh._remaining  = 0;
    state.autoRefresh._timerId    = null;
    state.autoRefresh._tickId     = null;
    _arUpdateCountdown(0);
    _arUpdateRefreshBtnState();
}

function _arTick() {
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

function _arUpdateCountdown(sec) {
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

function triggerManualRefresh() {
    if (!state.currentDb || !state.currentTable) return;
    if (state.autoRefresh.intervalSec > 0) {
        clearInterval(state.autoRefresh._tickId);
        state.autoRefresh._remaining = state.autoRefresh.intervalSec;
        _arTick();
    }
    loadTableData(state.currentDb, state.currentTable, state.page);
}

function _bindRefreshBtn() {
    const btn = document.getElementById('btn-refresh');
    if (!btn) return;

    let hoverTimer = null;
    let dropdownEl = null;

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

        const stopRow = isActive
            ? `<div class="ar-option ar-stop">Stop auto-refresh</div>`
            : '';

        dropdownEl.innerHTML = opts + stopRow;
        document.body.appendChild(dropdownEl);

        dropdownEl.addEventListener('mouseenter', () => clearTimeout(hoverTimer));
        dropdownEl.addEventListener('mouseleave', () => {
            hoverTimer = setTimeout(removeDropdown, 200);
        });

        dropdownEl.addEventListener('click', e => {
            const opt = e.target.closest('[data-sec], .ar-stop');
            if (!opt) return;
            if (opt.classList.contains('ar-stop')) {
                stopAutoRefresh();
                _arUpdateRefreshBtnState();
            } else {
                const sec = parseInt(opt.dataset.sec, 10);
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

    btn.addEventListener('click', (e) => {
        // If dropdown is open — it was a hover action, ignore click
        if (dropdownEl) { removeDropdown(); return; }
        triggerManualRefresh();
        // spin animation
        btn.classList.add('spinning');
        setTimeout(() => btn.classList.remove('spinning'), 600);
    });

    // close on outside click
    document.addEventListener('click', (e) => {
        if (dropdownEl && !dropdownEl.contains(e.target) && e.target !== btn) removeDropdown();
    }, { capture: true });
}

function _arUpdateRefreshBtnState() {
    const btn = document.getElementById('btn-refresh');
    if (!btn) return;
    const active = state.autoRefresh.intervalSec > 0;
    btn.classList.toggle('ar-active', active);
    btn.title = active ? `Auto-refresh every ${state.autoRefresh.intervalSec}s (hover to change)` : 'Refresh';
}

// ── API helper ────────────────────────────────────────────────────────────────
async function api(endpoint, params = {}) {
    const url = 'api/' + endpoint + '.php';
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });

    if (res.status === 401) {
        window.location.href = 'index.html';
        return null;
    }

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Unknown error');
    if (data.sql) setSqlPanel(data.sql);
    return data;
}

// ── Toast notifications ───────────────────────────────────────────────────────
function toast(msg, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

// ── Sidebar collapse ──────────────────────────────────────────────────────────
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebarToggle = document.getElementById('sidebar-toggle');

sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.add('mobile-open');
    overlay.classList.add('visible');
});

overlay.addEventListener('click', closeMobileSidebar);

function closeMobileSidebar() {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('visible');
}

// ── Disconnect ────────────────────────────────────────────────────────────────
document.getElementById('btn-disconnect').addEventListener('click', async () => {
    await fetch('api/disconnect.php', { method: 'POST' });
    window.location.href = 'index.html';
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
    try {
        const data = await api('session');
        if (!data) return;

        document.getElementById('server-label').textContent =
            (data.host || 'localhost') + (data.port && data.port !== 3306 ? ':' + data.port : '');

        await loadDatabases();
    } catch (err) {
        window.location.href = 'index.html';
    }
}

// ── Database tree ─────────────────────────────────────────────────────────────
async function loadDatabases() {
    const nav = document.getElementById('db-tree');
    nav.innerHTML = '<div class="loading-tree"><div class="spinner"></div><span>Loading databases...</span></div>';

    try {
        const data = await api('databases');
        renderDbTree(data.databases || []);
    } catch (err) {
        nav.innerHTML = '<div class="loading-tree" style="color:var(--danger)">Failed to load databases</div>';
    }
}

function renderDbTree(databases) {
    const nav = document.getElementById('db-tree');
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

        const header = item.querySelector('.db-header');
        header.addEventListener('click', () => toggleDb(item, db.name));

        nav.appendChild(item);
    });

    // Auto-open if only one db or session has a db
    if (databases.length === 1) {
        const item = nav.querySelector('.db-item');
        toggleDb(item, databases[0].name);
    }
}

async function toggleDb(item, dbName) {
    const isOpen = item.classList.contains('open');

    // Close others
    document.querySelectorAll('.db-item.open').forEach(el => {
        if (el !== item) el.classList.remove('open');
    });

    if (isOpen) {
        item.classList.remove('open');
        return;
    }

    item.classList.add('open');
    selectDatabase(dbName);

    const tablesEl = item.querySelector('.db-tables');
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

function renderTables(container, dbName, tables) {
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

// ── Search filter ─────────────────────────────────────────────────────────────
document.getElementById('db-search').addEventListener('input', function () {
    const q = this.value.toLowerCase();
    document.querySelectorAll('.db-item').forEach(item => {
        const name = (item.dataset.db || '').toLowerCase();
        item.style.display = name.includes(q) ? '' : 'none';
    });
});

// ── Select database ───────────────────────────────────────────────────────────
function selectDatabase(dbName) {
    state.currentDb = dbName;
    state.currentTable = null;

    document.querySelectorAll('.db-header.active').forEach(e => e.classList.remove('active'));
    const header = document.querySelector(`.db-item[data-db="${CSS.escape(dbName)}"] .db-header`);
    if (header) header.classList.add('active');

    setBreadcrumb([{ label: dbName }]);
    setTopbarActions([
        { label: 'Actions ▾', dropdown: [
            { label: 'Create Table', onClick: () => showCreateTable(dbName) },
        ]},
    ]);
    showDbOverview(dbName);
}

// ── DB overview ───────────────────────────────────────────────────────────────
async function showDbOverview(dbName) {
    const area = document.getElementById('content-area');
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
        document.getElementById('overview-loading').style.display = 'none';
        const grid = document.getElementById('overview-grid');
        grid.style.display = 'grid';

        if (!data.tables || !data.tables.length) {
            grid.innerHTML = '<div style="color:var(--text-muted)">No tables in this database.</div>';
            return;
        }

        data.tables.forEach(t => {
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
    } catch (err) {
        document.getElementById('overview-loading').textContent = 'Error: ' + err.message;
    }
}

// ── Table data ────────────────────────────────────────────────────────────────
async function loadTableData(dbName, tableName, page = 1, opts = {}) {
    // opts.resetFilters = true when navigating to a new table
    const isNewTable = dbName !== state.currentDb || tableName !== state.currentTable;
    if (isNewTable) stopAutoRefresh();

    state.currentDb    = dbName;
    state.currentTable = tableName;
    state.page         = page;

    if (isNewTable || opts.resetFilters) {
        state.filters    = [];
        state.sort       = [];
        state.pageSize   = 50;
        state.lastSql    = null;
        state.sqlPanelOpen = false;
    }

    setBreadcrumb([
        { label: dbName, onClick: () => selectDatabase(dbName) },
        { label: tableName, active: true },
    ]);

    setTopbarActions([
        { label: 'Structure', onClick: () => loadTableStructure(dbName, tableName) },
        { label: 'Actions ▾', dropdown: [
            { label: 'Create Table', onClick: () => showCreateTable(dbName) },
            { label: 'SQL Query', onClick: () => {
                state.lastSql = null;
                const ta = document.getElementById('sql-panel-textarea');
                if (ta) ta.value = '';
                const res = document.getElementById('sql-result');
                if (res) { res.className = 'sql-result hidden'; res.innerHTML = ''; }
                toggleSqlPanel(true);
            }},
        ]},
    ]);

    const area = document.getElementById('content-area');

    // On new table or first load build the full shell; on filter re-runs keep the filter bar
    const isFirstRender = isNewTable || opts.resetFilters || !document.getElementById('filter-bar');
    if (isFirstRender) {
        area.innerHTML = `
            <div class="table-view-header">
                <div class="table-view-title">
                    ${escHtml(tableName)}
                    <button id="sql-badge-btn" class="sql-badge-btn hidden" title="Show last SQL">SQL</button>
                    <button id="btn-refresh" class="btn-refresh" title="Refresh">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M11.534 7h3.932a.25.25 0 01.192.41l-1.966 2.36a.25.25 0 01-.384 0l-1.966-2.36a.25.25 0 01.192-.41zm-11 2h3.932a.25.25 0 00.192-.41L2.692 6.23a.25.25 0 00-.384 0L.342 8.59A.25.25 0 00.534 9z"/>
                            <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 11-.771-.636A6.002 6.002 0 0113.917 7H12.9A5.002 5.002 0 008 3zM3.1 9a5.002 5.002 0 008.757 2.182.5.5 0 11.771.636A6.002 6.002 0 012.083 9H3.1z"/>
                        </svg>
                    </button>
                    <span id="ar-countdown" class="ar-countdown" style="display:none"></span>
                </div>
                <div class="table-view-actions" id="tva"></div>
            </div>
            <div id="sql-panel-wrap"></div>
            <div id="filter-bar"></div>
            <div id="table-loading" style="display:flex;gap:10px;color:var(--text-muted);align-items:center;padding:8px 0">
                <div class="spinner"></div> Loading...
            </div>
            <div id="table-content" style="display:none"></div>
        `;
        renderSqlPanel(document.getElementById('sql-panel-wrap'));
        document.getElementById('sql-badge-btn').addEventListener('click', () => toggleSqlPanel());
        _bindRefreshBtn();
    } else {
        updateSqlBadgeBtn();
    }

    // Show spinner
    if (!isFirstRender) {
        const tc = document.getElementById('table-content');
        if (tc) tc.style.display = 'none';
        let tl = document.getElementById('table-loading');
        if (!tl) {
            tl = document.createElement('div');
            tl.id = 'table-loading';
            tl.style.cssText = 'display:flex;gap:10px;color:var(--text-muted);align-items:center;padding:8px 0';
            area.insertBefore(tl, document.getElementById('table-content'));
        }
        tl.innerHTML = '<div class="spinner"></div> Loading...';
        tl.style.display = 'flex';
    }

    try {
        // Fetch structure only on first render
        let colMeta = state.colMeta;
        const promises = [
            api('table_data', {
                database:  dbName,
                table:     tableName,
                page,
                page_size: state.pageSize,
                filters:   state.filters,
                sort:      state.sort,
            }),
        ];
        if (isFirstRender || !Object.keys(colMeta).length) {
            promises.push(api('table_structure', { database: dbName, table: tableName }));
        }

        const results = await Promise.all(promises);
        const dataRes  = results[0];
        const structRes = results[1] || null;

        state.totalRows = dataRes.total;
        state.selection = { mode: 'none', pageRows: [] };

        if (structRes) {
            const cm = {};
            (structRes.structure || []).forEach(row => {
                const parsed = parseColumnDef(row);
                cm[parsed.name] = parsed;
            });
            state.colMeta = cm;
            colMeta = cm;
        }

        document.getElementById('table-loading').style.display = 'none';
        const content = document.getElementById('table-content');
        content.style.display = 'block';
        content.innerHTML = '';

        renderFilterBar(document.getElementById('filter-bar'), dataRes.columns || [], colMeta);
        renderTableData(content, dataRes, colMeta);
    } catch (err) {
        const tl = document.getElementById('table-loading');
        if (tl) tl.innerHTML = `<span style="color:var(--danger)">${escHtml(err.message)}</span>`;
    }
}

// ── Filter bar ────────────────────────────────────────────────────────────────
const FILTER_OPS = ['=','!=','<','>','<=','>=','LIKE','NOT LIKE','LIKE %%','REGEXP','NOT REGEXP','IN','NOT IN','IS NULL','IS NOT NULL'];
const OPS_NO_VALUE = new Set(['IS NULL','IS NOT NULL']);

function renderFilterBar(container, columns, colMeta) {
    renderFilterRows(container, columns, colMeta);
}

function renderFilterRows(container, columns, colMeta) {
    container.innerHTML = '';

    if (!state.filters.length && !state.sort.length) {
        container.innerHTML = `<div class="filter-bar-empty">Click a column header to add a filter</div>`;
        return;
    }

    const bar = document.createElement('div');
    bar.className = 'filter-bar-inner';

    // ── Filter rows ──
    if (state.filters.length) {
        const filterSection = document.createElement('div');
        filterSection.className = 'filter-section';

        state.filters.forEach((f, idx) => {
            const row = buildFilterRow(f, idx, columns, colMeta);
            filterSection.appendChild(row);
        });
        bar.appendChild(filterSection);
    }

    // ── Sort section ──
    const sortSection = document.createElement('div');
    sortSection.className = 'filter-sort-section';

    const sortLabel = document.createElement('span');
    sortLabel.className = 'filter-label';
    sortLabel.textContent = 'Sort';
    sortSection.appendChild(sortLabel);

    const sortRows = document.createElement('div');
    sortRows.className = 'filter-sort-rows';
    sortSection.appendChild(sortRows);

    const sortList = state.sort.length ? [...state.sort] : [];

    const renderSortRows = () => {
        sortRows.innerHTML = '';
        sortList.forEach((s, i) => {
            const sg = document.createElement('div');
            sg.className = 'sort-group';

            const colSel = document.createElement('select');
            colSel.className = 'tbl-input tbl-select filter-sort-col';
            colSel.innerHTML = `<option value="">— none —</option>` + columns.map(c =>
                `<option value="${escAttr(c)}"${s.col === c ? ' selected' : ''}>${escHtml(c)}</option>`
            ).join('');

            const dirSel = document.createElement('select');
            dirSel.className = 'tbl-input tbl-select filter-sort-dir';
            dirSel.innerHTML = `<option value="ASC"${s.dir !== 'DESC' ? ' selected' : ''}>ASC</option>
                                <option value="DESC"${s.dir === 'DESC' ? ' selected' : ''}>DESC</option>`;

            colSel.addEventListener('change', () => {
                sortList[i].col = colSel.value;
                if (!colSel.value) {
                    sortList.splice(i, 1);
                    renderSortRows();
                }
                state.sort = sortList.filter(s => s.col);
                runSearch();
            });
            dirSel.addEventListener('change', () => {
                sortList[i].dir = dirSel.value;
                state.sort = sortList.filter(s => s.col);
                runSearch();
            });

            // Remove button for this sort level
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-filter-remove';
            removeBtn.title = 'Remove sort';
            removeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
            </svg>`;
            removeBtn.addEventListener('click', () => {
                sortList.splice(i, 1);
                state.sort = [...sortList];
                renderSortRows();
                runSearch();
            });

            sg.appendChild(colSel);
            sg.appendChild(dirSel);
            sg.appendChild(removeBtn);
            sortRows.appendChild(sg);
        });

        // "+ add sort" always at the end
        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-default btn-sm filter-add-sort';
        addBtn.textContent = '+ add sort';
        addBtn.addEventListener('click', () => {
            sortList.push({ col: '', dir: 'ASC' });
            renderSortRows();
            // focus new col select
            const sels = sortRows.querySelectorAll('.filter-sort-col');
            sels[sels.length - 1]?.focus();
        });
        sortRows.appendChild(addBtn);
    };

    renderSortRows();
    bar.appendChild(sortSection);

    // ── Bottom row: Limit + Buttons ──
    const bottomRow = document.createElement('div');
    bottomRow.className = 'filter-bottom-row';

    // Limit
    const limitWrap = document.createElement('div');
    limitWrap.className = 'filter-limit-wrap';
    limitWrap.innerHTML = `<span class="filter-label">Limit</span>`;
    const limitInput = document.createElement('input');
    limitInput.type = 'number'; limitInput.min = '1'; limitInput.max = '10000'; limitInput.step = '1';
    limitInput.className = 'tbl-input filter-limit-input';
    limitInput.value = state.pageSize;
    limitInput.addEventListener('change', () => {
        state.pageSize = Math.max(1, parseInt(limitInput.value) || 50);
        runSearch();
    });
    limitWrap.appendChild(limitInput);
    bottomRow.appendChild(limitWrap);

    const searchBtn = document.createElement('button');
    searchBtn.className = 'btn btn-accent btn-sm';
    searchBtn.textContent = 'Search';
    searchBtn.addEventListener('click', runSearch);
    bottomRow.appendChild(searchBtn);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-default btn-sm';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', () => {
        state.filters  = [];
        state.sort     = [];
        state.pageSize = 50;
        runSearch();
    });
    bottomRow.appendChild(resetBtn);

    bar.appendChild(bottomRow);
    container.appendChild(bar);
}

function buildFilterRow(f, idx, columns, colMeta) {
    const row = document.createElement('div');
    row.className = 'filter-row';

    // Column select
    const colSel = document.createElement('select');
    colSel.className = 'tbl-input tbl-select filter-col-select';
    colSel.innerHTML = columns.map(c =>
        `<option value="${escAttr(c)}"${f.col === c ? ' selected' : ''}>${escHtml(c)}</option>`
    ).join('');

    // Op select
    const opSel = document.createElement('select');
    opSel.className = 'tbl-input tbl-select filter-op-select';
    opSel.innerHTML = FILTER_OPS.map(op =>
        `<option${f.op === op ? ' selected' : ''}>${escHtml(op)}</option>`
    ).join('');

    // Value input
    const valWrap = document.createElement('div');
    valWrap.className = 'filter-val-wrap';

    const buildValInput = (op, currentVal) => {
        valWrap.innerHTML = '';
        if (OPS_NO_VALUE.has(op)) return;
        const meta = colMeta[colSel.value] || {};
        const inp = buildCellInput(meta, currentVal ?? '', true);
        inp.className = 'tbl-input filter-val-input';
        inp.placeholder = 'value';
        if (op === 'IN' || op === 'NOT IN') inp.placeholder = '1,2,3';
        if (op === 'LIKE %%') inp.placeholder = 'search term';
        // Enter triggers search
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });
        valWrap.appendChild(inp);
    };

    buildValInput(f.op, f.val);

    colSel.addEventListener('change', () => {
        state.filters[idx].col = colSel.value;
        buildValInput(opSel.value, '');
    });
    opSel.addEventListener('change', () => {
        state.filters[idx].op = opSel.value;
        buildValInput(opSel.value, valWrap.querySelector('.filter-val-input')?.value ?? '');
    });
    valWrap.addEventListener('input', (e) => {
        if (e.target.classList.contains('filter-val-input')) {
            state.filters[idx].val = e.target.value;
        }
    });
    valWrap.addEventListener('change', (e) => {
        if (e.target.classList.contains('filter-val-input')) {
            state.filters[idx].val = e.target.value;
        }
    });

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-filter-remove';
    removeBtn.title = 'Remove filter';
    removeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
    </svg>`;
    removeBtn.addEventListener('click', () => {
        state.filters.splice(idx, 1);
        runSearch();
    });

    row.appendChild(colSel);
    row.appendChild(opSel);
    row.appendChild(valWrap);
    row.appendChild(removeBtn);
    return row;
}

function refreshFilterBar(columns, colMeta) {
    const container = document.getElementById('filter-bar');
    if (container) renderFilterRows(container, columns, colMeta);
}

function addFilter(col) {
    // Don't add duplicate col filter, just highlight existing
    const existing = state.filters.find(f => f.col === col);
    if (existing) {
        // Focus the value input for that filter
        const bar = document.getElementById('filter-bar');
        const rows = bar?.querySelectorAll('.filter-row');
        if (rows) {
            const idx = state.filters.indexOf(existing);
            rows[idx]?.querySelector('.filter-val-input')?.focus();
        }
        return;
    }

    const meta = state.colMeta[col] || {};
    const defaultOp = (meta.baseType && ['TINYINT','SMALLINT','MEDIUMINT','INT','BIGINT','FLOAT','DOUBLE','DECIMAL','NUMERIC'].includes(meta.baseType)) ? '=' : 'LIKE';
    state.filters.push({ col, op: defaultOp, val: '' });

    // If no sort yet, default sort to this column
    if (!state.sort.length) state.sort = [{ col, dir: 'ASC' }];

    refreshFilterBar(Object.keys(state.colMeta), state.colMeta);

    // Focus new value input
    const bar = document.getElementById('filter-bar');
    const rows = bar?.querySelectorAll('.filter-row');
    if (rows?.length) rows[rows.length - 1].querySelector('.filter-val-input')?.focus();
}

function runSearch() {
    // Collect current val from DOM before re-render
    const bar = document.getElementById('filter-bar');
    bar?.querySelectorAll('.filter-row').forEach((row, idx) => {
        const val = row.querySelector('.filter-val-input')?.value ?? '';
        if (state.filters[idx]) state.filters[idx].val = val;
    });

    loadTableData(state.currentDb, state.currentTable, 1);
}

function renderTableData(container, data, colMeta = {}) {
    const { columns, rows, total, page, page_size } = data;

    if (!columns || !columns.length) {
        container.innerHTML = '<div class="table-empty">No columns found.</div>';
        return;
    }

    const totalPages = Math.ceil(total / page_size);

    const wrap = document.createElement('div');
    wrap.className = 'data-table-wrap';

    const table = document.createElement('table');
    table.className = 'data-table';

    // ── Head ──
    const thead = document.createElement('thead');
    const thRow = document.createElement('tr');

    // Header checkbox cell with dropdown
    const thCheck = document.createElement('th');
    thCheck.className = 'td-check-col';
    thCheck.innerHTML = `
        <div class="hdr-check-wrap">
            <input type="checkbox" id="hdr-checkbox" class="tbl-check" title="Select page">
            <div class="hdr-check-dropdown" id="hdr-check-dropdown">
                <button class="topbar-dropdown-item" id="sel-page-btn">Select this page</button>
                <button class="topbar-dropdown-item" id="sel-none-btn">Deselect all</button>
                ${totalPages > 1 ? `<div class="hdr-dropdown-sep"></div><button class="topbar-dropdown-item" id="sel-all-btn">Select whole result <span class="badge">${total}</span></button>` : ''}
            </div>
        </div>`;
    thRow.appendChild(thCheck);

    const thEdit = document.createElement('th');
    thEdit.className = 'td-edit-col';
    thEdit.innerHTML = `<button class="btn-insert-row" id="btn-insert-row" title="Insert new row">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
        </svg>
    </button>`;
    thRow.appendChild(thEdit);

    columns.forEach(c => {
        const th = document.createElement('th');
        th.className = 'th-sortable';

        const hasFilter = state.filters.some(f => f.col === c);
        const sortEntry = state.sort.find(s => s.col === c);
        const sortIdx   = state.sort.findIndex(s => s.col === c);

        const label = document.createElement('span');
        label.className = 'th-label' + (hasFilter ? ' th-filtered' : '');
        label.textContent = c;
        label.addEventListener('click', () => addFilter(c));

        const arrow = document.createElement('span');
        arrow.className = 'th-sort-btn' + (sortEntry ? ' th-sort-active' : '');
        arrow.title = sortEntry
            ? (sortEntry.dir === 'ASC' ? 'Sorted ASC — click for DESC' : 'Sorted DESC — click to remove sort')
            : 'Click to sort ASC';
        arrow.innerHTML = sortEntry
            ? (sortEntry.dir === 'ASC' ? '↑' : '↓')
            : '<span class="th-sort-idle">↕</span>';

        // Sort cycle: none → ASC → DESC → remove
        arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!sortEntry) {
                state.sort.push({ col: c, dir: 'ASC' });
            } else if (sortEntry.dir === 'ASC') {
                state.sort[sortIdx].dir = 'DESC';
            } else {
                state.sort.splice(sortIdx, 1);
            }
            runSearch();
        });

        th.appendChild(label);
        th.appendChild(arrow);
        thRow.appendChild(th);
    });
    thead.appendChild(thRow);
    table.appendChild(thead);

    // ── Body ──
    const tbody = document.createElement('tbody');
    if (!rows || !rows.length) {
        tbody.innerHTML = `<tr><td colspan="${columns.length + 2}" class="table-empty">No rows</td></tr>`;
    } else {
        rows.forEach(row => tbody.appendChild(buildDataRow(row, columns, colMeta)));
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);

    // ── Bulk action bar ──
    const bulkBar = document.createElement('div');
    bulkBar.className = 'bulk-bar hidden';
    bulkBar.id = 'bulk-bar';
    bulkBar.innerHTML = `
        <span class="bulk-info" id="bulk-info"></span>
        <button class="btn btn-default btn-sm" id="bulk-edit-btn">Edit selected</button>
    `;
    container.appendChild(bulkBar);

    // ── Pagination ──
    if (total > 0) {
        const pag = document.createElement('div');
        pag.className = 'pagination';
        pag.innerHTML = `
            <div class="pagination-info">
                Showing ${((page - 1) * page_size) + 1}–${Math.min(page * page_size, total)} of ${total} rows
            </div>
            <div class="pagination-btns" id="pag-btns"></div>
        `;
        container.appendChild(pag);
        renderPagination(pag.querySelector('#pag-btns'), page, totalPages);
    }

    // ── Insert row button ──
    thead.querySelector('#btn-insert-row').addEventListener('click', () => {
        const sel = getSelectedRows();
        const prefillList = (sel.mode !== 'none' && sel.rows.length > 0) ? sel.rows : [null];
        insertNewRows(tbody, columns, colMeta, prefillList);
    });

    // ── Wire header checkbox & dropdown ──
    const hdrCb    = thead.querySelector('#hdr-checkbox');
    const hdrDrop  = thead.querySelector('#hdr-check-dropdown');

    // Show dropdown on click (not change)
    hdrCb.addEventListener('click', (e) => {
        e.stopPropagation();
        hdrDrop.classList.toggle('open');
    });
    document.addEventListener('click', () => hdrDrop.classList.remove('open'), { capture: false });

    thead.querySelector('#sel-page-btn')?.addEventListener('click', () => {
        setSelectionMode('page', rows, tbody, hdrCb);
        hdrDrop.classList.remove('open');
    });
    thead.querySelector('#sel-none-btn')?.addEventListener('click', () => {
        setSelectionMode('none', rows, tbody, hdrCb);
        hdrDrop.classList.remove('open');
    });
    thead.querySelector('#sel-all-btn')?.addEventListener('click', () => {
        setSelectionMode('all', rows, tbody, hdrCb);
        hdrDrop.classList.remove('open');
    });

    // Individual checkbox change
    tbody.addEventListener('change', (e) => {
        if (!e.target.classList.contains('row-checkbox')) return;
        const tr = e.target.closest('tr.data-row');
        if (!tr) return;
        tr.classList.toggle('row-selected', e.target.checked);
        syncSelectionState(rows, tbody, hdrCb);
    });

    // Bulk edit button
    bulkBar.querySelector('#bulk-edit-btn').addEventListener('click', () => {
        openBulkEditModal(columns, colMeta);
    });

    // Store rows for select-all reference
    state.selection.pageRows = rows;
}

// ── Selection helpers ─────────────────────────────────────────────────────────
function setSelectionMode(mode, rows, tbody, hdrCb) {
    state.selection.mode = mode;
    const checkAll = mode === 'page' || mode === 'all';
    tbody.querySelectorAll('tr.data-row').forEach(tr => {
        const cb = tr.querySelector('.row-checkbox');
        if (cb) cb.checked = checkAll;
        tr.classList.toggle('row-selected', checkAll);
    });
    hdrCb.checked = checkAll;
    hdrCb.indeterminate = false;
    const selCount = mode === 'all' ? state.totalRows : (checkAll ? rows.length : 0);
    updateBulkBar(selCount, mode);
    updateInsertBtn(selCount);
}

function syncSelectionState(rows, tbody, hdrCb) {
    const cbs  = [...tbody.querySelectorAll('tr.data-row .row-checkbox')];
    const checked = cbs.filter(c => c.checked).length;
    hdrCb.checked       = checked === cbs.length && cbs.length > 0;
    hdrCb.indeterminate = checked > 0 && checked < cbs.length;
    state.selection.mode = checked === 0 ? 'none' : 'page';
    updateBulkBar(checked, 'page');
    updateInsertBtn(checked);
}

function updateInsertBtn(checkedCount) {
    const btn = document.getElementById('btn-insert-row');
    if (!btn) return;
    if (checkedCount > 0) {
        btn.title = `Duplicate ${checkedCount} selected row${checkedCount > 1 ? 's' : ''}`;
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V2zm2-1a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V2a1 1 0 00-1-1H6zM2 5a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1v-1h1v1a2 2 0 01-2 2H2a2 2 0 01-2-2V6a2 2 0 012-2h1v1H2z"/>
        </svg>`;
        btn.style.color = 'var(--accent)';
    } else {
        btn.title = 'Insert new row';
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
        </svg>`;
        btn.style.color = '';
    }
}

function updateBulkBar(count, mode) {
    const bar  = document.getElementById('bulk-bar');
    const info = document.getElementById('bulk-info');
    if (!bar) return;
    if (count === 0) {
        bar.classList.add('hidden');
        return;
    }
    bar.classList.remove('hidden');
    info.textContent = mode === 'all'
        ? `All ${count} rows selected (whole result)`
        : `${count} row${count !== 1 ? 's' : ''} selected`;
}

function getSelectedRows() {
    // Returns { mode: 'page'|'all', rows: [...rowData] }
    const trs = [...document.querySelectorAll('tr.data-row')].filter(tr => {
        const cb = tr.querySelector('.row-checkbox');
        return cb && cb.checked;
    });
    return {
        mode: state.selection.mode,
        rows: trs.map(tr => tr._rowData),
    };
}

// ── Insert new row ────────────────────────────────────────────────────────────
function buildInsertRow(columns, colMeta, prefill) {
    const tr = document.createElement('tr');
    tr.className = 'insert-row';

    // Cancel (×) button in checkbox cell
    const checkTd = document.createElement('td');
    checkTd.className = 'td-check-col';
    checkTd.innerHTML = `<button class="btn-cancel-insert" title="Cancel">
        <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2.146 2.854a.5.5 0 11.708-.708L8 7.293l5.146-5.147a.5.5 0 01.708.708L8.707 8l5.147 5.146a.5.5 0 01-.708.708L8 8.707l-5.146 5.147a.5.5 0 01-.708-.708L7.293 8 2.146 2.854z"/>
        </svg>
    </button>`;
    tr.appendChild(checkTd);

    // Save button cell
    const saveTd = document.createElement('td');
    saveTd.className = 'td-edit-col';
    saveTd.innerHTML = `
        <button class="btn-row-save" title="Save new row">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 1a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4.414A1 1 0 0014.707 4L12 1.293A1 1 0 0011.293 1H2zm7.5 10.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM3 3.5A.5.5 0 013.5 3h7a.5.5 0 01.5.5v2a.5.5 0 01-.5.5h-7a.5.5 0 01-.5-.5v-2z"/>
            </svg>
        </button>`;
    tr.appendChild(saveTd);

    columns.forEach(col => {
        const meta = colMeta[col] || {};
        const isPK = meta.key === 'PRI' && meta.autoIncrement;

        const td = document.createElement('td');
        td.className = 'insert-cell';
        td.dataset.col = col;

        if (isPK) {
            td.innerHTML = `<span class="insert-ai-hint">auto</span>`;
        } else {
            const prefillVal = prefill ? (prefill[col] ?? null) : null;
            const input = buildCellInput(meta, prefillVal, true);
            input.className = 'inline-edit-input insert-input';
            input.dataset.col = col;
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const inputs = [...tr.querySelectorAll('.insert-input')];
                    const next = inputs[inputs.indexOf(e.target) + 1];
                    if (next) next.focus();
                    else saveNewRow(tr, columns, colMeta);
                }
                if (e.key === 'Escape') cancelInsertRow(tr);
            });
            td.appendChild(input);
        }

        tr.appendChild(td);
    });

    return tr;
}

function insertNewRows(tbody, columns, colMeta, prefillList) {
    // Remove existing insert rows + group bar
    tbody.querySelectorAll('tr.insert-row, tr.insert-group-bar').forEach(r => r.remove());

    const rows = prefillList.map(prefill => buildInsertRow(columns, colMeta, prefill));

    // Insert all at top of tbody
    const anchor = tbody.firstChild;
    rows.forEach(tr => tbody.insertBefore(tr, anchor));

    const multi = rows.length > 1;

    // Wire cancel/save per-row
    rows.forEach(tr => {
        tr.querySelector('.btn-cancel-insert').addEventListener('click', () => {
            cancelInsertRow(tr);
            updateGroupBar(tbody, columns, colMeta);
        });
        tr.querySelector('.btn-row-save').addEventListener('click', () => {
            if (multi) return; // single-row save only; multi uses group bar
            saveNewRow(tr, columns, colMeta);
        });
    });

    if (multi) {
        renderGroupBar(tbody, columns, colMeta, rows);
    }

    // Focus first input of first row
    rows[0]?.querySelector('.insert-input')?.focus();
}

function renderGroupBar(tbody, columns, colMeta, rows) {
    tbody.querySelector('tr.insert-group-bar')?.remove();

    const insertRows = [...tbody.querySelectorAll('tr.insert-row')];
    if (insertRows.length === 0) return;
    if (insertRows.length === 1) {
        // Switch single row to use its own save button normally
        insertRows[0].querySelector('.btn-row-save').onclick = () => saveNewRow(insertRows[0], columns, colMeta);
        return;
    }

    const bar = document.createElement('tr');
    bar.className = 'insert-group-bar';
    const colSpan = columns.length + 2;
    bar.innerHTML = `<td colspan="${colSpan}">
        <button class="btn-group-cancel">Cancel all</button>
        <button class="btn-group-save">Save all</button>
    </td>`;

    const lastInsert = insertRows[insertRows.length - 1];
    lastInsert.after(bar);

    bar.querySelector('.btn-group-cancel').addEventListener('click', () => {
        tbody.querySelectorAll('tr.insert-row, tr.insert-group-bar').forEach(r => r.remove());
    });

    bar.querySelector('.btn-group-save').addEventListener('click', async () => {
        const trs = [...tbody.querySelectorAll('tr.insert-row')];
        const saveBtn = bar.querySelector('.btn-group-save');
        const cancelBtn = bar.querySelector('.btn-group-cancel');
        saveBtn.disabled = true;
        cancelBtn.disabled = true;
        let failed = 0;
        for (const tr of trs) {
            try { await saveNewRow(tr, columns, colMeta, true); }
            catch { failed++; }
        }
        const saved = trs.length - failed;
        if (saved > 0) toast(`${saved} row${saved > 1 ? 's' : ''} inserted`, 'success');
        if (failed === 0) {
            bar.remove();
            loadTableData(state.currentDb, state.currentTable, state.page);
        } else {
            saveBtn.disabled = false;
            cancelBtn.disabled = false;
        }
    });
}

function updateGroupBar(tbody, columns, colMeta) {
    const insertRows = [...tbody.querySelectorAll('tr.insert-row')];
    tbody.querySelector('tr.insert-group-bar')?.remove();
    if (insertRows.length > 1) {
        renderGroupBar(tbody, columns, colMeta, insertRows);
    } else if (insertRows.length === 1) {
        insertRows[0].querySelector('.btn-row-save').onclick = () => saveNewRow(insertRows[0], columns, colMeta);
    }
}

function cancelInsertRow(tr) {
    tr.remove();
}

// silent=true means don't reload (caller will batch-reload)
async function saveNewRow(tr, columns, colMeta, silent = false) {
    const values = {};
    let hasValue = false;

    columns.forEach(col => {
        const meta = colMeta[col] || {};
        const isPK = meta.key === 'PRI' && meta.autoIncrement;
        if (isPK) return; // skip auto-increment

        const input = tr.querySelector(`.insert-input[data-col="${CSS.escape(col)}"]`);
        if (!input) return;

        const val = getCellInputValue(input, meta);
        // If nullable and empty → send null
        values[col] = (val === '' && meta.allowNull) ? null : val;
        if (val !== '') hasValue = true;
    });

    const saveBtn = tr.querySelector('.btn-row-save');
    saveBtn.disabled = true;

    try {
        const res = await api('insert_row', {
            database: state.currentDb,
            table:    state.currentTable,
            values,
        });

        tr.remove();
        if (!silent) {
            toast('Row inserted', 'success');
            loadTableData(state.currentDb, state.currentTable, state.page);
        }
    } catch (err) {
        toast('Error: ' + err.message, 'error');
        saveBtn.disabled = false;
        throw err;
    }
}

// ── Build a data row ──────────────────────────────────────────────────────────
function buildDataRow(row, columns, colMeta) {
    const tr = document.createElement('tr');
    tr.className = 'data-row';

    // Store original row data on the element for later use
    tr._rowData    = row;
    tr._colMeta    = colMeta;
    tr._columns    = columns;

    const checkTd = document.createElement('td');
    checkTd.className = 'td-check-col';
    checkTd.innerHTML = `<input type="checkbox" class="row-checkbox tbl-check">`;

    const editTd = document.createElement('td');
    editTd.className = 'td-edit-col';
    editTd.innerHTML = `
        <button class="btn-row-edit" title="Edit row">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M12.854.146a.5.5 0 00-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 000-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 01.5.5v.5h.5a.5.5 0 01.5.5v.5h.5a.5.5 0 01.5.5v.5h.5a.5.5 0 01.5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 016 13.5V13h-.5a.5.5 0 01-.5-.5V12h-.5a.5.5 0 01-.5-.5V11h-.5a.5.5 0 01-.5-.5V10h-.5a.499.499 0 01-.175-.032l-.179.178a.5.5 0 00-.11.168l-2 5a.5.5 0 00.65.65l5-2a.5.5 0 00.168-.11l.178-.178z"/>
            </svg>
        </button>
    `;

    tr.appendChild(checkTd);
    tr.appendChild(editTd);

    columns.forEach(col => {
        const td = document.createElement('td');
        const val = row[col];
        const meta = colMeta[col] || {};
        td.dataset.col = col;
        td.dataset.origVal = val === null ? '\x00NULL' : String(val);

        renderCellView(td, val);

        // Double-click → inline edit
        td.addEventListener('dblclick', () => startInlineEdit(td, col, val, meta, row, columns, colMeta));

        tr.appendChild(td);
    });

    // Edit button → row modal
    editTd.querySelector('.btn-row-edit').addEventListener('click', () => {
        openRowEditModal(row, columns, colMeta);
    });

    return tr;
}

function renderCellView(td, val) {
    if (val === null || val === undefined) {
        td.className = 'null-val';
        td.textContent = 'NULL';
    } else if (typeof val === 'number' || /^-?\d+(\.\d+)?$/.test(String(val)) && String(val).length < 20) {
        td.className = 'num-val';
        td.textContent = String(val);
    } else if (isDateLike(String(val))) {
        td.className = 'date-val';
        td.textContent = String(val);
    } else {
        td.className = 'str-val';
        td.title = String(val);
        td.textContent = String(val);
    }
}

// ── Inline cell edit ──────────────────────────────────────────────────────────
function startInlineEdit(td, col, originalVal, meta, row, columns, colMeta) {
    if (td.classList.contains('editing')) return;
    td.classList.add('editing');

    const input = buildCellInput(meta, originalVal, true);
    input.className = 'inline-edit-input';
    td.innerHTML = '';
    td.appendChild(input);
    input.focus();
    if (input.select) input.select();

    const commit = async () => {
        const newVal = getCellInputValue(input, meta);
        td.classList.remove('editing');

        if (newVal === originalVal || (originalVal === null && newVal === null)) {
            renderCellView(td, originalVal);
            return;
        }

        // Optimistic update
        renderCellView(td, newVal);
        td.classList.add('cell-saving');

        try {
            await api('update_cell', {
                database: state.currentDb,
                table:    state.currentTable,
                column:   col,
                value:    newVal,
                where:    buildWhereFromRow(row, colMeta),
            });
            td.classList.remove('cell-saving');
            td.classList.add('cell-saved');
            setTimeout(() => td.classList.remove('cell-saved'), 1000);
            // Update stored row data on parent tr
            const tr = td.closest('tr');
            if (tr) tr._rowData = { ...tr._rowData, [col]: newVal };
        } catch (err) {
            td.classList.remove('cell-saving');
            td.classList.add('cell-error');
            setTimeout(() => { td.classList.remove('cell-error'); renderCellView(td, originalVal); }, 2000);
            toast('Error: ' + err.message, 'error');
        }
    };

    const cancel = () => {
        td.classList.remove('editing');
        renderCellView(td, originalVal);
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
        if (e.key === 'Escape') cancel();
    });

    input.addEventListener('blur', () => {
        // Small delay so click on another element doesn't race
        setTimeout(() => { if (td.classList.contains('editing')) commit(); }, 120);
    });
}

// ── Row edit modal ────────────────────────────────────────────────────────────
function openRowEditModal(row, columns, colMeta) {
    closeRowEditModal();

    const overlay = document.createElement('div');
    overlay.id = 'row-edit-overlay';
    overlay.innerHTML = `
        <div class="row-edit-modal" id="row-edit-modal">
            <div class="rem-header">
                <span class="rem-title">Edit Row</span>
                <button class="rem-close" id="rem-close">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
                    </svg>
                </button>
            </div>
            <div class="rem-body" id="rem-body"></div>
            <div class="rem-footer">
                <button class="btn btn-danger btn-sm" id="rem-delete">Delete</button>
                <div style="flex:1"></div>
                <button class="btn btn-default btn-sm" id="rem-cancel">Cancel</button>
                <button class="btn btn-accent btn-sm" id="rem-save">Save</button>
            </div>
        </div>
    `;

    const body = overlay.querySelector('#rem-body');
    const fields = [];

    columns.forEach(col => {
        const val  = row[col];
        const meta = colMeta[col] || {};
        const input = buildCellInput(meta, val, false);
        input.id = `rem-field-${col}`;
        input.dataset.col = col;

        const field = document.createElement('div');
        field.className = 'rem-field';

        const labelRow = document.createElement('div');
        labelRow.className = 'rem-label-row';
        labelRow.innerHTML = `
            <label for="rem-field-${escAttr(col)}" class="rem-label">${escHtml(col)}</label>
            <span class="rem-type-badge">${escHtml(meta.baseType || '')}</span>
            ${meta.allowNull ? `<label class="rem-null-label"><input type="checkbox" class="rem-null-cb tbl-check" data-col="${escAttr(col)}"${val === null ? ' checked' : ''}> NULL</label>` : ''}
        `;

        if (meta.allowNull) {
            const cb = labelRow.querySelector('.rem-null-cb');
            cb.addEventListener('change', () => {
                input.disabled = cb.checked;
                if (cb.checked) input.classList.add('input-disabled');
                else input.classList.remove('input-disabled');
            });
            if (val === null) {
                input.disabled = true;
                input.classList.add('input-disabled');
            }
        }

        field.appendChild(labelRow);
        field.appendChild(input);
        body.appendChild(field);
        fields.push({ col, input, meta });
    });

    document.body.appendChild(overlay);

    // Close
    const close = closeRowEditModal;
    overlay.querySelector('#rem-close').addEventListener('click', close);
    overlay.querySelector('#rem-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // Delete
    overlay.querySelector('#rem-delete').addEventListener('click', async () => {
        if (!confirm('Delete this row?')) return;
        const btn = overlay.querySelector('#rem-delete');
        btn.disabled = true; btn.textContent = 'Deleting…';
        try {
            await api('delete_rows', {
                database:   state.currentDb,
                table:      state.currentTable,
                where_rows: [buildWhereFromRow(row, colMeta)],
            });
            toast('Row deleted', 'success');
            close();
            loadTableData(state.currentDb, state.currentTable, state.page);
        } catch (err) {
            toast('Error: ' + err.message, 'error');
            btn.disabled = false; btn.textContent = 'Delete';
        }
    });

    // Save
    overlay.querySelector('#rem-save').addEventListener('click', async () => {
        const updates = {};
        fields.forEach(({ col, input, meta }) => {
            const nullCb = overlay.querySelector(`.rem-null-cb[data-col="${CSS.escape(col)}"]`);
            if (nullCb && nullCb.checked) {
                updates[col] = null;
            } else {
                updates[col] = getCellInputValue(input, meta);
            }
        });

        const btn = overlay.querySelector('#rem-save');
        btn.disabled = true;
        btn.textContent = 'Saving…';

        try {
            await api('update_row', {
                database: state.currentDb,
                table:    state.currentTable,
                updates,
                where:    buildWhereFromRow(row, colMeta),
            });
            toast('Row updated', 'success');
            close();

            // Refresh the row in the table
            const tr = [...document.querySelectorAll('.data-row')].find(r => r._rowData === row);
            if (tr) {
                const newRow = { ...row, ...updates };
                tr._rowData = newRow;
                tr._columns.forEach(col => {
                    const td = tr.querySelector(`td[data-col="${CSS.escape(col)}"]`);
                    if (td) { renderCellView(td, newRow[col]); td.dataset.origVal = newRow[col] === null ? '\x00NULL' : String(newRow[col]); }
                });
            }
        } catch (err) {
            toast('Error: ' + err.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Save';
        }
    });

    // Focus first input
    setTimeout(() => { const first = body.querySelector('input,textarea,select'); if (first && !first.disabled) first.focus(); }, 50);
}

// ── Bulk edit modal ───────────────────────────────────────────────────────────
function openBulkEditModal(columns, colMeta) {
    const { mode, rows } = getSelectedRows();
    if (!rows.length && mode !== 'all') return;

    closeRowEditModal();
    const existingBulk = document.getElementById('bulk-edit-overlay');
    if (existingBulk) existingBulk.remove();

    const count   = mode === 'all' ? state.totalRows : rows.length;
    const overlay = document.createElement('div');
    overlay.id = 'bulk-edit-overlay';

    overlay.innerHTML = `
        <div class="row-edit-modal" id="bulk-edit-modal">
            <div class="rem-header">
                <span class="rem-title">Edit ${count} row${count !== 1 ? 's' : ''}</span>
                <button class="rem-close" id="bem-close">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
                    </svg>
                </button>
            </div>
            <div class="rem-body" id="bem-body"></div>
            <div class="rem-footer">
                <button class="btn btn-danger btn-sm" id="bem-delete">Delete ${count} row${count !== 1 ? 's' : ''}</button>
                <div style="flex:1"></div>
                <button class="btn btn-default btn-sm" id="bem-cancel">Cancel</button>
                <button class="btn btn-accent btn-sm" id="bem-save">Apply to ${count} row${count !== 1 ? 's' : ''}</button>
            </div>
        </div>
    `;

    const body = overlay.querySelector('#bem-body');

    columns.forEach(col => {
        const meta = colMeta[col] || {};
        const isPK = meta.key === 'PRI';

        const field = document.createElement('div');
        field.className = 'rem-field bulk-field';
        field.dataset.col = col;

        const labelRow = document.createElement('div');
        labelRow.className = 'rem-label-row';
        labelRow.innerHTML = `
            <label class="rem-label">${escHtml(col)}</label>
            <span class="rem-type-badge">${escHtml(meta.baseType || '')}</span>
            ${isPK ? '<span class="badge" style="margin-left:auto;font-size:.68rem">PK</span>' : ''}
        `;

        const controlsRow = document.createElement('div');
        controlsRow.className = 'bulk-controls-row';

        if (isPK) {
            // PK — fully disabled, just show label
            controlsRow.innerHTML = `<span class="bulk-pk-note">Primary key — not editable in bulk</span>`;
            field.appendChild(labelRow);
            field.appendChild(controlsRow);
            body.appendChild(field);
            return;
        }

        // Mode selector
        const modeOptions = buildBulkModeOptions(meta);
        const modeSelect = document.createElement('select');
        modeSelect.className = 'tbl-input tbl-select bulk-mode-select';
        modeSelect.innerHTML = modeOptions;

        // Value input wrapper
        const valWrap = document.createElement('div');
        valWrap.className = 'bulk-val-wrap';

        const buildInput = (modeVal) => {
            valWrap.innerHTML = '';
            if (modeVal === 'original') return;
            if (modeVal === 'null') return;

            if (modeVal === 'increment' || modeVal === 'decrement') {
                const inp = document.createElement('input');
                inp.type = 'number'; inp.step = 'any'; inp.min = '0';
                inp.className = 'tbl-input bulk-value-input';
                inp.placeholder = 'Amount';
                inp.value = '1';
                valWrap.appendChild(inp);
                return;
            }

            const inp = buildCellInput(meta, null, false);
            inp.className += ' bulk-value-input';
            valWrap.appendChild(inp);
        };

        modeSelect.addEventListener('change', () => buildInput(modeSelect.value));
        buildInput(modeSelect.value);  // initial = 'original' → empty

        controlsRow.appendChild(modeSelect);
        controlsRow.appendChild(valWrap);
        field.appendChild(labelRow);
        field.appendChild(controlsRow);
        body.appendChild(field);
    });

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#bem-close').addEventListener('click', close);
    overlay.querySelector('#bem-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // Bulk delete
    overlay.querySelector('#bem-delete').addEventListener('click', async () => {
        const label = mode === 'all' ? `all ${count} rows` : `${count} selected row${count !== 1 ? 's' : ''}`;
        if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
        const btn = overlay.querySelector('#bem-delete');
        btn.disabled = true; btn.textContent = 'Deleting…';
        try {
            const res = await api('delete_rows', {
                database:   state.currentDb,
                table:      state.currentTable,
                mode,
                where_rows: mode === 'page' ? rows.map(r => buildWhereFromRow(r, colMeta)) : null,
            });
            toast(`Deleted ${res.affected} row${res.affected !== 1 ? 's' : ''}`, 'success');
            close();
            loadTableData(state.currentDb, state.currentTable, state.page);
        } catch (err) {
            toast('Error: ' + err.message, 'error');
            btn.disabled = false; btn.textContent = `Delete ${count} row${count !== 1 ? 's' : ''}`;
        }
    });

    overlay.querySelector('#bem-save').addEventListener('click', async () => {
        const updates = {};
        let hasChanges = false;

        body.querySelectorAll('.bulk-field').forEach(field => {
            const col = field.dataset.col;
            const meta = colMeta[col] || {};
            if (meta.key === 'PRI') return;

            const modeSelect = field.querySelector('.bulk-mode-select');
            const modeVal    = modeSelect?.value;
            if (!modeVal || modeVal === 'original') return;

            hasChanges = true;

            if (modeVal === 'null') {
                updates[col] = { op: 'set', value: null };
            } else if (modeVal === 'increment') {
                const amt = field.querySelector('.bulk-value-input')?.value || '1';
                updates[col] = { op: 'increment', value: parseFloat(amt) };
            } else if (modeVal === 'decrement') {
                const amt = field.querySelector('.bulk-value-input')?.value || '1';
                updates[col] = { op: 'decrement', value: parseFloat(amt) };
            } else {
                // set
                const inp = field.querySelector('.bulk-value-input');
                updates[col] = { op: 'set', value: inp ? getCellInputValue(inp, meta) : '' };
            }
        });

        if (!hasChanges) {
            toast('No changes — set at least one field', 'error');
            return;
        }

        const btn = overlay.querySelector('#bem-save');
        btn.disabled = true;
        btn.textContent = 'Saving…';

        try {
            const payload = {
                database: state.currentDb,
                table:    state.currentTable,
                updates,
                mode,
                where_rows: mode === 'page'
                    ? rows.map(r => buildWhereFromRow(r, colMeta))
                    : null,
            };

            const res = await api('bulk_update', payload);
            toast(`Updated ${res.affected} row${res.affected !== 1 ? 's' : ''}`, 'success');
            close();
            loadTableData(state.currentDb, state.currentTable, state.page);
        } catch (err) {
            toast('Error: ' + err.message, 'error');
            btn.disabled = false;
            btn.textContent = `Apply to ${count} row${count !== 1 ? 's' : ''}`;
        }
    });
}

function buildBulkModeOptions(meta) {
    const base = (meta.baseType || '').toUpperCase();
    const isNumeric = ['TINYINT','SMALLINT','MEDIUMINT','INT','BIGINT','FLOAT','DOUBLE','DECIMAL','NUMERIC'].includes(base);
    const isBlob = ['BLOB','TINYBLOB','MEDIUMBLOB','LONGBLOB'].includes(base);

    let opts = `<option value="original">— original —</option>`;
    if (!isBlob) opts += `<option value="set">Set value</option>`;
    if (isNumeric) {
        opts += `<option value="increment">Increment (+)</option>`;
        opts += `<option value="decrement">Decrement (−)</option>`;
    }
    if (meta.allowNull) opts += `<option value="null">Set NULL</option>`;
    return opts;
}

function closeRowEditModal() {
    const el = document.getElementById('row-edit-overlay');
    if (el) el.remove();
}

// ── Build input for a cell based on column meta ───────────────────────────────
function buildCellInput(meta, val, inline) {
    const base = (meta.baseType || 'VARCHAR').toUpperCase();
    const strVal = val === null ? '' : String(val);

    // Large text → textarea (only in modal)
    const isLargeText = ['TEXT','TINYTEXT','MEDIUMTEXT','LONGTEXT'].includes(base);
    if (!inline && isLargeText) {
        const ta = document.createElement('textarea');
        ta.className = 'tbl-input rem-textarea';
        ta.value = strVal;
        return ta;
    }

    // Integer
    if (['TINYINT','SMALLINT','MEDIUMINT','INT','BIGINT'].includes(base)) {
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.step = '1';
        if (meta.unsigned) inp.min = '0';
        inp.className = 'tbl-input';
        inp.value = strVal;
        return inp;
    }

    // Decimal
    if (['FLOAT','DOUBLE','DECIMAL','NUMERIC'].includes(base)) {
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.step = 'any';
        inp.className = 'tbl-input';
        inp.value = strVal;
        return inp;
    }

    // Date / Datetime / Timestamp
    if (base === 'DATE') {
        const inp = document.createElement('input');
        inp.type = 'date';
        inp.className = 'tbl-input';
        inp.value = strVal;
        return inp;
    }
    if (base === 'DATETIME' || base === 'TIMESTAMP') {
        const inp = document.createElement('input');
        inp.type = 'datetime-local';
        inp.step = '1';
        inp.className = 'tbl-input';
        // MySQL format: 2024-01-01 12:00:00 → input needs 2024-01-01T12:00:00
        inp.value = strVal.replace(' ', 'T');
        return inp;
    }
    if (base === 'TIME') {
        const inp = document.createElement('input');
        inp.type = 'time';
        inp.step = '1';
        inp.className = 'tbl-input';
        inp.value = strVal;
        return inp;
    }
    if (base === 'YEAR') {
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.min = '1901'; inp.max = '2155'; inp.step = '1';
        inp.className = 'tbl-input';
        inp.value = strVal;
        return inp;
    }

    // ENUM → select
    if (base === 'ENUM' && meta.enumValues) {
        const sel = document.createElement('select');
        sel.className = 'tbl-input tbl-select';
        const rawVals = meta.enumValues.replace(/^'|'$/g, '').split("','");
        rawVals.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v; opt.textContent = v;
            if (v === strVal) opt.selected = true;
            sel.appendChild(opt);
        });
        return sel;
    }

    // BOOLEAN / BIT(1)
    if (base === 'BOOLEAN' || (base === 'BIT' && meta.length === '1')) {
        const sel = document.createElement('select');
        sel.className = 'tbl-input tbl-select';
        [['0','No / 0'],['1','Yes / 1']].forEach(([v, label]) => {
            const opt = document.createElement('option');
            opt.value = v; opt.textContent = label;
            if (strVal === v) opt.selected = true;
            sel.appendChild(opt);
        });
        return sel;
    }

    // Default: text input
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'tbl-input';
    inp.value = strVal;
    if (inline) inp.style.width = '100%';
    return inp;
}

function getCellInputValue(input, meta) {
    const base = (meta.baseType || '').toUpperCase();
    const raw = input.value;

    if (input.type === 'datetime-local' && raw) {
        // Convert back T → space for MySQL
        return raw.replace('T', ' ');
    }
    if (raw === '' && ['TINYINT','SMALLINT','MEDIUMINT','INT','BIGINT','FLOAT','DOUBLE','DECIMAL','NUMERIC'].includes(base)) {
        return null;
    }
    return raw === '' && input.type !== 'number' ? raw : raw;
}

// Build WHERE clause from a row using PK or all columns
function buildWhereFromRow(row, colMeta) {
    const pkCols = Object.entries(colMeta).filter(([, m]) => m.key === 'PRI').map(([c]) => c);
    const useCols = pkCols.length ? pkCols : Object.keys(row);
    const where = {};
    useCols.forEach(c => { where[c] = row[c]; });
    return where;
}

function renderPagination(container, current, total) {
    const range = paginationRange(current, total);
    container.innerHTML = '';

    const prev = makePageBtn('‹', current > 1, () => loadTableData(state.currentDb, state.currentTable, current - 1));
    container.appendChild(prev);

    range.forEach(p => {
        if (p === '…') {
            const el = document.createElement('button');
            el.className = 'page-btn';
            el.textContent = '…';
            el.disabled = true;
            container.appendChild(el);
        } else {
            const el = makePageBtn(p, true, () => loadTableData(state.currentDb, state.currentTable, p));
            if (p === current) el.classList.add('active');
            container.appendChild(el);
        }
    });

    const next = makePageBtn('›', current < total, () => loadTableData(state.currentDb, state.currentTable, current + 1));
    container.appendChild(next);
}

function makePageBtn(label, enabled, onClick) {
    const btn = document.createElement('button');
    btn.className = 'page-btn';
    btn.textContent = label;
    btn.disabled = !enabled;
    if (enabled) btn.addEventListener('click', onClick);
    return btn;
}

function paginationRange(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [];
    pages.push(1);
    if (current > 3) pages.push('…');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('…');
    pages.push(total);
    return pages;
}

// ── Table structure ───────────────────────────────────────────────────────────
async function loadTableStructure(dbName, tableName) {
    setBreadcrumb([
        { label: dbName, onClick: () => selectDatabase(dbName) },
        { label: tableName, onClick: () => loadTableData(dbName, tableName, 1) },
        { label: 'Structure', active: true },
    ]);

    setTopbarActions([
        { label: 'Data', onClick: () => loadTableData(dbName, tableName, 1) },
        { label: 'Actions ▾', dropdown: [
            { label: 'Create Table', onClick: () => showCreateTable(dbName) },
        ]},
    ]);

    const area = document.getElementById('content-area');
    area.innerHTML = `
        <div class="table-view-header">
            <div class="table-view-title">${escHtml(tableName)} — Structure</div>
            <div class="table-view-actions">
                <button class="btn btn-accent btn-sm" id="struct-edit-btn">Edit</button>
            </div>
        </div>
        <div id="struct-loading" style="display:flex;gap:10px;color:var(--text-muted);align-items:center">
            <div class="spinner"></div> Loading structure...
        </div>
        <div id="struct-content"></div>
    `;

    try {
        const data = await api('table_structure', { database: dbName, table: tableName });
        document.getElementById('struct-loading').style.display = 'none';

        let editMode = false;
        let columns = data.structure.map(parseColumnDef);

        const render = () => renderStructure(
            document.getElementById('struct-content'),
            columns,
            editMode,
            (newCols) => { columns = newCols; }
        );

        render();

        document.getElementById('struct-edit-btn').addEventListener('click', async () => {
            if (!editMode) {
                editMode = true;
                document.getElementById('struct-edit-btn').textContent = 'Save';
                document.getElementById('struct-edit-btn').classList.add('saving');
                render();
            } else {
                const btn = document.getElementById('struct-edit-btn');
                btn.disabled = true;
                btn.textContent = 'Saving…';
                try {
                    await api('alter_table', {
                        database: dbName,
                        table: tableName,
                        columns: collectEditorState(),
                    });
                    toast('Structure saved successfully', 'success');
                    editMode = false;
                    // Reload fresh from DB
                    const fresh = await api('table_structure', { database: dbName, table: tableName });
                    columns = fresh.structure.map(parseColumnDef);
                    btn.textContent = 'Edit';
                    btn.disabled = false;
                    btn.classList.remove('saving');
                    render();
                } catch (err) {
                    toast('Error: ' + err.message, 'error');
                    btn.textContent = 'Save';
                    btn.disabled = false;
                }
            }
        });

    } catch (err) {
        document.getElementById('struct-loading').innerHTML =
            `<span style="color:var(--danger)">${escHtml(err.message)}</span>`;
    }
}

// ── Structure editor ──────────────────────────────────────────────────────────

const TYPE_GROUPS = {
    'Integer':   ['TINYINT','SMALLINT','MEDIUMINT','INT','BIGINT'],
    'Decimal':   ['FLOAT','DOUBLE','DECIMAL','NUMERIC'],
    'String':    ['CHAR','VARCHAR','TINYTEXT','TEXT','MEDIUMTEXT','LONGTEXT'],
    'Binary':    ['BINARY','VARBINARY','TINYBLOB','BLOB','MEDIUMBLOB','LONGBLOB'],
    'Date/Time': ['DATE','DATETIME','TIMESTAMP','TIME','YEAR'],
    'Other':     ['ENUM','SET','JSON','BIT','BOOLEAN','GEOMETRY'],
};

const ALL_TYPES = Object.values(TYPE_GROUPS).flat();

const TYPES_WITH_LENGTH   = new Set(['TINYINT','SMALLINT','MEDIUMINT','INT','BIGINT','FLOAT','DOUBLE','DECIMAL','NUMERIC','CHAR','VARCHAR','BINARY','VARBINARY','BIT']);
const TYPES_WITH_DECIMALS = new Set(['FLOAT','DOUBLE','DECIMAL','NUMERIC']);
const TYPES_WITH_VALUES   = new Set(['ENUM','SET']); // comma-separated values
const TYPES_NO_DEFAULT    = new Set(['TEXT','TINYTEXT','MEDIUMTEXT','LONGTEXT','BLOB','TINYBLOB','MEDIUMBLOB','LONGBLOB','JSON','GEOMETRY']);
const TYPES_WITH_AUTO_INC = new Set(['TINYINT','SMALLINT','MEDIUMINT','INT','BIGINT']);

function parseColumnDef(row) {
    // row = { Field, Type, Null, Key, Default, Extra }
    const typeRaw = row.Type || '';
    const typeUpper = typeRaw.toUpperCase();

    let baseType = typeUpper.replace(/\(.*/, '').replace(/\s+UNSIGNED$/, '').trim();
    let length = '';
    let decimals = '';
    let enumValues = '';
    let unsigned = /unsigned/i.test(typeRaw);

    const mLen = typeRaw.match(/\(([^)]+)\)/);
    if (mLen) {
        const inner = mLen[1];
        if (TYPES_WITH_VALUES.has(baseType)) {
            enumValues = inner; // "'a','b'"
        } else if (TYPES_WITH_DECIMALS.has(baseType) && inner.includes(',')) {
            const parts = inner.split(',');
            length = parts[0].trim();
            decimals = parts[1].trim();
        } else {
            length = inner.trim();
        }
    }

    return {
        originalName: row.Field,
        name:         row.Field,
        baseType:     baseType || 'VARCHAR',
        length,
        decimals,
        enumValues,
        unsigned,
        allowNull:    row.Null === 'YES',
        defaultType:  row.Default === null ? 'NULL' : row.Default === '' ? 'EMPTY' : row.Default === 'CURRENT_TIMESTAMP' ? 'CURRENT_TIMESTAMP' : 'VALUE',
        defaultValue: (row.Default !== null && row.Default !== 'CURRENT_TIMESTAMP') ? String(row.Default) : '',
        autoIncrement: /auto_increment/i.test(row.Extra || ''),
        key:          row.Key || '',
        extra:        row.Extra || '',
        comment:      row.Comment || '',
    };
}

function collectEditorState() {
    const rows = document.querySelectorAll('#struct-editor-body tr[data-idx]');
    const result = [];
    rows.forEach(tr => {
        const idx = tr.dataset.idx;
        const get = (sel) => tr.querySelector(sel);

        const baseType = get('.col-type').value.toUpperCase();

        let defaultVal = null;
        const defType = get('.col-default-type').value;
        if (defType === 'VALUE') defaultVal = get('.col-default-value')?.value ?? '';
        else if (defType === 'EMPTY') defaultVal = '';
        else if (defType === 'CURRENT_TIMESTAMP') defaultVal = 'CURRENT_TIMESTAMP';
        else defaultVal = null; // NULL

        result.push({
            originalName:  tr.dataset.original,
            name:          get('.col-name').value.trim(),
            baseType,
            length:        get('.col-length')?.value.trim() || '',
            decimals:      get('.col-decimals')?.value.trim() || '',
            enumValues:    get('.col-enum')?.value.trim() || '',
            unsigned:      get('.col-unsigned')?.checked || false,
            allowNull:     get('.col-null')?.checked || false,
            defaultType:   defType,
            defaultValue:  defaultVal,
            autoIncrement: get('.col-ai')?.checked || false,
            primary:       get('.col-primary')?.checked || false,
            key:           get('.col-primary')?.checked ? 'PRI' : (tr.dataset.key || ''),
        });
    });
    return result;
}

function renderStructure(container, columns, editMode, onUpdate) {
    if (!editMode) {
        container.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'data-table-wrap';
        const cols = ['#', 'Field', 'Type', 'Null', 'Key', 'Default', 'Extra'];
        wrap.innerHTML = `
            <table class="data-table">
                <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
                <tbody>
                    ${columns.map((col, i) => {
                        const key = col.key || '';
                        const keyBadge = key ? `<span class="badge${key==='PRI'?' blue':''}">${escHtml(key)}</span>` : '';
                        return `
                        <tr>
                            <td class="num-val">${i + 1}</td>
                            <td><strong>${escHtml(col.name)}</strong></td>
                            <td style="font-family:var(--font-mono);font-size:.78rem;color:#a78bfa">${escHtml(buildTypeStr(col))}</td>
                            <td>${col.allowNull ? '<span style="color:var(--warning)">YES</span>' : 'NO'}</td>
                            <td>${keyBadge}</td>
                            <td class="${col.defaultType === 'NULL' ? 'null-val' : ''}">${col.defaultType === 'NULL' ? 'NULL' : col.defaultType === 'CURRENT_TIMESTAMP' ? '<span style="color:var(--warning)">CURRENT_TIMESTAMP</span>' : escHtml(col.defaultValue ?? '')}</td>
                            <td style="color:var(--text-muted);font-size:.78rem">${escHtml(col.extra)}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
        container.appendChild(wrap);
        return;
    }

    // ── Edit mode ──
    container.innerHTML = `
        <div class="struct-editor">
            <table class="data-table struct-edit-table">
                <thead>
                    <tr>
                        <th class="col-drag-th"></th>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Length / Values</th>
                        <th>Unsigned</th>
                        <th>Allow NULL</th>
                        <th>Default</th>
                        <th>A_I</th>
                        <th>Key</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody id="struct-editor-body">
                    ${columns.map((col, i) => buildEditorRow(col, i)).join('')}
                </tbody>
            </table>
            <div style="margin-top:12px">
                <button class="btn btn-default btn-sm" id="struct-add-col">+ Add Column</button>
            </div>
        </div>
    `;

    // Wire up all row events
    wireEditorEvents(container, columns, onUpdate);
}

function buildTypeStr(col) {
    const t = col.baseType;
    if (TYPES_WITH_VALUES.has(t) && col.enumValues) return `${t}(${col.enumValues})`;
    if (TYPES_WITH_DECIMALS.has(t) && col.length && col.decimals) return `${t}(${col.length},${col.decimals})${col.unsigned ? ' unsigned' : ''}`;
    if (TYPES_WITH_LENGTH.has(t) && col.length) return `${t}(${col.length})${col.unsigned ? ' unsigned' : ''}`;
    return t + (col.unsigned ? ' unsigned' : '');
}

function buildEditorRow(col, idx) {
    const typeOptions = Object.entries(TYPE_GROUPS).map(([group, types]) =>
        `<optgroup label="${group}">${types.map(t =>
            `<option value="${t}"${col.baseType === t ? ' selected' : ''}>${t}</option>`
        ).join('')}</optgroup>`
    ).join('');

    const showLen     = TYPES_WITH_LENGTH.has(col.baseType) && !TYPES_WITH_VALUES.has(col.baseType);
    const showDec     = TYPES_WITH_DECIMALS.has(col.baseType);
    const showEnum    = TYPES_WITH_VALUES.has(col.baseType);
    const showUnsigned = (TYPES_WITH_LENGTH.has(col.baseType) && !TYPES_WITH_VALUES.has(col.baseType) && !['CHAR','VARCHAR','BINARY','VARBINARY','BIT'].includes(col.baseType)) || TYPES_WITH_DECIMALS.has(col.baseType);
    const canAI       = TYPES_WITH_AUTO_INC.has(col.baseType);
    const canDefault  = !TYPES_NO_DEFAULT.has(col.baseType);
    const isTimestamp = col.baseType === 'TIMESTAMP' || col.baseType === 'DATETIME';

    const defOptions = [
        `<option value="NULL"${col.defaultType==='NULL'?' selected':''}>NULL</option>`,
        `<option value="EMPTY"${col.defaultType==='EMPTY'?' selected':''}>Empty string</option>`,
        `<option value="VALUE"${col.defaultType==='VALUE'?' selected':''}>Value…</option>`,
        isTimestamp ? `<option value="CURRENT_TIMESTAMP"${col.defaultType==='CURRENT_TIMESTAMP'?' selected':''}>CURRENT_TIMESTAMP</option>` : '',
    ].join('');

    return `
    <tr data-idx="${idx}" data-original="${escAttr(col.originalName)}" data-key="${escAttr(col.key)}">
        <td class="col-drag-td" draggable="true" title="Drag to reorder">
            <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" style="color:var(--text-dim);cursor:grab">
                <circle cx="4" cy="4" r="1.5"/><circle cx="8" cy="4" r="1.5"/>
                <circle cx="4" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
                <circle cx="4" cy="12" r="1.5"/><circle cx="8" cy="12" r="1.5"/>
            </svg>
        </td>
        <td><input class="col-name tbl-input" value="${escAttr(col.name)}" style="width:120px"></td>
        <td>
            <select class="col-type tbl-input tbl-select" style="width:130px">${typeOptions}</select>
        </td>
        <td class="col-extra-cell">
            <span class="col-len-wrap"${showLen?'':' style="display:none"'}>
                <input class="col-length tbl-input" value="${escAttr(col.length)}" placeholder="Length" style="width:70px">
                <span class="col-dec-wrap"${showDec?'':' style="display:none"'}>
                    , <input class="col-decimals tbl-input" value="${escAttr(col.decimals)}" placeholder="Dec" style="width:45px">
                </span>
            </span>
            <span class="col-enum-wrap"${showEnum?'':' style="display:none"'}>
                <input class="col-enum tbl-input" value="${escAttr(col.enumValues)}" placeholder="'a','b','c'" style="width:160px">
            </span>
        </td>
        <td style="text-align:center">
            <span class="col-unsigned-wrap"${showUnsigned?'':' style="display:none"'}>
                <input type="checkbox" class="col-unsigned tbl-check"${col.unsigned?' checked':''}>
            </span>
        </td>
        <td style="text-align:center">
            <input type="checkbox" class="col-null tbl-check"${col.allowNull?' checked':''}>
        </td>
        <td class="col-default-cell">
            ${canDefault ? `
                <select class="col-default-type tbl-input tbl-select" style="width:130px">${defOptions}</select>
                <span class="col-default-value-wrap"${col.defaultType==='VALUE'?'':' style="display:none"'}>
                    <input class="col-default-value tbl-input" value="${escAttr(col.defaultValue ?? '')}" style="width:100px;margin-top:4px">
                </span>
            ` : '<span style="color:var(--text-dim);font-size:.75rem">—</span>'}
        </td>
        <td style="text-align:center">
            <span class="col-ai-wrap"${canAI?'':' style="display:none"'}>
                <input type="checkbox" class="col-ai tbl-check"${col.autoIncrement?' checked':''}>
            </span>
        </td>
        <td style="text-align:center">
            <input type="checkbox" class="col-primary tbl-check" title="Primary Key"${col.key === 'PRI' ? ' checked' : ''}>
        </td>
        <td>
            <button class="btn btn-danger btn-sm col-delete-btn" title="Delete column">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
                    <path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 010-2h4a1 1 0 011-1h3a1 1 0 011 1h4a1 1 0 011 1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3a.5.5 0 000 1h11a.5.5 0 000-1h-11z"/>
                </svg>
            </button>
        </td>
    </tr>`;
}

function wireEditorEvents(container, columns, onUpdate) {
    const tbody = container.querySelector('#struct-editor-body');

    // Type change → show/hide fields
    tbody.addEventListener('change', (e) => {
        const tr = e.target.closest('tr[data-idx]');
        if (!tr) return;

        if (e.target.classList.contains('col-type')) {
            updateRowVisibility(tr, e.target.value.toUpperCase());
        }
        if (e.target.classList.contains('col-default-type')) {
            const valWrap = tr.querySelector('.col-default-value-wrap');
            if (valWrap) valWrap.style.display = e.target.value === 'VALUE' ? '' : 'none';
        }
    });

    // Delete row
    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.col-delete-btn');
        if (!btn) return;
        const tr = btn.closest('tr[data-idx]');
        if (confirm(`Delete column "${tr.querySelector('.col-name').value}"?`)) {
            tr.remove();
            reindexRows(tbody);
        }
    });

    // Add column
    container.querySelector('#struct-add-col').addEventListener('click', () => {
        const newCol = {
            originalName: '', name: 'new_column',
            baseType: 'VARCHAR', length: '255', decimals: '', enumValues: '',
            unsigned: false, allowNull: true,
            defaultType: 'NULL', defaultValue: '',
            autoIncrement: false, key: '', extra: '',
        };
        const idx = tbody.querySelectorAll('tr[data-idx]').length;
        const row = document.createElement('tr');
        row.outerHTML; // dummy
        tbody.insertAdjacentHTML('beforeend', buildEditorRow(newCol, idx));
        reindexRows(tbody);
    });

    // Drag & drop reorder
    let dragSrc = null;
    tbody.addEventListener('dragstart', (e) => {
        dragSrc = e.target.closest('tr[data-idx]');
        if (dragSrc) {
            dragSrc.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        }
    });
    tbody.addEventListener('dragover', (e) => {
        e.preventDefault();
        const target = e.target.closest('tr[data-idx]');
        if (target && target !== dragSrc) {
            const rect = target.getBoundingClientRect();
            const after = e.clientY > rect.top + rect.height / 2;
            tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-top','drag-over-bottom'));
            target.classList.add(after ? 'drag-over-bottom' : 'drag-over-top');
        }
    });
    tbody.addEventListener('dragleave', () => {
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-top','drag-over-bottom'));
    });
    tbody.addEventListener('drop', (e) => {
        e.preventDefault();
        const target = e.target.closest('tr[data-idx]');
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-top','drag-over-bottom','dragging'));
        if (!target || !dragSrc || target === dragSrc) return;
        const rect = target.getBoundingClientRect();
        const after = e.clientY > rect.top + rect.height / 2;
        if (after) target.after(dragSrc); else target.before(dragSrc);
        reindexRows(tbody);
    });
    tbody.addEventListener('dragend', () => {
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('dragging','drag-over-top','drag-over-bottom'));
    });
}

function updateRowVisibility(tr, type) {
    const showLen      = TYPES_WITH_LENGTH.has(type) && !TYPES_WITH_VALUES.has(type);
    const showDec      = TYPES_WITH_DECIMALS.has(type);
    const showEnum     = TYPES_WITH_VALUES.has(type);
    const showUnsigned = showLen && !['CHAR','VARCHAR','BINARY','VARBINARY','BIT'].includes(type);
    const canAI        = TYPES_WITH_AUTO_INC.has(type);
    const canDefault   = !TYPES_NO_DEFAULT.has(type);
    const isTimestamp  = type === 'TIMESTAMP' || type === 'DATETIME';

    setVisible(tr.querySelector('.col-len-wrap'), showLen);
    setVisible(tr.querySelector('.col-dec-wrap'), showDec);
    setVisible(tr.querySelector('.col-enum-wrap'), showEnum);
    setVisible(tr.querySelector('.col-unsigned-wrap'), showUnsigned);
    setVisible(tr.querySelector('.col-ai-wrap'), canAI);

    const defCell = tr.querySelector('.col-default-cell');
    if (defCell) {
        if (!canDefault) {
            defCell.innerHTML = '<span style="color:var(--text-dim);font-size:.75rem">—</span>';
        } else {
            const existing = tr.querySelector('.col-default-type');
            if (!existing) {
                defCell.innerHTML = `
                    <select class="col-default-type tbl-input tbl-select" style="width:130px">
                        <option value="NULL">NULL</option>
                        <option value="EMPTY">Empty string</option>
                        <option value="VALUE">Value…</option>
                        ${isTimestamp ? '<option value="CURRENT_TIMESTAMP">CURRENT_TIMESTAMP</option>' : ''}
                    </select>
                    <span class="col-default-value-wrap" style="display:none">
                        <input class="col-default-value tbl-input" value="" style="width:100px;margin-top:4px">
                    </span>
                `;
            } else if (isTimestamp) {
                if (!existing.querySelector('option[value="CURRENT_TIMESTAMP"]')) {
                    existing.insertAdjacentHTML('beforeend', '<option value="CURRENT_TIMESTAMP">CURRENT_TIMESTAMP</option>');
                }
            } else {
                const opt = existing.querySelector('option[value="CURRENT_TIMESTAMP"]');
                if (opt) opt.remove();
            }
        }
    }
}

function setVisible(el, visible) {
    if (el) el.style.display = visible ? '' : 'none';
}

function reindexRows(tbody) {
    tbody.querySelectorAll('tr[data-idx]').forEach((tr, i) => {
        tr.dataset.idx = i;
    });
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────
function setBreadcrumb(items) {
    const bc = document.getElementById('breadcrumb');
    bc.innerHTML = items.map((item, i) => {
        const sep = i > 0 ? '<span class="crumb-sep">›</span>' : '';
        if (item.onClick) {
            return `${sep}<span class="crumb" style="cursor:pointer;color:var(--accent)" data-idx="${i}">${escHtml(item.label)}</span>`;
        }
        return `${sep}<span class="crumb${item.active ? ' active' : ''}">${escHtml(item.label)}</span>`;
    }).join('');

    items.forEach((item, i) => {
        if (item.onClick) {
            bc.querySelectorAll(`[data-idx="${i}"]`).forEach(el => {
                el.addEventListener('click', item.onClick);
            });
        }
    });
}

// ── Topbar actions ────────────────────────────────────────────────────────────
// Each action: { label, onClick } or { label, dropdown: [{ label, onClick }, ...] }
function setTopbarActions(actions) {
    const container = document.getElementById('topbar-actions');
    container.innerHTML = '';

    // Close any open dropdowns on outside click
    document.addEventListener('click', closeAllDropdowns, { capture: true });

    actions.forEach((a, i) => {
        if (a.dropdown) {
            const wrap = document.createElement('div');
            wrap.className = 'topbar-dropdown-wrap';
            wrap.innerHTML = `
                <button class="btn btn-default btn-sm topbar-dropdown-btn" data-action-idx="${i}">
                    ${escHtml(a.label)}
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style="margin-left:2px;opacity:.6">
                        <path d="M2 3.5l3 3 3-3"/>
                    </svg>
                </button>
                <div class="topbar-dropdown-menu" id="tdm-${i}">
                    ${a.dropdown.map((item, j) =>
                        `<button class="topbar-dropdown-item" data-ddidx="${i}" data-itemidx="${j}">${escHtml(item.label)}</button>`
                    ).join('')}
                </div>
            `;

            wrap.querySelector('.topbar-dropdown-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const menu = wrap.querySelector('.topbar-dropdown-menu');
                const isOpen = menu.classList.contains('open');
                closeAllDropdowns();
                if (!isOpen) menu.classList.add('open');
            });

            a.dropdown.forEach((item, j) => {
                wrap.querySelector(`[data-ddidx="${i}"][data-itemidx="${j}"]`)
                    .addEventListener('click', () => { closeAllDropdowns(); item.onClick(); });
            });

            container.appendChild(wrap);
        } else {
            const btn = document.createElement('button');
            btn.className = 'btn btn-default btn-sm';
            btn.dataset.actionIdx = i;
            btn.textContent = a.label;
            btn.addEventListener('click', a.onClick);
            container.appendChild(btn);
        }
    });
}

function closeAllDropdowns() {
    document.querySelectorAll('.topbar-dropdown-menu.open').forEach(m => m.classList.remove('open'));
}

// ── SQL Panel ─────────────────────────────────────────────────────────────────
// CodeMirror instance for the SQL panel
let sqlCm = null;

function setSqlPanel(sql) {
    state.lastSql = sql;
    if (sqlCm) sqlCm.setValue(sql);
    updateSqlBadgeBtn();
}

function updateSqlBadgeBtn() {
    const btn = document.getElementById('sql-badge-btn');
    if (!btn) return;
    btn.classList.toggle('hidden', !state.lastSql);
}

function toggleSqlPanel(forceOpen = null) {
    state.sqlPanelOpen = forceOpen !== null ? forceOpen : !state.sqlPanelOpen;
    const panel = document.getElementById('sql-panel');
    if (!panel) return;
    if (state.sqlPanelOpen) {
        panel.classList.remove('hidden');
        if (sqlCm) {
            sqlCm.setValue(state.lastSql || '');
            setTimeout(() => { sqlCm.refresh(); sqlCm.focus(); }, 30);
        }
    } else {
        panel.classList.add('hidden');
    }
    const badge = document.getElementById('sql-badge-btn');
    if (badge) badge.classList.toggle('active', state.sqlPanelOpen);
}

function renderSqlPanel(container) {
    const panel = document.createElement('div');
    panel.id = 'sql-panel';
    panel.className = 'sql-panel' + (state.sqlPanelOpen ? '' : ' hidden');
    panel.innerHTML = `
        <div class="sql-panel-header">
            <span class="sql-panel-title">SQL</span>
            <div class="sql-panel-hints">Ctrl+Enter to execute</div>
            <div class="sql-panel-actions">
                <button class="btn btn-accent btn-sm" id="sql-execute-btn">Execute</button>
                <button class="btn btn-default btn-sm" id="sql-clear-btn">Clear</button>
                <button class="btn-filter-remove" id="sql-close-btn" title="Close">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
                    </svg>
                </button>
            </div>
        </div>
        <div id="sql-cm-wrap"></div>
        <div id="sql-result" class="sql-result hidden"></div>
    `;

    container.appendChild(panel);

    // Init CodeMirror after element is in DOM
    const cmWrap = panel.querySelector('#sql-cm-wrap');
    if (window.CodeMirror) {
        sqlCm = CodeMirror(cmWrap, {
            value:        state.lastSql || '',
            mode:         'text/x-mysql',
            theme:        'dracula',
            lineNumbers:  true,
            indentWithTabs: false,
            indentUnit:   4,
            tabSize:      4,
            lineWrapping: true,
            autofocus:    false,
            extraKeys: {
                'Ctrl-Enter': () => executeSqlPanel(),
                'Cmd-Enter':  () => executeSqlPanel(),
            },
        });
    } else {
        // Fallback plain textarea
        cmWrap.innerHTML = `<textarea id="sql-panel-textarea" class="sql-textarea" spellcheck="false">${escHtml(state.lastSql || '')}</textarea>`;
    }

    panel.querySelector('#sql-close-btn').addEventListener('click', () => toggleSqlPanel(false));

    panel.querySelector('#sql-clear-btn').addEventListener('click', () => {
        if (sqlCm) sqlCm.setValue('');
        else panel.querySelector('#sql-panel-textarea').value = '';
        const res = document.getElementById('sql-result');
        if (res) { res.className = 'sql-result hidden'; res.innerHTML = ''; }
    });

    panel.querySelector('#sql-execute-btn').addEventListener('click', () => executeSqlPanel());
}

async function executeSqlPanel() {
    const result = document.getElementById('sql-result');
    const sql    = sqlCm ? sqlCm.getValue().trim() : document.getElementById('sql-panel-textarea')?.value.trim();
    if (!sql || !result) return;

    const btn = document.getElementById('sql-execute-btn');
    btn.disabled = true;
    btn.textContent = 'Running…';
    result.className = 'sql-result';
    result.innerHTML = '<div style="display:flex;gap:8px;align-items:center;color:var(--text-muted)"><div class="spinner"></div> Executing…</div>';

    try {
        const data = await fetch('api/sql_query.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ database: state.currentDb, sql }),
        });
        const res = await data.json();

        if (!res.success) {
            result.className = 'sql-result sql-result-error';
            result.innerHTML = `<div class="sql-error-msg">${escHtml(res.error)}</div>`;
        } else if (res.rows !== undefined) {
            // SELECT — render table
            renderSqlResultTable(result, res);
        } else {
            // Non-SELECT
            result.className = 'sql-result sql-result-ok';
            result.innerHTML = `<span>✓ Query OK — ${res.affected} row${res.affected !== 1 ? 's' : ''} affected</span>`;
            // Refresh table data if we're in a table view
            if (state.currentTable) {
                loadTableData(state.currentDb, state.currentTable, state.page);
            }
        }
    } catch (err) {
        result.className = 'sql-result sql-result-error';
        result.innerHTML = `<div class="sql-error-msg">${escHtml(err.message)}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Execute';
    }
}

function renderSqlResultTable(container, res) {
    const { columns, rows, affected } = res;
    container.className = 'sql-result sql-result-ok';

    if (!rows || !rows.length) {
        container.innerHTML = `<span style="color:var(--text-muted)">No rows returned</span>`;
        return;
    }

    const info = document.createElement('div');
    info.className = 'sql-result-info';
    info.textContent = `${rows.length} row${rows.length !== 1 ? 's' : ''}`;

    const wrap = document.createElement('div');
    wrap.className = 'data-table-wrap sql-result-table-wrap';

    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `
        <thead><tr>${columns.map(c => `<th>${escHtml(c)}</th>`).join('')}</tr></thead>
        <tbody>
            ${rows.map(row => `<tr>${columns.map(col => {
                const v = row[col];
                if (v === null) return `<td class="null-val">NULL</td>`;
                if (typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v))) return `<td class="num-val">${escHtml(String(v))}</td>`;
                if (isDateLike(String(v))) return `<td class="date-val">${escHtml(String(v))}</td>`;
                return `<td title="${escAttr(String(v))}">${escHtml(String(v))}</td>`;
            }).join('')}</tr>`).join('')}
        </tbody>
    `;
    wrap.appendChild(table);
    container.innerHTML = '';
    container.appendChild(info);
    container.appendChild(wrap);
}

// ── Create Table ──────────────────────────────────────────────────────────────
function showCreateTable(dbName) {
    setBreadcrumb([
        { label: dbName, onClick: () => selectDatabase(dbName) },
        { label: 'Create Table', active: true },
    ]);
    setTopbarActions([]);

    const area = document.getElementById('content-area');
    area.innerHTML = `
        <div class="table-view-header">
            <div class="table-view-title">Create Table — ${escHtml(dbName)}</div>
            <div class="table-view-actions">
                <button class="btn btn-accent btn-sm" id="create-save-btn">Save</button>
            </div>
        </div>

        <div class="create-table-meta">
            <div class="ct-field">
                <label>Table name</label>
                <input class="tbl-input" id="ct-name" placeholder="table_name" style="width:200px">
            </div>
            <div class="ct-field">
                <label>Engine</label>
                <select class="tbl-input tbl-select" id="ct-engine" style="width:120px">
                    <option value="">Default</option>
                    <option value="InnoDB" selected>InnoDB</option>
                    <option value="MyISAM">MyISAM</option>
                    <option value="MEMORY">MEMORY</option>
                    <option value="CSV">CSV</option>
                    <option value="ARCHIVE">ARCHIVE</option>
                </select>
            </div>
            <div class="ct-field">
                <label>Collation</label>
                <select class="tbl-input tbl-select" id="ct-collation" style="width:190px">
                    <option value="">Default</option>
                    <option value="utf8mb4_general_ci">utf8mb4_general_ci</option>
                    <option value="utf8mb4_unicode_ci">utf8mb4_unicode_ci</option>
                    <option value="utf8mb4_0900_ai_ci">utf8mb4_0900_ai_ci</option>
                    <option value="utf8_general_ci">utf8_general_ci</option>
                    <option value="latin1_swedish_ci">latin1_swedish_ci</option>
                </select>
            </div>
            <div class="ct-field">
                <label>Comment</label>
                <input class="tbl-input" id="ct-comment" placeholder="optional" style="width:200px">
            </div>
        </div>

        <div class="struct-editor" style="margin-top:16px">
            <table class="data-table struct-edit-table">
                <thead>
                    <tr>
                        <th class="col-drag-th"></th>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Length / Values</th>
                        <th>Unsigned</th>
                        <th>Allow NULL</th>
                        <th>Default</th>
                        <th>A_I</th>
                        <th>Primary</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody id="struct-editor-body"></tbody>
            </table>
            <div style="margin-top:12px">
                <button class="btn btn-default btn-sm" id="struct-add-col">+ Add Column</button>
            </div>
        </div>

        <div id="create-error" class="error-msg hidden" style="margin-top:14px"></div>
    `;

    // Add default columns: id + one empty
    const defaultCols = [
        {
            originalName: '', name: 'id',
            baseType: 'INT', length: '11', decimals: '', enumValues: '',
            unsigned: true, allowNull: false,
            defaultType: 'NULL', defaultValue: '',
            autoIncrement: true, key: 'PRI', extra: '',
        },
        {
            originalName: '', name: 'name',
            baseType: 'VARCHAR', length: '255', decimals: '', enumValues: '',
            unsigned: false, allowNull: true,
            defaultType: 'NULL', defaultValue: '',
            autoIncrement: false, key: '', extra: '',
        },
    ];

    const tbody = area.querySelector('#struct-editor-body');
    defaultCols.forEach((col, i) => tbody.insertAdjacentHTML('beforeend', buildEditorRow(col, i)));

    wireEditorEvents(area, [], () => {});

    // Save
    area.querySelector('#create-save-btn').addEventListener('click', async () => {
        const tableName = area.querySelector('#ct-name').value.trim();
        if (!tableName) {
            showCreateError('Table name is required');
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
            showCreateError('Table name can only contain letters, numbers and underscores');
            return;
        }

        const columns = collectEditorState();
        if (!columns.length) {
            showCreateError('Add at least one column');
            return;
        }

        const btn = area.querySelector('#create-save-btn');
        btn.disabled = true;
        btn.textContent = 'Saving…';

        try {
            await api('create_table', {
                database:  dbName,
                table:     tableName,
                engine:    area.querySelector('#ct-engine').value,
                collation: area.querySelector('#ct-collation').value,
                comment:   area.querySelector('#ct-comment').value.trim(),
                columns,
            });
            toast('Table created successfully', 'success');

            // Reload sidebar tables for this db
            const dbItem = document.querySelector(`.db-item[data-db="${CSS.escape(dbName)}"]`);
            if (dbItem) {
                const tablesEl = dbItem.querySelector('.db-tables');
                if (tablesEl) {
                    delete tablesEl.dataset.loaded;
                    tablesEl.innerHTML = '';
                    if (dbItem.classList.contains('open')) {
                        tablesEl.innerHTML = '<div class="loading-tree" style="padding-left:36px"><div class="spinner"></div></div>';
                        const data = await api('tables', { database: dbName });
                        tablesEl.dataset.loaded = '1';
                        renderTables(tablesEl, dbName, data.tables || []);
                    }
                }
            }

            loadTableData(dbName, tableName, 1);
        } catch (err) {
            showCreateError(err.message);
            btn.disabled = false;
            btn.textContent = 'Save';
        }
    });

    function showCreateError(msg) {
        const el = area.querySelector('#create-error');
        el.textContent = msg;
        el.classList.remove('hidden');
    }
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function isDateLike(val) {
    return /^\d{4}-\d{2}-\d{2}/.test(String(val));
}

// ── Boot ──────────────────────────────────────────────────────────────────────
init();
