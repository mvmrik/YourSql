// ── Bulk edit modal ───────────────────────────────────────────────────────────

function openBulkEditModal(columns: string[], colMeta: Record<string, ColumnDef>): void {
    const { mode, rows } = getSelectedRows();
    if (!rows.length && mode !== 'all') return;

    closeRowEditModal();
    const existingBulk = document.getElementById('bulk-edit-overlay');
    if (existingBulk) existingBulk.remove();

    const count   = mode === 'all' ? state.totalRows : rows.length;
    const overlay = document.createElement('div');
    overlay.id    = 'bulk-edit-overlay';

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

    const body = overlay.querySelector('#bem-body')!;

    columns.forEach(col => {
        const meta  = (colMeta[col] || {}) as Partial<ColumnDef>;
        const isPK  = meta.key === 'PRI';

        const field = document.createElement('div');
        field.className  = 'rem-field bulk-field';
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
            controlsRow.innerHTML = `<span class="bulk-pk-note">Primary key — not editable in bulk</span>`;
            field.appendChild(labelRow);
            field.appendChild(controlsRow);
            body.appendChild(field);
            return;
        }

        const modeOptions = buildBulkModeOptions(meta);
        const modeSelect  = document.createElement('select');
        modeSelect.className = 'tbl-input tbl-select bulk-mode-select';
        modeSelect.innerHTML = modeOptions;

        const valWrap = document.createElement('div');
        valWrap.className = 'bulk-val-wrap';

        const buildInput = (modeVal: string) => {
            valWrap.innerHTML = '';
            if (modeVal === 'original' || modeVal === 'null') return;

            if (modeVal === 'increment' || modeVal === 'decrement') {
                const inp = document.createElement('input') as HTMLInputElement;
                inp.type = 'number'; inp.step = 'any'; inp.min = '0';
                inp.className   = 'tbl-input bulk-value-input';
                inp.placeholder = 'Amount';
                inp.value       = '1';
                valWrap.appendChild(inp);
                return;
            }

            const inp = buildCellInput(meta, null, false);
            inp.className += ' bulk-value-input';
            valWrap.appendChild(inp);
        };

        modeSelect.addEventListener('change', () => buildInput(modeSelect.value));
        buildInput(modeSelect.value);

        controlsRow.appendChild(modeSelect);
        controlsRow.appendChild(valWrap);
        field.appendChild(labelRow);
        field.appendChild(controlsRow);
        body.appendChild(field);
    });

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#bem-close')!.addEventListener('click', close);
    overlay.querySelector('#bem-cancel')!.addEventListener('click', close);
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });

    // Bulk delete
    overlay.querySelector('#bem-delete')!.addEventListener('click', async () => {
        const label = mode === 'all' ? `all ${count} rows` : `${count} selected row${count !== 1 ? 's' : ''}`;
        if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
        const btn = overlay.querySelector('#bem-delete') as HTMLButtonElement;
        btn.disabled = true; btn.textContent = 'Deleting…';
        try {
            const res = await api('delete_rows', {
                database:   state.currentDb,
                table:      state.currentTable,
                mode,
                where_rows: mode === 'page' ? rows.map((r: any) => buildWhereFromRow(r, colMeta)) : null,
            });
            toast(`Deleted ${res.affected} row${res.affected !== 1 ? 's' : ''}`, 'success');
            close();
            loadTableData(state.currentDb!, state.currentTable!, state.page);
        } catch (err: any) {
            toast('Error: ' + err.message, 'error');
            btn.disabled = false; btn.textContent = `Delete ${count} row${count !== 1 ? 's' : ''}`;
        }
    });

    overlay.querySelector('#bem-save')!.addEventListener('click', async () => {
        const updates: Record<string, any> = {};
        let hasChanges = false;

        body.querySelectorAll('.bulk-field').forEach(field => {
            const fieldEl = field as HTMLElement;
            const col     = fieldEl.dataset.col!;
            const meta    = (colMeta[col] || {}) as Partial<ColumnDef>;
            if (meta.key === 'PRI') return;

            const modeSelect = fieldEl.querySelector('.bulk-mode-select') as HTMLSelectElement | null;
            const modeVal    = modeSelect?.value;
            if (!modeVal || modeVal === 'original') return;

            hasChanges = true;

            if (modeVal === 'null') {
                updates[col] = { op: 'set', value: null };
            } else if (modeVal === 'increment') {
                const amt    = (fieldEl.querySelector('.bulk-value-input') as HTMLInputElement)?.value || '1';
                updates[col] = { op: 'increment', value: parseFloat(amt) };
            } else if (modeVal === 'decrement') {
                const amt    = (fieldEl.querySelector('.bulk-value-input') as HTMLInputElement)?.value || '1';
                updates[col] = { op: 'decrement', value: parseFloat(amt) };
            } else {
                const inp    = fieldEl.querySelector('.bulk-value-input') as HTMLElement | null;
                updates[col] = { op: 'set', value: inp ? getCellInputValue(inp, meta) : '' };
            }
        });

        if (!hasChanges) {
            toast('No changes — set at least one field', 'error');
            return;
        }

        const btn = overlay.querySelector('#bem-save') as HTMLButtonElement;
        btn.disabled    = true;
        btn.textContent = 'Saving…';

        try {
            const res = await api('bulk_update', {
                database:   state.currentDb,
                table:      state.currentTable,
                updates,
                mode,
                where_rows: mode === 'page'
                    ? rows.map((r: any) => buildWhereFromRow(r, colMeta))
                    : null,
            });
            toast(`Updated ${res.affected} row${res.affected !== 1 ? 's' : ''}`, 'success');
            close();
            loadTableData(state.currentDb!, state.currentTable!, state.page);
        } catch (err: any) {
            toast('Error: ' + err.message, 'error');
            btn.disabled    = false;
            btn.textContent = `Apply to ${count} row${count !== 1 ? 's' : ''}`;
        }
    });
}

function buildBulkModeOptions(meta: Partial<ColumnDef>): string {
    const base      = (meta.baseType || '').toUpperCase();
    const isNumeric = ['TINYINT','SMALLINT','MEDIUMINT','INT','BIGINT','FLOAT','DOUBLE','DECIMAL','NUMERIC'].includes(base);
    const isBlob    = ['BLOB','TINYBLOB','MEDIUMBLOB','LONGBLOB'].includes(base);

    let opts = `<option value="original">— original —</option>`;
    if (!isBlob) opts += `<option value="set">Set value</option>`;
    if (isNumeric) {
        opts += `<option value="increment">Increment (+)</option>`;
        opts += `<option value="decrement">Decrement (−)</option>`;
    }
    if (meta.allowNull) opts += `<option value="null">Set NULL</option>`;
    return opts;
}
