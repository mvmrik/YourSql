// ── FK preview modal ──────────────────────────────────────────────────────────
// fkMeta: array of FK definitions for the current table (from table_structure)
// Each: { columns: string[], ref_db, ref_table, ref_cols }

let _fkMeta: any[] = [];

function setFkMeta(fks: any[]): void {
    _fkMeta = fks || [];
}

// Returns the FK definition for a given column, or null
function getFkForCol(col: string): any | null {
    return _fkMeta.find(fk => fk.columns.length === 1 && fk.columns[0] === col) ?? null;
}

// Render a small FK link icon next to a cell value
function renderFkIcon(td: HTMLElement, col: string, val: any): void {
    const fk = getFkForCol(col);
    if (!fk || val === null || val === undefined || val === '') return;

    const icon = document.createElement('span');
    icon.className = 'fk-icon';
    icon.title = `→ ${fk.ref_db !== state.currentDb ? fk.ref_db + '.' : ''}${fk.ref_table}.${fk.ref_cols[0]}`;
    icon.innerHTML = `<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4.715 6.542L3.343 7.914a3 3 0 104.243 4.243l1.828-1.829A3 3 0 008.586 5.5L8 6.086a1 1 0 00-.154.199 2 2 0 01.861 3.337L6.88 11.45a2 2 0 01-2.83-2.83l.793-.792a4 4 0 01-.128-1.287z"/>
        <path d="M6.586 4.672A3 3 0 017.414 9.5l-.775.776a2 2 0 01.121 1.52 2 2 0 01-2.832-2.83l1.829-1.828a3 3 0 01-.121-1.52z" opacity=".5"/>
    </svg>`;

    icon.addEventListener('click', (e) => {
        e.stopPropagation();
        showFkPreview(fk, val);
    });

    td.insertBefore(icon, td.firstChild);
}

async function showFkPreview(fk: any, val: any): Promise<void> {
    removeFkPreviewModal();

    const refLabel = (fk.ref_db !== state.currentDb ? fk.ref_db + '.' : '') + fk.ref_table;

    const overlay = document.createElement('div');
    overlay.id = 'fk-preview-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
        <div class="row-edit-modal">
            <div class="rem-header">
                <span class="rem-title" style="display:flex;align-items:center;gap:7px">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style="color:var(--accent);flex-shrink:0">
                        <path d="M4.715 6.542L3.343 7.914a3 3 0 104.243 4.243l1.828-1.829A3 3 0 008.586 5.5L8 6.086a1 1 0 00-.154.199 2 2 0 01.861 3.337L6.88 11.45a2 2 0 01-2.83-2.83l.793-.792a4 4 0 01-.128-1.287z"/>
                        <path d="M6.586 4.672A3 3 0 017.414 9.5l-.775.776a2 2 0 01.121 1.52 2 2 0 01-2.832-2.83l1.829-1.828a3 3 0 01-.121-1.52z" opacity=".5"/>
                    </svg>
                    ${escHtml(refLabel)}
                    <span style="color:var(--text-muted);font-weight:400;font-size:.82rem">
                        where ${escHtml(fk.ref_cols[0])} = ${escHtml(String(val))}
                    </span>
                </span>
                <button class="rem-close" id="fk-preview-close">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
                    </svg>
                </button>
            </div>
            <div class="rem-body" id="fk-preview-body">
                <div style="display:flex;gap:10px;color:var(--text-muted);align-items:center">
                    <div class="spinner"></div> Loading…
                </div>
            </div>
            <div class="rem-footer" id="fk-preview-footer" style="display:none">
                <div style="flex:1"></div>
                <button class="btn btn-default btn-sm" id="fk-go-btn">Open ${escHtml(refLabel)} →</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelector('#fk-preview-close')!.addEventListener('click', removeFkPreviewModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) removeFkPreviewModal(); });

    const body    = overlay.querySelector('#fk-preview-body') as HTMLElement;
    const footer  = overlay.querySelector('#fk-preview-footer') as HTMLElement;

    try {
        const data = await api('fk_row', {
            database: fk.ref_db,
            table:    fk.ref_table,
            column:   fk.ref_cols[0],
            value:    val,
        });

        const row = data.row as Record<string, any>;
        body.innerHTML = '';

        Object.entries(row).forEach(([k, v]) => {
            const field = document.createElement('div');
            field.className = 'rem-field';

            const labelRow = document.createElement('div');
            labelRow.className = 'rem-label-row';
            labelRow.innerHTML = `<span class="rem-label">${escHtml(k)}</span>`;

            const valueEl = document.createElement('div');
            valueEl.className = 'tbl-input input-disabled' + (v === null ? ' null-val' : '');
            valueEl.style.cssText = 'padding:6px 10px;min-height:34px;word-break:break-all;white-space:pre-wrap';
            valueEl.textContent = v === null ? 'NULL' : String(v);

            field.appendChild(labelRow);
            field.appendChild(valueEl);
            body.appendChild(field);
        });

        footer.style.display = 'flex';
        overlay.querySelector('#fk-go-btn')!.addEventListener('click', () => {
            removeFkPreviewModal();
            loadTableData(fk.ref_db, fk.ref_table, 1);
        });

    } catch (err: any) {
        body.innerHTML = `<span style="color:var(--danger)">${escHtml(err.message)}</span>`;
    }
}

function removeFkPreviewModal(): void {
    document.getElementById('fk-preview-modal')?.remove();
}
