// ── Insert new row ────────────────────────────────────────────────────────────

function buildInsertRow(columns: string[], colMeta: Record<string, ColumnDef>, prefill: Record<string, any> | null): HTMLElement {
    const tr = document.createElement('tr');
    tr.className = 'insert-row';

    const checkTd = document.createElement('td');
    checkTd.className = 'td-check-col';
    checkTd.innerHTML = `<button class="btn-cancel-insert" title="Cancel">
        <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2.146 2.854a.5.5 0 11.708-.708L8 7.293l5.146-5.147a.5.5 0 01.708.708L8.707 8l5.147 5.146a.5.5 0 01-.708.708L8 8.707l-5.146 5.147a.5.5 0 01-.708-.708L7.293 8 2.146 2.854z"/>
        </svg>
    </button>`;
    tr.appendChild(checkTd);

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
        const meta  = (colMeta[col] || {}) as Partial<ColumnDef>;
        const isPK  = meta.key === 'PRI' && meta.autoIncrement;

        const td = document.createElement('td');
        td.className    = 'insert-cell';
        td.dataset.col  = col;

        if (isPK) {
            td.innerHTML = `<span class="insert-ai-hint">auto</span>`;
        } else {
            const prefillVal = prefill ? (prefill[col] ?? null) : null;
            const input      = buildCellInput(meta, prefillVal, true);
            input.className  = 'inline-edit-input insert-input';
            (input as HTMLElement).dataset.col = col;
            input.addEventListener('keydown', (e: Event) => {
                const ke = e as KeyboardEvent;
                if (ke.key === 'Enter') {
                    ke.preventDefault();
                    const inputs = [...tr.querySelectorAll('.insert-input')] as HTMLElement[];
                    const next   = inputs[inputs.indexOf(e.target as HTMLElement) + 1];
                    if (next) next.focus();
                    else saveNewRow(tr, columns, colMeta);
                }
                if (ke.key === 'Escape') cancelInsertRow(tr);
            });
            td.appendChild(input);
        }

        tr.appendChild(td);
    });

    return tr;
}

function insertNewRows(tbody: HTMLElement, columns: string[], colMeta: Record<string, ColumnDef>, prefillList: (Record<string, any> | null)[]): void {
    tbody.querySelectorAll('tr.insert-row, tr.insert-group-bar').forEach(r => r.remove());

    const rows = prefillList.map(prefill => buildInsertRow(columns, colMeta, prefill));

    const anchor = tbody.firstChild;
    rows.forEach(tr => tbody.insertBefore(tr, anchor));

    const multi = rows.length > 1;

    rows.forEach(tr => {
        tr.querySelector('.btn-cancel-insert')!.addEventListener('click', () => {
            cancelInsertRow(tr);
            updateGroupBar(tbody, columns, colMeta);
        });
        tr.querySelector('.btn-row-save')!.addEventListener('click', () => {
            if (multi) return;
            saveNewRow(tr, columns, colMeta);
        });
    });

    if (multi) {
        renderGroupBar(tbody, columns, colMeta, rows);
    }

    (rows[0]?.querySelector('.insert-input') as HTMLElement)?.focus();
}

function renderGroupBar(tbody: HTMLElement, columns: string[], colMeta: Record<string, ColumnDef>, rows: HTMLElement[]): void {
    tbody.querySelector('tr.insert-group-bar')?.remove();

    const insertRows = [...tbody.querySelectorAll('tr.insert-row')] as HTMLElement[];
    if (insertRows.length === 0) return;
    if (insertRows.length === 1) {
        (insertRows[0].querySelector('.btn-row-save') as HTMLElement).onclick = () => saveNewRow(insertRows[0], columns, colMeta);
        return;
    }

    const bar      = document.createElement('tr');
    bar.className  = 'insert-group-bar';
    const colSpan  = columns.length + 2;
    bar.innerHTML  = `<td colspan="${colSpan}">
        <button class="btn-group-cancel">Cancel all</button>
        <button class="btn-group-save">Save all</button>
    </td>`;

    const lastInsert = insertRows[insertRows.length - 1];
    lastInsert.after(bar);

    bar.querySelector('.btn-group-cancel')!.addEventListener('click', () => {
        tbody.querySelectorAll('tr.insert-row, tr.insert-group-bar').forEach(r => r.remove());
    });

    bar.querySelector('.btn-group-save')!.addEventListener('click', async () => {
        const trs       = [...tbody.querySelectorAll('tr.insert-row')] as HTMLElement[];
        const saveBtn   = bar.querySelector('.btn-group-save') as HTMLButtonElement;
        const cancelBtn = bar.querySelector('.btn-group-cancel') as HTMLButtonElement;
        saveBtn.disabled   = true;
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
            loadTableData(state.currentDb!, state.currentTable!, state.page);
        } else {
            saveBtn.disabled   = false;
            cancelBtn.disabled = false;
        }
    });
}

function updateGroupBar(tbody: HTMLElement, columns: string[], colMeta: Record<string, ColumnDef>): void {
    const insertRows = [...tbody.querySelectorAll('tr.insert-row')] as HTMLElement[];
    tbody.querySelector('tr.insert-group-bar')?.remove();
    if (insertRows.length > 1) {
        renderGroupBar(tbody, columns, colMeta, insertRows);
    } else if (insertRows.length === 1) {
        (insertRows[0].querySelector('.btn-row-save') as HTMLElement).onclick = () => saveNewRow(insertRows[0], columns, colMeta);
    }
}

function cancelInsertRow(tr: HTMLElement): void {
    tr.remove();
}

async function saveNewRow(tr: HTMLElement, columns: string[], colMeta: Record<string, ColumnDef>, silent = false): Promise<void> {
    const values: Record<string, any> = {};

    columns.forEach(col => {
        const meta  = (colMeta[col] || {}) as Partial<ColumnDef>;
        const isPK  = meta.key === 'PRI' && meta.autoIncrement;
        if (isPK) return;

        const input = tr.querySelector(`.insert-input[data-col="${CSS.escape(col)}"]`) as HTMLElement;
        if (!input) return;

        const val = getCellInputValue(input, meta);
        values[col] = (val === '' && meta.allowNull) ? null : val;
    });

    const saveBtn = tr.querySelector('.btn-row-save') as HTMLButtonElement;
    saveBtn.disabled = true;

    try {
        await api('insert_row', {
            database: state.currentDb,
            table:    state.currentTable,
            values,
        });

        tr.remove();
        if (!silent) {
            toast('Row inserted', 'success');
            loadTableData(state.currentDb!, state.currentTable!, state.page);
        }
    } catch (err: any) {
        toast('Error: ' + err.message, 'error');
        saveBtn.disabled = false;
        throw err;
    }
}
