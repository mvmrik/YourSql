// ── Import / Export modal ─────────────────────────────────────────────────────

type IETab = 'import' | 'export' | 'manage';
type ManageOp = 'truncate' | 'drop' | 'analyze' | 'optimize' | 'check' | 'repair';

function showImportExportModal(dbName: string, initialTab: IETab = 'export'): void {
    const existing = document.getElementById('ie-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'ie-modal';

    overlay.innerHTML = `
        <div class="modal ie-modal-box">
            <div class="modal-header">
                <span class="modal-title">Import / Export — <strong id="ie-db-name"></strong></span>
                <button class="modal-close" id="ie-close">&times;</button>
            </div>
            <div class="ie-tabs">
                <button class="ie-tab${initialTab === 'export' ? ' active' : ''}" data-tab="export">Export</button>
                <button class="ie-tab${initialTab === 'import' ? ' active' : ''}" data-tab="import">Import</button>
                <button class="ie-tab${initialTab === 'manage' ? ' active' : ''}" data-tab="manage">Manage</button>
            </div>

            <!-- EXPORT -->
            <div class="ie-panel" id="ie-panel-export" style="display:${initialTab === 'export' ? 'flex' : 'none'}">
                <div class="ie-section">
                    <div class="ie-label">Mode</div>
                    <div class="ie-radio-group">
                        <label><input type="radio" name="exp-mode" value="full" checked> Structure + Data</label>
                        <label><input type="radio" name="exp-mode" value="structure"> Structure only</label>
                        <label><input type="radio" name="exp-mode" value="data"> Data only</label>
                    </div>
                </div>
                <div class="ie-section">
                    <div class="ie-label-row">
                        <span class="ie-label">Tables</span>
                        <label class="ie-check-all-wrap">
                            <input type="checkbox" id="exp-all-check" checked>
                            All tables
                        </label>
                    </div>
                    <div class="ie-table-list" id="exp-table-list">
                        <div class="ie-loading"><div class="spinner"></div> Loading tables...</div>
                    </div>
                </div>
                <div class="ie-footer">
                    <button class="btn btn-primary btn-sm" id="btn-export">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M.5 9.9a.5.5 0 01.5.5v2.5a1 1 0 001 1h12a1 1 0 001-1v-2.5a.5.5 0 011 0v2.5a2 2 0 01-2 2H2a2 2 0 01-2-2v-2.5a.5.5 0 01.5-.5z"/>
                            <path d="M7.646 11.854a.5.5 0 00.708 0l3-3a.5.5 0 00-.708-.708L8.5 10.293V1.5a.5.5 0 00-1 0v8.793L5.354 8.146a.5.5 0 10-.708.708l3 3z"/>
                        </svg>
                        Download .sql
                    </button>
                </div>
            </div>

            <!-- MANAGE -->
            <div class="ie-panel" id="ie-panel-manage" style="display:${initialTab === 'manage' ? 'flex' : 'none'}">
                <div class="ie-section">
                    <div class="ie-label">Operation</div>
                    <div class="ie-op-cards">
                        <label class="ie-op-card" id="op-card-truncate">
                            <input type="radio" name="manage-op" value="truncate" checked>
                            <div class="ie-op-card-body">
                                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" style="color:var(--warning,#f59e0b)">
                                    <path d="M2 2a1 1 0 00-1 1v1a1 1 0 000 2v6a2 2 0 002 2h6a2 2 0 002-2V6a1 1 0 000-2V3a1 1 0 00-1-1H2zm2.5 5.5a.5.5 0 011 0v3a.5.5 0 01-1 0v-3zm2 0a.5.5 0 011 0v3a.5.5 0 01-1 0v-3zm2 0a.5.5 0 011 0v3a.5.5 0 01-1 0v-3z"/>
                                </svg>
                                <div>
                                    <strong>Truncate</strong>
                                    <span>Delete all rows, keep structure</span>
                                </div>
                            </div>
                        </label>
                        <label class="ie-op-card" id="op-card-drop">
                            <input type="radio" name="manage-op" value="drop">
                            <div class="ie-op-card-body">
                                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" style="color:var(--danger,#ef4444)">
                                    <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
                                    <path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 010-2h4a1 1 0 011-1h2a1 1 0 011 1h4a1 1 0 011 1zm-11.5 1v9a1 1 0 001 1h6a1 1 0 001-1V4H3z"/>
                                </svg>
                                <div>
                                    <strong>Drop</strong>
                                    <span>Remove tables completely</span>
                                </div>
                            </div>
                        </label>
                    </div>
                    <div class="ie-maintenance-sep">Maintenance</div>
                    <div class="ie-op-cards">
                        <label class="ie-op-card">
                            <input type="radio" name="manage-op" value="analyze">
                            <div class="ie-op-card-body">
                                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" style="color:var(--accent)">
                                    <path d="M0 0h1v15h15v1H0V0zm14.854 5.146a.5.5 0 010 .708l-4 4a.5.5 0 01-.708 0l-1.5-1.5-2.854 2.853a.5.5 0 11-.707-.707l3.207-3.207a.5.5 0 01.707 0l1.5 1.5 3.647-3.646a.5.5 0 01.708 0z"/>
                                </svg>
                                <div>
                                    <strong>Analyze</strong>
                                    <span>Update index statistics</span>
                                </div>
                            </div>
                        </label>
                        <label class="ie-op-card">
                            <input type="radio" name="manage-op" value="optimize">
                            <div class="ie-op-card-body">
                                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" style="color:var(--accent)">
                                    <path d="M8 4.754a3.246 3.246 0 100 6.492 3.246 3.246 0 000-6.492zM5.754 8a2.246 2.246 0 114.492 0 2.246 2.246 0 01-4.492 0z"/>
                                    <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 01-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 01-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 01.52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 011.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 011.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 01.52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 01-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 01-1.255-.52l-.094-.319z"/>
                                </svg>
                                <div>
                                    <strong>Optimize</strong>
                                    <span>Defragment, reclaim space</span>
                                </div>
                            </div>
                        </label>
                        <label class="ie-op-card">
                            <input type="radio" name="manage-op" value="check">
                            <div class="ie-op-card-body">
                                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" style="color:var(--accent)">
                                    <path d="M10.97 4.97a.75.75 0 011.07 1.05l-3.99 4.99a.75.75 0 01-1.08.02L4.324 8.384a.75.75 0 111.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 01.02-.022z"/>
                                    <path d="M8 15A7 7 0 118 1a7 7 0 010 14zm0 1A8 8 0 108 0a8 8 0 000 16z"/>
                                </svg>
                                <div>
                                    <strong>Check</strong>
                                    <span>Check tables for errors</span>
                                </div>
                            </div>
                        </label>
                        <label class="ie-op-card">
                            <input type="radio" name="manage-op" value="repair">
                            <div class="ie-op-card-body">
                                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" style="color:var(--accent)">
                                    <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 01-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 01.872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 012.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 012.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 01.872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 01-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 01-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 110-5.86 2.929 2.929 0 010 5.858z"/>
                                </svg>
                                <div>
                                    <strong>Repair</strong>
                                    <span>Repair corrupted tables (MyISAM)</span>
                                </div>
                            </div>
                        </label>
                    </div>
                </div>
                <div class="ie-section">
                    <div class="ie-label-row">
                        <span class="ie-label">Tables</span>
                        <label class="ie-check-all-wrap">
                            <input type="checkbox" id="mgr-all-check">
                            All tables
                        </label>
                    </div>
                    <div class="ie-table-list" id="mgr-table-list">
                        <div class="ie-loading"><div class="spinner"></div> Loading tables...</div>
                    </div>
                </div>
                <div class="ie-maint-result hidden" id="ie-maint-result"></div>
                <div class="ie-footer">
                    <button class="btn btn-danger btn-sm" id="btn-manage-run" disabled>
                        <span id="btn-manage-label">Truncate selected</span>
                    </button>
                </div>
            </div>

            <!-- IMPORT -->
            <div class="ie-panel" id="ie-panel-import" style="display:${initialTab === 'import' ? 'flex' : 'none'}">
                <div class="ie-section">
                    <div class="ie-label">SQL File</div>
                    <div class="ie-drop-zone" id="ie-drop-zone">
                        <svg width="28" height="28" viewBox="0 0 16 16" fill="currentColor" style="color:var(--text-dim)">
                            <path d="M.5 9.9a.5.5 0 01.5.5v2.5a1 1 0 001 1h12a1 1 0 001-1v-2.5a.5.5 0 011 0v2.5a2 2 0 01-2 2H2a2 2 0 01-2-2v-2.5a.5.5 0 01.5-.5z"/>
                            <path d="M7.646 1.146a.5.5 0 01.708 0l3 3a.5.5 0 01-.708.708L8.5 2.707V11.5a.5.5 0 01-1 0V2.707L5.354 4.854a.5.5 0 11-.708-.708l3-3z"/>
                        </svg>
                        <span id="ie-drop-label">Drop .sql file here or <u>browse</u></span>
                        <input type="file" id="ie-file-input" accept=".sql" style="display:none">
                    </div>
                </div>
                <div class="ie-import-progress hidden" id="ie-import-progress">
                    <div class="ie-progress-bar-wrap">
                        <div class="ie-progress-bar" id="ie-progress-bar" style="width:0%"></div>
                    </div>
                    <div class="ie-progress-info" id="ie-progress-info">Starting...</div>
                </div>
                <div class="ie-import-errors hidden" id="ie-import-errors"></div>
                <div class="ie-footer">
                    <button class="btn btn-primary btn-sm" id="btn-import" disabled>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M.5 9.9a.5.5 0 01.5.5v2.5a1 1 0 001 1h12a1 1 0 001-1v-2.5a.5.5 0 011 0v2.5a2 2 0 01-2 2H2a2 2 0 01-2-2v-2.5a.5.5 0 01.5-.5z"/>
                            <path d="M7.646 1.146a.5.5 0 01.708 0l3 3a.5.5 0 01-.708.708L8.5 2.707V11.5a.5.5 0 01-1 0V2.707L5.354 4.854a.5.5 0 11-.708-.708l3-3z"/>
                        </svg>
                        Import
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const dbNameEl = overlay.querySelector('#ie-db-name') as HTMLElement;
    dbNameEl.textContent = dbName;

    // Tab switching
    overlay.querySelectorAll('.ie-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            overlay.querySelectorAll('.ie-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = (btn as HTMLElement).dataset.tab!;
            (overlay.querySelector('#ie-panel-export') as HTMLElement).style.display = tab === 'export' ? 'flex' : 'none';
            (overlay.querySelector('#ie-panel-import') as HTMLElement).style.display = tab === 'import' ? 'flex' : 'none';
            (overlay.querySelector('#ie-panel-manage') as HTMLElement).style.display = tab === 'manage' ? 'flex' : 'none';
        });
    });

    // Close
    overlay.querySelector('#ie-close')!.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    // Load tables for export and manage
    loadExportTables(overlay, dbName);
    loadManageTables(overlay, dbName);

    // Export — all tables toggle
    const allCheck = overlay.querySelector('#exp-all-check') as HTMLInputElement;
    allCheck.addEventListener('change', () => {
        overlay.querySelectorAll<HTMLInputElement>('.exp-table-cb').forEach(cb => {
            cb.checked = allCheck.checked;
        });
    });

    // Export button
    overlay.querySelector('#btn-export')!.addEventListener('click', () => {
        const mode = (overlay.querySelector('input[name="exp-mode"]:checked') as HTMLInputElement)?.value || 'full';
        const allTables = allCheck.checked;
        const tables: string[] = [];

        if (!allTables) {
            overlay.querySelectorAll<HTMLInputElement>('.exp-table-cb:checked').forEach(cb => {
                tables.push(cb.value);
            });
            if (!tables.length) { toast('Select at least one table', 'error'); return; }
        }

        const params = new URLSearchParams({ database: dbName, mode });
        tables.forEach(t => params.append('tables[]', t));
        window.location.href = 'api/export.php?' + params.toString();
    });

    // Import — file input
    const fileInput  = overlay.querySelector('#ie-file-input') as HTMLInputElement;
    const dropZone   = overlay.querySelector('#ie-drop-zone') as HTMLElement;
    const dropLabel  = overlay.querySelector('#ie-drop-label') as HTMLElement;
    const importBtn  = overlay.querySelector('#btn-import') as HTMLButtonElement;
    let   selectedFile: File | null = null;

    function setFile(file: File): void {
        selectedFile = file;
        dropLabel.innerHTML = `<strong>${escHtml(file.name)}</strong> (${formatBytes(file.size)})`;
        dropZone.classList.add('has-file');
        importBtn.disabled = false;
    }

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        if (fileInput.files?.[0]) setFile(fileInput.files[0]);
    });
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer?.files[0];
        if (file) setFile(file);
    });

    // Import button
    importBtn.addEventListener('click', () => {
        if (!selectedFile) return;
        runImport(overlay, dbName, selectedFile);
    });

    // Manage — op radio updates button label
    const mgrAllCheck  = overlay.querySelector('#mgr-all-check') as HTMLInputElement;
    const mgrRunBtn    = overlay.querySelector('#btn-manage-run') as HTMLButtonElement;
    const mgrBtnLabel  = overlay.querySelector('#btn-manage-label') as HTMLElement;

    const destructiveOps = new Set(['truncate', 'drop']);

    function updateManageBtn(): void {
        const op  = (overlay.querySelector('input[name="manage-op"]:checked') as HTMLInputElement)?.value as ManageOp || 'truncate';
        const sel = overlay.querySelectorAll<HTMLInputElement>('.mgr-table-cb:checked').length;
        mgrRunBtn.disabled = sel === 0;
        const opLabels: Record<ManageOp, string> = {
            truncate: 'Truncate', drop: 'Drop',
            analyze: 'Analyze', optimize: 'Optimize', check: 'Check', repair: 'Repair',
        };
        mgrBtnLabel.textContent = `${opLabels[op]} ${sel} table${sel !== 1 ? 's' : ''}`;
        mgrRunBtn.className = 'btn btn-sm ' + (op === 'drop' ? 'btn-danger' : op === 'truncate' ? 'btn-warning' : 'btn-accent');
    }

    overlay.querySelectorAll('input[name="manage-op"]').forEach(r => {
        r.addEventListener('change', updateManageBtn);
    });

    mgrAllCheck.addEventListener('change', () => {
        overlay.querySelectorAll<HTMLInputElement>('.mgr-table-cb').forEach(cb => {
            cb.checked = mgrAllCheck.checked;
        });
        updateManageBtn();
    });

    mgrRunBtn.addEventListener('click', () => {
        const op = (overlay.querySelector('input[name="manage-op"]:checked') as HTMLInputElement)?.value as ManageOp;
        const tables: string[] = [];
        overlay.querySelectorAll<HTMLInputElement>('.mgr-table-cb:checked').forEach(cb => tables.push(cb.value));
        if (!tables.length) return;
        runTableOp(overlay, dbName, op, tables, mgrRunBtn);
    });
}

async function loadManageTables(overlay: Element, dbName: string): Promise<void> {
    const list = overlay.querySelector('#mgr-table-list') as HTMLElement;
    const allCheck = overlay.querySelector('#mgr-all-check') as HTMLInputElement;
    try {
        const data = await api('tables', { database: dbName });
        const tables: { name: string }[] = data.tables || [];

        if (!tables.length) {
            list.innerHTML = '<div style="color:var(--text-dim);font-size:.85rem">No tables</div>';
            return;
        }

        list.innerHTML = tables.map(t => `
            <label class="ie-table-row">
                <input type="checkbox" class="mgr-table-cb tbl-check" value="${escAttr(t.name)}">
                <span>${escHtml(t.name)}</span>
            </label>
        `).join('');

        list.querySelectorAll<HTMLInputElement>('.mgr-table-cb').forEach(cb => {
            cb.addEventListener('change', () => {
                const all = list.querySelectorAll<HTMLInputElement>('.mgr-table-cb');
                const chk = list.querySelectorAll<HTMLInputElement>('.mgr-table-cb:checked');
                allCheck.checked       = chk.length === all.length;
                allCheck.indeterminate = chk.length > 0 && chk.length < all.length;
                // reuse the same update fn via custom event
                overlay.querySelector('#btn-manage-run')?.dispatchEvent(new Event('_sync'));
            });
        });

        // wire _sync to recompute label/disabled
        overlay.querySelector('#btn-manage-run')!.addEventListener('_sync', () => updateMgrBtn(overlay));

    } catch (e: any) {
        list.innerHTML = `<div style="color:var(--danger);font-size:.85rem">${escHtml(e.message)}</div>`;
    }
}

const DESTRUCTIVE_OPS = new Set<ManageOp>(['truncate', 'drop']);

async function runTableOp(overlay: Element, dbName: string, op: ManageOp, tables: string[], btn: HTMLButtonElement): Promise<void> {
    const lbl = overlay.querySelector('#btn-manage-label') as HTMLElement;
    const resultBox = overlay.querySelector('#ie-maint-result') as HTMLElement;

    if (DESTRUCTIVE_OPS.has(op)) {
        const confirmed = confirm(
            `Are you sure you want to ${op} ${tables.length} table${tables.length !== 1 ? 's' : ''}?\n\n` +
            tables.join('\n') +
            (op === 'drop' ? '\n\nThis will permanently delete the tables!' : '\n\nThis will delete ALL rows in these tables!')
        );
        if (!confirmed) return;
    }

    btn.disabled = true;
    const origText = lbl.textContent || '';
    lbl.textContent = 'Working...';
    resultBox.classList.add('hidden');
    resultBox.innerHTML = '';

    try {
        const data = await fetch('api/table_ops.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ database: dbName, tables, op }),
        }).then(r => r.json());

        if (!data.success) { toast(data.error || 'Error', 'error'); return; }

        if (DESTRUCTIVE_OPS.has(op)) {
            if (data.errors?.length) {
                toast(data.errors.map((e: any) => `${e.table}: ${e.error}`).join('\n'), 'error');
            } else {
                toast(`${op.charAt(0).toUpperCase() + op.slice(1)}d ${data.done?.length} table(s)`, 'success');
            }
            if (op === 'drop') {
                await loadManageTables(overlay, dbName);
                await loadExportTables(overlay, dbName);
            } else {
                overlay.querySelectorAll<HTMLInputElement>('.mgr-table-cb:checked').forEach(cb => { cb.checked = false; });
                (overlay.querySelector('#mgr-all-check') as HTMLInputElement).checked = false;
            }
        } else {
            // Maintenance — show results table
            const rows: { table: string; type: string; msg: string }[] = data.done || [];
            const errRows: { table: string; error: string }[] = data.errors || [];
            const allRows = [
                ...rows.map(r => ({ table: r.table, type: r.type, msg: r.msg, ok: r.type !== 'error' })),
                ...errRows.map(r => ({ table: r.table, type: 'error', msg: r.error, ok: false })),
            ];

            resultBox.classList.remove('hidden');
            resultBox.innerHTML = `
                <table class="ie-result-table">
                    <thead><tr><th>Table</th><th>Status</th><th>Message</th></tr></thead>
                    <tbody>
                        ${allRows.map(r => `
                            <tr class="${r.ok ? '' : 'ie-result-err'}">
                                <td>${escHtml(r.table)}</td>
                                <td><span class="ie-result-badge ${r.ok ? 'ok' : 'err'}">${escHtml(r.type)}</span></td>
                                <td>${escHtml(r.msg)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            const hasErrors = errRows.length > 0;
            toast(`${op.charAt(0).toUpperCase() + op.slice(1)} done` + (hasErrors ? ` (${errRows.length} error(s))` : ''), hasErrors ? 'error' : 'success');
        }
    } catch (e: any) {
        toast('Error: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        lbl.textContent = origText;
        updateMgrBtn(overlay);
    }
}

function updateMgrBtn(overlay: Element): void {
    const op  = (overlay.querySelector('input[name="manage-op"]:checked') as HTMLInputElement)?.value as ManageOp || 'truncate';
    const sel = overlay.querySelectorAll<HTMLInputElement>('.mgr-table-cb:checked').length;
    const btn = overlay.querySelector('#btn-manage-run') as HTMLButtonElement;
    const lbl = overlay.querySelector('#btn-manage-label') as HTMLElement;
    btn.disabled = sel === 0;
    const opLabels: Record<ManageOp, string> = {
        truncate: 'Truncate', drop: 'Drop',
        analyze: 'Analyze', optimize: 'Optimize', check: 'Check', repair: 'Repair',
    };
    lbl.textContent = `${opLabels[op]} ${sel} table${sel !== 1 ? 's' : ''}`;
    btn.className = 'btn btn-sm ' + (op === 'drop' ? 'btn-danger' : op === 'truncate' ? 'btn-warning' : 'btn-accent');
}

async function loadExportTables(overlay: Element, dbName: string): Promise<void> {
    const list = overlay.querySelector('#exp-table-list') as HTMLElement;
    try {
        const data = await api('tables', { database: dbName });
        const tables: { name: string }[] = data.tables || [];

        if (!tables.length) {
            list.innerHTML = '<div style="color:var(--text-dim);font-size:.85rem">No tables</div>';
            return;
        }

        list.innerHTML = tables.map(t => `
            <label class="ie-table-row">
                <input type="checkbox" class="exp-table-cb tbl-check" value="${escAttr(t.name)}" checked>
                <span>${escHtml(t.name)}</span>
            </label>
        `).join('');

        // Sync all-check on individual change
        const allCheck = overlay.querySelector('#exp-all-check') as HTMLInputElement;
        list.querySelectorAll<HTMLInputElement>('.exp-table-cb').forEach(cb => {
            cb.addEventListener('change', () => {
                const all  = list.querySelectorAll<HTMLInputElement>('.exp-table-cb');
                const chk  = list.querySelectorAll<HTMLInputElement>('.exp-table-cb:checked');
                allCheck.checked       = chk.length === all.length;
                allCheck.indeterminate = chk.length > 0 && chk.length < all.length;
            });
        });
    } catch (e: any) {
        list.innerHTML = `<div style="color:var(--danger);font-size:.85rem">${escHtml(e.message)}</div>`;
    }
}

async function runImport(overlay: Element, dbName: string, file: File): Promise<void> {
    const importBtn   = overlay.querySelector('#btn-import') as HTMLButtonElement;
    const progressBox = overlay.querySelector('#ie-import-progress') as HTMLElement;
    const progressBar = overlay.querySelector('#ie-progress-bar') as HTMLElement;
    const progressInfo= overlay.querySelector('#ie-progress-info') as HTMLElement;
    const errorsBox   = overlay.querySelector('#ie-import-errors') as HTMLElement;
    const dropZone    = overlay.querySelector('#ie-drop-zone') as HTMLElement;

    importBtn.disabled = true;
    progressBox.classList.remove('hidden');
    errorsBox.classList.add('hidden');
    errorsBox.innerHTML = '';
    progressBar.style.width = '0%';
    progressInfo.textContent = 'Uploading...';

    // Step 1: Upload
    const form = new FormData();
    form.append('database', dbName);
    form.append('sql_file', file);

    let importId: string;
    try {
        const res  = await fetch('api/import.php', { method: 'POST', body: form });
        const data = await res.json();
        if (!data.success) { showImportError(progressInfo, errorsBox, data.error); importBtn.disabled = false; return; }
        importId = data.import_id;
    } catch (e: any) {
        showImportError(progressInfo, errorsBox, 'Upload failed: ' + e.message);
        importBtn.disabled = false;
        return;
    }

    progressInfo.textContent = 'Processing...';
    progressBar.style.width = '2%';

    // Step 2: SSE run
    const evtSource = new EventSource('api/import_run.php?import_id=' + encodeURIComponent(importId));

    evtSource.onmessage = (e) => {
        const msg = JSON.parse(e.data);

        if (msg.state === 'running') {
            const pct = Math.max(2, msg.pct);
            progressBar.style.width = pct + '%';
            progressInfo.textContent = `Processing... ${pct}%  (${msg.executed} statements)` +
                (msg.errors > 0 ? `  ⚠ ${msg.errors} error(s)` : '');
        }

        if (msg.state === 'done') {
            evtSource.close();
            progressBar.style.width = '100%';
            progressBar.style.background = 'var(--success, #22c55e)';
            progressInfo.textContent = `Done! ${msg.executed} statements executed.` +
                (msg.errors?.length ? `  ${msg.errors.length} error(s).` : '');

            if (msg.errors?.length) {
                errorsBox.classList.remove('hidden');
                errorsBox.innerHTML = '<div class="ie-err-title">Errors:</div>' +
                    msg.errors.slice(0, 20).map((err: any) =>
                        `<div class="ie-err-row"><code>${escHtml(err.stmt)}</code><span>${escHtml(err.error)}</span></div>`
                    ).join('');
            }

            toast('Import completed: ' + msg.executed + ' statements', 'success');
            dropZone.classList.remove('has-file');
        }

        if (msg.state === 'error') {
            evtSource.close();
            showImportError(progressInfo, errorsBox, msg.error, msg.errors);
            importBtn.disabled = false;
        }
    };

    evtSource.onerror = () => {
        evtSource.close();
        showImportError(progressInfo, errorsBox, 'Connection lost during import');
        importBtn.disabled = false;
    };
}

function showImportError(infoEl: HTMLElement, errorsEl: HTMLElement, msg: string, errors: any[] = []): void {
    infoEl.textContent = 'Error: ' + msg;
    infoEl.style.color = 'var(--danger)';
    if (errors.length) {
        errorsEl.classList.remove('hidden');
        errorsEl.innerHTML = errors.slice(0, 20).map((err: any) =>
            `<div class="ie-err-row"><code>${escHtml(err.stmt)}</code><span>${escHtml(err.error)}</span></div>`
        ).join('');
    }
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
