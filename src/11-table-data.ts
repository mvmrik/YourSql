// ── Table data ────────────────────────────────────────────────────────────────

async function loadTableData(dbName: string, tableName: string, page = 1, opts: { resetFilters?: boolean } = {}): Promise<void> {
    const isNewTable = dbName !== state.currentDb || tableName !== state.currentTable;
    if (isNewTable) stopAutoRefresh();

    // Tab management: save current, find-or-create target tab
    const { isExisting } = tabsBeforeLoad(dbName, tableName);

    state.currentDb    = dbName;
    state.currentTable = tableName;
    state.page         = page;

    // For an existing tab switching via sidebar click — treat as new load but keep tab state only when resetFilters
    if (isNewTable || opts.resetFilters) {
        if (!isExisting || opts.resetFilters) {
            state.filters    = [];
            state.sort       = [];
            state.pageSize   = 50;
            state.lastSql    = null;
            state.sqlPanelOpen = false;
        }
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
                const ta = document.getElementById('sql-panel-textarea') as HTMLTextAreaElement;
                if (ta) ta.value = '';
                const res = document.getElementById('sql-result');
                if (res) { res.className = 'sql-result hidden'; res.innerHTML = ''; }
                toggleSqlPanel(true);
            }},
        ]},
    ]);

    const area = document.getElementById('content-area')!;

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
        renderSqlPanel(document.getElementById('sql-panel-wrap')!);
        document.getElementById('sql-badge-btn')!.addEventListener('click', () => toggleSqlPanel());
        _bindRefreshBtn();
    } else {
        updateSqlBadgeBtn();
    }

    if (!isFirstRender) {
        const tc = document.getElementById('table-content') as HTMLElement;
        if (tc) tc.style.display = 'none';
        let tl = document.getElementById('table-loading') as HTMLElement;
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
        let colMeta = state.colMeta;
        const promises: Promise<any>[] = [
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

        const results  = await Promise.all(promises);
        const dataRes  = results[0];
        const structRes = results[1] || null;

        state.totalRows = dataRes.total;
        state.selection = { mode: 'none', pageRows: [] };

        if (structRes) {
            const cm: Record<string, ColumnDef> = {};
            (structRes.structure || []).forEach((row: any) => {
                const parsed = parseColumnDef(row);
                cm[parsed.name] = parsed;
            });
            state.colMeta = cm;
            colMeta = cm;
        }

        (document.getElementById('table-loading') as HTMLElement).style.display = 'none';
        const content = document.getElementById('table-content') as HTMLElement;
        content.style.display = 'block';
        content.innerHTML = '';

        renderFilterBar(document.getElementById('filter-bar')!, dataRes.columns || [], colMeta);
        renderTableData(content, dataRes, colMeta);
        tabsAfterLoad();
    } catch (err: any) {
        const tl = document.getElementById('table-loading');
        if (tl) tl.innerHTML = `<span style="color:var(--danger)">${escHtml(err.message)}</span>`;
    }
}

function renderCellView(td: HTMLElement, val: any): void {
    if (val === null || val === undefined) {
        td.className = 'null-val'; td.textContent = 'NULL';
    } else if (typeof val === 'number' || /^-?\d+(\.\d+)?$/.test(String(val)) && String(val).length < 20) {
        td.className = 'num-val'; td.textContent = String(val);
    } else if (isDateLike(String(val))) {
        td.className = 'date-val'; td.textContent = String(val);
    } else {
        td.className = 'str-val'; td.title = String(val); td.textContent = String(val);
    }
}

function renderTableData(container: HTMLElement, data: any, colMeta: Record<string, ColumnDef> = {}): void {
    const { columns, rows, total, page, page_size } = data;

    if (!columns || !columns.length) {
        container.innerHTML = '<div class="table-empty">No columns found.</div>';
        return;
    }

    const totalPages = Math.ceil(total / page_size);
    const wrap  = document.createElement('div');
    wrap.className = 'data-table-wrap';
    const table = document.createElement('table');
    table.className = 'data-table';

    const thead  = document.createElement('thead');
    const thRow  = document.createElement('tr');

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

    columns.forEach((c: string) => {
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

        arrow.addEventListener('click', (e: Event) => {
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

        th.append(label, arrow);
        thRow.appendChild(th);
    });

    thead.appendChild(thRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    if (!rows || !rows.length) {
        tbody.innerHTML = `<tr><td colspan="${columns.length + 2}" class="table-empty">No rows</td></tr>`;
    } else {
        rows.forEach((row: any) => tbody.appendChild(buildDataRow(row, columns, colMeta)));
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);

    const bulkBar = document.createElement('div');
    bulkBar.className = 'bulk-bar hidden';
    bulkBar.id = 'bulk-bar';
    bulkBar.innerHTML = `
        <span class="bulk-info" id="bulk-info"></span>
        <button class="btn btn-default btn-sm" id="bulk-edit-btn">Edit selected</button>
    `;
    container.appendChild(bulkBar);

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
        renderPagination(pag.querySelector('#pag-btns')!, page, totalPages);
    }

    thead.querySelector('#btn-insert-row')!.addEventListener('click', () => {
        const sel = getSelectedRows();
        const prefillList = (sel.mode !== 'none' && sel.rows.length > 0) ? sel.rows : [null];
        insertNewRows(tbody, columns, colMeta, prefillList);
    });

    const hdrCb   = thead.querySelector('#hdr-checkbox') as HTMLInputElement;
    const hdrDrop = thead.querySelector('#hdr-check-dropdown')!;

    hdrCb.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        hdrDrop.classList.toggle('open');
    });
    document.addEventListener('click', () => hdrDrop.classList.remove('open'), { capture: false });

    thead.querySelector('#sel-page-btn')?.addEventListener('click', () => { setSelectionMode('page', rows, tbody, hdrCb); hdrDrop.classList.remove('open'); });
    thead.querySelector('#sel-none-btn')?.addEventListener('click', () => { setSelectionMode('none', rows, tbody, hdrCb); hdrDrop.classList.remove('open'); });
    thead.querySelector('#sel-all-btn')?.addEventListener('click', () => { setSelectionMode('all', rows, tbody, hdrCb); hdrDrop.classList.remove('open'); });

    tbody.addEventListener('change', (e: Event) => {
        if (!(e.target as Element).classList.contains('row-checkbox')) return;
        const tr = (e.target as Element).closest('tr.data-row') as HTMLElement;
        if (!tr) return;
        tr.classList.toggle('row-selected', (e.target as HTMLInputElement).checked);
        syncSelectionState(rows, tbody, hdrCb);
    });

    bulkBar.querySelector('#bulk-edit-btn')!.addEventListener('click', () => openBulkEditModal(columns, colMeta));

    state.selection.pageRows = rows;
}

// ── Selection helpers ─────────────────────────────────────────────────────────

function setSelectionMode(mode: 'none' | 'page' | 'all', rows: any[], tbody: HTMLElement, hdrCb: HTMLInputElement): void {
    state.selection.mode = mode;
    const checkAll = mode === 'page' || mode === 'all';
    tbody.querySelectorAll('tr.data-row').forEach(tr => {
        const cb = tr.querySelector('.row-checkbox') as HTMLInputElement;
        if (cb) cb.checked = checkAll;
        tr.classList.toggle('row-selected', checkAll);
    });
    hdrCb.checked = checkAll;
    hdrCb.indeterminate = false;
    const selCount = mode === 'all' ? state.totalRows : (checkAll ? rows.length : 0);
    updateBulkBar(selCount, mode);
    updateInsertBtn(selCount);
}

function syncSelectionState(rows: any[], tbody: HTMLElement, hdrCb: HTMLInputElement): void {
    const cbs     = [...tbody.querySelectorAll('tr.data-row .row-checkbox')] as HTMLInputElement[];
    const checked = cbs.filter(c => c.checked).length;
    hdrCb.checked       = checked === cbs.length && cbs.length > 0;
    hdrCb.indeterminate = checked > 0 && checked < cbs.length;
    state.selection.mode = checked === 0 ? 'none' : 'page';
    updateBulkBar(checked, 'page');
    updateInsertBtn(checked);
}

function updateInsertBtn(checkedCount: number): void {
    const btn = document.getElementById('btn-insert-row') as HTMLButtonElement;
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

function updateBulkBar(count: number, mode: string): void {
    const bar  = document.getElementById('bulk-bar');
    const info = document.getElementById('bulk-info');
    if (!bar) return;
    if (count === 0) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    info!.textContent = mode === 'all'
        ? `All ${count} rows selected (whole result)`
        : `${count} row${count !== 1 ? 's' : ''} selected`;
}

function getSelectedRows(): { mode: string; rows: any[] } {
    const trs = [...document.querySelectorAll('tr.data-row')].filter(tr => {
        const cb = tr.querySelector('.row-checkbox') as HTMLInputElement;
        return cb && cb.checked;
    }) as any[];
    return { mode: state.selection.mode, rows: trs.map(tr => tr._rowData) };
}

// ── Build a data row ──────────────────────────────────────────────────────────

function buildDataRow(row: Record<string, any>, columns: string[], colMeta: Record<string, ColumnDef>): HTMLElement {
    const tr = document.createElement('tr') as any;
    tr.className  = 'data-row';
    tr._rowData   = row;
    tr._colMeta   = colMeta;
    tr._columns   = columns;

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

    tr.append(checkTd, editTd);

    columns.forEach(col => {
        const td = document.createElement('td');
        const val = row[col];
        const meta = colMeta[col] || {};
        td.dataset.col     = col;
        td.dataset.origVal = val === null ? '\x00NULL' : String(val);

        renderCellView(td, val);
        td.addEventListener('dblclick', () => {
            const currentVal = (td.closest('tr') as any)?._rowData?.[col] ?? val;
            startInlineEdit(td, col, currentVal, meta, (td.closest('tr') as any)?._rowData ?? row, columns, colMeta);
        });
        tr.appendChild(td);
    });

    editTd.querySelector('.btn-row-edit')!.addEventListener('click', () => openRowEditModal(row, columns, colMeta));
    return tr;
}

// ── Inline cell edit ──────────────────────────────────────────────────────────

function startInlineEdit(td: HTMLElement, col: string, originalVal: any, meta: Partial<ColumnDef>, row: Record<string, any>, columns: string[], colMeta: Record<string, ColumnDef>): void {
    if (td.classList.contains('editing')) return;
    td.classList.add('editing');

    const input = buildCellInput(meta, originalVal, true);
    input.className = 'inline-edit-input';
    td.innerHTML = '';
    td.appendChild(input);
    (input as HTMLElement).focus();
    if ((input as HTMLInputElement).select) (input as HTMLInputElement).select();

    const commit = async () => {
        const newVal = getCellInputValue(input, meta);
        td.classList.remove('editing');

        if (newVal === originalVal || (originalVal === null && newVal === null)) {
            renderCellView(td, originalVal); return;
        }

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
            const tr = td.closest('tr') as any;
            if (tr) tr._rowData = { ...tr._rowData, [col]: newVal };
        } catch (err: any) {
            td.classList.remove('cell-saving');
            td.classList.add('cell-error');
            setTimeout(() => { td.classList.remove('cell-error'); renderCellView(td, originalVal); }, 2000);
            toast('Error: ' + err.message, 'error');
        }
    };

    const cancel = () => { td.classList.remove('editing'); renderCellView(td, originalVal); };

    input.addEventListener('keydown', (e: Event) => {
        const ke = e as KeyboardEvent;
        if (ke.key === 'Enter' && !ke.shiftKey) { ke.preventDefault(); commit(); }
        if (ke.key === 'Escape') cancel();
    });
    input.addEventListener('blur', () => {
        setTimeout(() => { if (td.classList.contains('editing')) commit(); }, 120);
    });
}

// ── Pagination ────────────────────────────────────────────────────────────────

function renderPagination(container: Element, current: number, total: number): void {
    const range = paginationRange(current, total);
    container.innerHTML = '';

    container.appendChild(makePageBtn('‹', current > 1, () => loadTableData(state.currentDb!, state.currentTable!, current - 1)));

    range.forEach(p => {
        if (p === '…') {
            const el = document.createElement('button');
            el.className = 'page-btn'; el.textContent = '…'; el.disabled = true;
            container.appendChild(el);
        } else {
            const el = makePageBtn(String(p), true, () => loadTableData(state.currentDb!, state.currentTable!, p as number));
            if (p === current) el.classList.add('active');
            container.appendChild(el);
        }
    });

    container.appendChild(makePageBtn('›', current < total, () => loadTableData(state.currentDb!, state.currentTable!, current + 1)));
}

function makePageBtn(label: string, enabled: boolean, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'page-btn'; btn.textContent = label; btn.disabled = !enabled;
    if (enabled) btn.addEventListener('click', onClick);
    return btn;
}

function paginationRange(current: number, total: number): (number | string)[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | string)[] = [];
    pages.push(1);
    if (current > 3) pages.push('…');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('…');
    pages.push(total);
    return pages;
}
