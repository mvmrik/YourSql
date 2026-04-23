// ── Filter bar ────────────────────────────────────────────────────────────────

const FILTER_OPS = ['=','!=','<','>','<=','>=','LIKE','NOT LIKE','LIKE %%','REGEXP','NOT REGEXP','IN','NOT IN','IS NULL','IS NOT NULL'];
const OPS_NO_VALUE = new Set(['IS NULL','IS NOT NULL']);

function renderFilterBar(container: HTMLElement, columns: string[], colMeta: Record<string, ColumnDef>): void {
    renderFilterRows(container, columns, colMeta);
}

function renderFilterRows(container: HTMLElement, columns: string[], colMeta: Record<string, ColumnDef>): void {
    container.innerHTML = '';

    if (!state.filters.length && !state.sort.length) {
        container.innerHTML = `<div class="filter-bar-empty">Click a column header to add a filter</div>`;
        return;
    }

    const bar = document.createElement('div');
    bar.className = 'filter-bar-inner';

    if (state.filters.length) {
        const filterSection = document.createElement('div');
        filterSection.className = 'filter-section';
        state.filters.forEach((f, idx) => {
            filterSection.appendChild(buildFilterRow(f, idx, columns, colMeta));
        });
        bar.appendChild(filterSection);
    }

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
                if (!colSel.value) sortList.splice(i, 1), renderSortRows();
                state.sort = sortList.filter(s => s.col);
                runSearch();
            });
            dirSel.addEventListener('change', () => {
                sortList[i].dir = dirSel.value as 'ASC' | 'DESC';
                state.sort = sortList.filter(s => s.col);
                runSearch();
            });

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

            sg.append(colSel, dirSel, removeBtn);
            sortRows.appendChild(sg);
        });

        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-default btn-sm filter-add-sort';
        addBtn.textContent = '+ add sort';
        addBtn.addEventListener('click', () => {
            sortList.push({ col: '', dir: 'ASC' });
            renderSortRows();
            const sels = sortRows.querySelectorAll('.filter-sort-col');
            (sels[sels.length - 1] as HTMLElement)?.focus();
        });
        sortRows.appendChild(addBtn);
    };

    renderSortRows();
    bar.appendChild(sortSection);

    const bottomRow = document.createElement('div');
    bottomRow.className = 'filter-bottom-row';

    const limitWrap = document.createElement('div');
    limitWrap.className = 'filter-limit-wrap';
    limitWrap.innerHTML = `<span class="filter-label">Limit</span>`;
    const limitInput = document.createElement('input') as HTMLInputElement;
    limitInput.type = 'number'; limitInput.min = '1'; limitInput.max = '10000'; limitInput.step = '1';
    limitInput.className = 'tbl-input filter-limit-input';
    limitInput.value = String(state.pageSize);
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
        state.filters = []; state.sort = []; state.pageSize = 50;
        runSearch();
    });
    bottomRow.appendChild(resetBtn);

    bar.appendChild(bottomRow);
    container.appendChild(bar);
}

function buildFilterRow(f: Filter, idx: number, columns: string[], colMeta: Record<string, ColumnDef>): HTMLElement {
    const row = document.createElement('div');
    row.className = 'filter-row';

    const colSel = document.createElement('select');
    colSel.className = 'tbl-input tbl-select filter-col-select';
    colSel.innerHTML = columns.map(c =>
        `<option value="${escAttr(c)}"${f.col === c ? ' selected' : ''}>${escHtml(c)}</option>`
    ).join('');

    const opSel = document.createElement('select');
    opSel.className = 'tbl-input tbl-select filter-op-select';
    opSel.innerHTML = FILTER_OPS.map(op =>
        `<option${f.op === op ? ' selected' : ''}>${escHtml(op)}</option>`
    ).join('');

    const valWrap = document.createElement('div');
    valWrap.className = 'filter-val-wrap';

    const buildValInput = (op: string, currentVal: any) => {
        valWrap.innerHTML = '';
        if (OPS_NO_VALUE.has(op)) return;
        const meta = colMeta[colSel.value] || {};
        const inp = buildCellInput(meta, currentVal ?? '', true);
        inp.className = 'tbl-input filter-val-input';
        (inp as HTMLInputElement).placeholder = op === 'IN' || op === 'NOT IN' ? '1,2,3' : op === 'LIKE %%' ? 'search term' : 'value';
        inp.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') runSearch(); });
        valWrap.appendChild(inp);
    };

    buildValInput(f.op, f.val);

    colSel.addEventListener('change', () => { state.filters[idx].col = colSel.value; buildValInput(opSel.value, ''); });
    opSel.addEventListener('change', () => {
        state.filters[idx].op = opSel.value;
        buildValInput(opSel.value, (valWrap.querySelector('.filter-val-input') as HTMLInputElement)?.value ?? '');
    });
    valWrap.addEventListener('input', (e: Event) => {
        if ((e.target as Element).classList.contains('filter-val-input'))
            state.filters[idx].val = (e.target as HTMLInputElement).value;
    });
    valWrap.addEventListener('change', (e: Event) => {
        if ((e.target as Element).classList.contains('filter-val-input'))
            state.filters[idx].val = (e.target as HTMLInputElement).value;
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-filter-remove';
    removeBtn.title = 'Remove filter';
    removeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
    </svg>`;
    removeBtn.addEventListener('click', () => { state.filters.splice(idx, 1); runSearch(); });

    row.append(colSel, opSel, valWrap, removeBtn);
    return row;
}

function refreshFilterBar(columns: string[], colMeta: Record<string, ColumnDef>): void {
    const container = document.getElementById('filter-bar');
    if (container) renderFilterRows(container, columns, colMeta);
}

function addFilter(col: string): void {
    const existing = state.filters.find(f => f.col === col);
    if (existing) {
        const bar  = document.getElementById('filter-bar');
        const rows = bar?.querySelectorAll('.filter-row');
        if (rows) {
            const idx = state.filters.indexOf(existing);
            (rows[idx]?.querySelector('.filter-val-input') as HTMLElement)?.focus();
        }
        return;
    }

    const meta = (state.colMeta[col] || {}) as Partial<ColumnDef>;
    const defaultOp = (meta.baseType && ['TINYINT','SMALLINT','MEDIUMINT','INT','BIGINT','FLOAT','DOUBLE','DECIMAL','NUMERIC'].includes(meta.baseType)) ? '=' : 'LIKE';
    state.filters.push({ col, op: defaultOp, val: '' });

    if (!state.sort.length) state.sort = [{ col, dir: 'ASC' }];

    refreshFilterBar(Object.keys(state.colMeta), state.colMeta);

    const bar  = document.getElementById('filter-bar');
    const rows = bar?.querySelectorAll('.filter-row');
    if (rows?.length) (rows[rows.length - 1].querySelector('.filter-val-input') as HTMLElement)?.focus();
}

function runSearch(): void {
    const bar = document.getElementById('filter-bar');
    bar?.querySelectorAll('.filter-row').forEach((row, idx) => {
        const val = (row.querySelector('.filter-val-input') as HTMLInputElement)?.value ?? '';
        if (state.filters[idx]) state.filters[idx].val = val;
    });
    loadTableData(state.currentDb!, state.currentTable!, 1);
}
