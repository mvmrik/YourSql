// ── Row edit modal ────────────────────────────────────────────────────────────

function openRowEditModal(row: Record<string, any>, columns: string[], colMeta: Record<string, ColumnDef>): void {
    closeRowEditModal();

    const overlay = document.createElement('div');
    overlay.id    = 'row-edit-overlay';
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

    const body   = overlay.querySelector('#rem-body')!;
    const fields: { col: string; input: HTMLElement; meta: Partial<ColumnDef> }[] = [];

    columns.forEach(col => {
        const val   = row[col];
        const meta  = (colMeta[col] || {}) as Partial<ColumnDef>;
        const input = buildCellInput(meta, val, false);
        (input as HTMLElement).id           = `rem-field-${col}`;
        (input as HTMLElement).dataset.col  = col;

        const field    = document.createElement('div');
        field.className = 'rem-field';

        const labelRow = document.createElement('div');
        labelRow.className = 'rem-label-row';
        labelRow.innerHTML = `
            <label for="rem-field-${escAttr(col)}" class="rem-label">${escHtml(col)}</label>
            <span class="rem-type-badge">${escHtml(meta.baseType || '')}</span>
            ${meta.allowNull ? `<label class="rem-null-label"><input type="checkbox" class="rem-null-cb tbl-check" data-col="${escAttr(col)}"${val === null ? ' checked' : ''}> NULL</label>` : ''}
        `;

        if (meta.allowNull) {
            const cb = labelRow.querySelector('.rem-null-cb') as HTMLInputElement;
            cb.addEventListener('change', () => {
                (input as HTMLInputElement).disabled = cb.checked;
                if (cb.checked) input.classList.add('input-disabled');
                else input.classList.remove('input-disabled');
            });
            if (val === null) {
                (input as HTMLInputElement).disabled = true;
                input.classList.add('input-disabled');
            }
        }

        field.appendChild(labelRow);
        field.appendChild(input);
        body.appendChild(field);
        fields.push({ col, input, meta });
    });

    document.body.appendChild(overlay);

    const close = closeRowEditModal;
    overlay.querySelector('#rem-close')!.addEventListener('click', close);
    overlay.querySelector('#rem-cancel')!.addEventListener('click', close);
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });

    // Delete
    overlay.querySelector('#rem-delete')!.addEventListener('click', async () => {
        if (!confirm('Delete this row?')) return;
        const btn = overlay.querySelector('#rem-delete') as HTMLButtonElement;
        btn.disabled = true; btn.textContent = 'Deleting…';
        try {
            await api('delete_rows', {
                database:   state.currentDb,
                table:      state.currentTable,
                where_rows: [buildWhereFromRow(row, colMeta)],
            });
            toast('Row deleted', 'success');
            close();
            loadTableData(state.currentDb!, state.currentTable!, state.page);
        } catch (err: any) {
            toast('Error: ' + err.message, 'error');
            btn.disabled = false; btn.textContent = 'Delete';
        }
    });

    // Save
    overlay.querySelector('#rem-save')!.addEventListener('click', async () => {
        const updates: Record<string, any> = {};
        fields.forEach(({ col, input, meta }) => {
            const nullCb = overlay.querySelector(`.rem-null-cb[data-col="${CSS.escape(col)}"]`) as HTMLInputElement | null;
            if (nullCb && nullCb.checked) {
                updates[col] = null;
            } else {
                updates[col] = getCellInputValue(input, meta);
            }
        });

        const btn = overlay.querySelector('#rem-save') as HTMLButtonElement;
        btn.disabled    = true;
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

            const tr = [...document.querySelectorAll('.data-row')].find((r: any) => r._rowData === row) as any;
            if (tr) {
                const newRow = { ...row, ...updates };
                tr._rowData  = newRow;
                (tr._columns as string[]).forEach(col => {
                    const td = tr.querySelector(`td[data-col="${CSS.escape(col)}"]`) as HTMLElement;
                    if (td) {
                        renderCellView(td, newRow[col]);
                        td.dataset.origVal = newRow[col] === null ? '\x00NULL' : String(newRow[col]);
                    }
                });
            }
        } catch (err: any) {
            toast('Error: ' + err.message, 'error');
            btn.disabled    = false;
            btn.textContent = 'Save';
        }
    });

    setTimeout(() => {
        const first = body.querySelector('input,textarea,select') as HTMLElement | null;
        if (first && !(first as HTMLInputElement).disabled) first.focus();
    }, 50);
}

function closeRowEditModal(): void {
    const el = document.getElementById('row-edit-overlay');
    if (el) el.remove();
}
