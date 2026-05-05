// ── Table structure ───────────────────────────────────────────────────────────

async function loadTableStructure(dbName: string, tableName: string): Promise<void> {
    setBreadcrumb([
        { label: dbName,    onClick: () => selectDatabase(dbName) },
        { label: tableName, onClick: () => loadTableData(dbName, tableName, 1) },
        { label: 'Structure', active: true },
    ]);

    setTopbarActions([
        { label: 'Data', onClick: () => loadTableData(dbName, tableName, 1) },
        { label: 'Actions ▾', dropdown: [
            { label: 'Create Table', onClick: () => showCreateTable(dbName) },
        ]},
    ]);

    const area = document.getElementById('content-area')!;
    area.innerHTML = `
        <div class="table-view-header">
            <div class="table-view-title">${escHtml(tableName)} — Structure</div>
            <div class="table-view-actions" id="struct-header-actions"></div>
        </div>
        <div class="struct-tabs">
            <button class="struct-tab active" data-tab="columns">Columns</button>
            <button class="struct-tab" data-tab="indexes">Indexes</button>
            <button class="struct-tab" data-tab="foreign-keys">Foreign Keys</button>
        </div>
        <div id="struct-loading" style="display:flex;gap:10px;color:var(--text-muted);align-items:center;padding:8px 0">
            <div class="spinner"></div> Loading structure...
        </div>
        <div id="struct-content"></div>
    `;

    try {
        const data = await api('table_structure', { database: dbName, table: tableName });
        (document.getElementById('struct-loading') as HTMLElement).style.display = 'none';

        let columns: ColumnDef[] = (data.structure || []).map(parseColumnDef);
        const tableCols: string[] = (data.structure || []).map((r: any) => r.Field as string);
        let activeTab = 'columns';
        let editMode  = false;

        const headerActions = document.getElementById('struct-header-actions')!;

        const renderEditBtn = () => {
            headerActions.innerHTML = activeTab === 'columns'
                ? `<button class="btn btn-accent btn-sm" id="struct-edit-btn">${editMode ? 'Save' : 'Edit'}</button>`
                : '';
            if (activeTab === 'columns') {
                document.getElementById('struct-edit-btn')!.addEventListener('click', handleEditSave);
                if (editMode) document.getElementById('struct-edit-btn')!.classList.add('saving');
            }
        };

        const renderContent = () => {
            const content = document.getElementById('struct-content')!;
            if (activeTab === 'columns') {
                renderStructure(content, columns, editMode, (newCols) => { columns = newCols; });
            } else if (activeTab === 'indexes') {
                renderIndexesTab(content, dbName, tableName, data.indexes || [], tableCols);
            } else {
                renderForeignKeysTab(content, dbName, tableName, data.foreign_keys || [], data.indexes || [], tableCols);
            }
            renderEditBtn();
        };

        const handleEditSave = async () => {
            if (!editMode) {
                editMode = true;
                renderContent();
            } else {
                const btn = document.getElementById('struct-edit-btn') as HTMLButtonElement;
                btn.disabled = true; btn.textContent = 'Saving…';
                try {
                    await api('alter_table', { database: dbName, table: tableName, columns: collectEditorState() });
                    toast('Structure saved successfully', 'success');
                    editMode = false;
                    const fresh = await api('table_structure', { database: dbName, table: tableName });
                    columns = (fresh.structure || []).map(parseColumnDef);
                    renderContent();
                } catch (err: any) {
                    toast('Error: ' + err.message, 'error');
                    btn.textContent = 'Save'; btn.disabled = false;
                }
            }
        };

        area.querySelectorAll('.struct-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                if (editMode && activeTab === 'columns') {
                    if (!confirm('Discard unsaved column changes?')) return;
                    editMode = false;
                }
                area.querySelectorAll('.struct-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                activeTab = (tab as HTMLElement).dataset.tab!;
                renderContent();
            });
        });

        renderContent();

    } catch (err: any) {
        (document.getElementById('struct-loading') as HTMLElement).innerHTML =
            `<span style="color:var(--danger)">${escHtml(err.message)}</span>`;
    }
}

// ── Column picker (multi-select dropdown with checkboxes) ─────────────────────

function makeColPicker(id: string, cols: string[], label: string, multi = true): string {
    return `
        <div class="col-picker-wrap" id="${id}-wrap">
            <button type="button" class="col-picker-btn tbl-input" id="${id}-btn">
                <span class="col-picker-label">${escHtml(label)}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style="flex-shrink:0;opacity:.5"><path d="M1 3l4 4 4-4"/></svg>
            </button>
            <div class="col-picker-dropdown" id="${id}-drop">
                ${cols.map(c => `
                    <label class="col-picker-item">
                        <input type="${multi ? 'checkbox' : 'radio'}" name="${id}-radio" value="${escAttr(c)}"> ${escHtml(c)}
                    </label>`).join('')}
            </div>
        </div>`;
}

function wireColPicker(root: HTMLElement, id: string): void {
    const btn  = root.querySelector(`#${id}-btn`)  as HTMLButtonElement;
    const drop = root.querySelector(`#${id}-drop`) as HTMLElement;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = drop.classList.contains('open');
        root.querySelectorAll('.col-picker-dropdown.open').forEach(d => d.classList.remove('open'));
        if (!isOpen) drop.classList.add('open');
    });

    drop.addEventListener('change', () => updateColPickerLabel(root, id));
}

function updateColPickerLabel(root: HTMLElement, id: string): void {
    const checked = [...root.querySelectorAll(`#${id}-drop input:checked`)] as HTMLInputElement[];
    const label   = root.querySelector(`#${id}-btn .col-picker-label`)!;
    label.textContent = checked.length ? checked.map(c => c.value).join(', ') : 'Select columns…';
}

function getColPickerValues(root: HTMLElement, id: string): string[] {
    return ([...root.querySelectorAll(`#${id}-drop input:checked`)] as HTMLInputElement[]).map(i => i.value);
}

function setColPickerCols(root: HTMLElement, id: string, cols: string[]): void {
    const drop = root.querySelector(`#${id}-drop`) as HTMLElement;
    const isMulti = drop.querySelector('input[type="checkbox"]') !== null;
    drop.innerHTML = cols.length
        ? cols.map(c => `
            <label class="col-picker-item">
                <input type="${isMulti ? 'checkbox' : 'radio'}" name="${id}-radio" value="${escAttr(c)}"> ${escHtml(c)}
            </label>`).join('')
        : `<div class="col-picker-empty">No columns</div>`;
    drop.addEventListener('change', () => updateColPickerLabel(root, id));
    const label = root.querySelector(`#${id}-btn .col-picker-label`)!;
    label.textContent = 'Select columns…';
}

// Close all pickers on outside click
document.addEventListener('click', () => {
    document.querySelectorAll('.col-picker-dropdown.open').forEach(d => d.classList.remove('open'));
});

// ── Indexes tab ───────────────────────────────────────────────────────────────

function renderIndexesTab(container: HTMLElement, dbName: string, tableName: string, indexes: any[], tableCols: string[]): void {
    container.innerHTML = `
        <div class="data-table-wrap">
            <table class="data-table">
                <thead><tr>
                    <th>Name</th><th>Type</th><th>Columns</th><th>Method</th><th></th>
                </tr></thead>
                <tbody>
                    ${!indexes.length ? `<tr><td colspan="5" class="table-empty">No indexes</td></tr>` :
                      indexes.map(idx => `
                        <tr>
                            <td><strong>${escHtml(idx.name)}</strong></td>
                            <td><span class="badge${idx.type === 'PRIMARY' ? ' blue' : idx.type === 'UNIQUE' ? ' green' : ''}">${escHtml(idx.type)}</span></td>
                            <td style="font-family:var(--font-mono);font-size:.82rem">${escHtml(idx.columns.join(', '))}</td>
                            <td style="color:var(--text-muted);font-size:.82rem">${escHtml(idx.method)}</td>
                            <td>${idx.name !== 'PRIMARY' ? `<button class="btn btn-danger btn-sm idx-drop-btn" data-name="${escAttr(idx.name)}">Drop</button>` : ''}</td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>
        <div class="struct-add-section">
            <h4 class="struct-section-title">Add Index</h4>
            <div class="struct-form-row">
                <div class="struct-form-group">
                    <label>Name <span class="optional">(auto if empty)</span></label>
                    <input class="tbl-input" id="idx-name" placeholder="index_name">
                </div>
                <div class="struct-form-group">
                    <label>Type</label>
                    <select class="tbl-input tbl-select" id="idx-type">
                        <option value="INDEX">INDEX</option>
                        <option value="UNIQUE">UNIQUE</option>
                        <option value="PRIMARY">PRIMARY</option>
                        <option value="FULLTEXT">FULLTEXT</option>
                    </select>
                </div>
                <div class="struct-form-group">
                    <label>Columns</label>
                    ${makeColPicker('idx-cols', tableCols, 'Select columns…', true)}
                </div>
                <div class="struct-form-group struct-form-btn">
                    <button class="btn btn-accent btn-sm" id="idx-add-btn">Add Index</button>
                </div>
            </div>
            <div id="idx-error" class="error-msg hidden" style="margin-top:8px"></div>
        </div>
    `;

    wireColPicker(container, 'idx-cols');

    container.querySelectorAll('.idx-drop-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const name = (btn as HTMLElement).dataset.name!;
            if (!confirm(`Drop index "${name}"?`)) return;
            try {
                await api('indexes', { action: 'drop', database: dbName, table: tableName, name });
                toast(`Index "${name}" dropped`, 'success');
                const fresh = await api('table_structure', { database: dbName, table: tableName });
                renderIndexesTab(container, dbName, tableName, fresh.indexes || [], tableCols);
            } catch (err: any) { toast('Error: ' + err.message, 'error'); }
        });
    });

    container.querySelector('#idx-add-btn')!.addEventListener('click', async () => {
        const name  = (container.querySelector('#idx-name') as HTMLInputElement).value.trim();
        const type  = (container.querySelector('#idx-type') as HTMLSelectElement).value;
        const cols  = getColPickerValues(container, 'idx-cols');
        const errEl = container.querySelector('#idx-error')!;

        if (!cols.length) { errEl.textContent = 'Select at least one column'; errEl.classList.remove('hidden'); return; }
        errEl.classList.add('hidden');

        const btn = container.querySelector('#idx-add-btn') as HTMLButtonElement;
        btn.disabled = true; btn.textContent = 'Adding…';
        try {
            await api('indexes', { action: 'add', database: dbName, table: tableName, name, type, columns: cols });
            toast('Index added', 'success');
            const fresh = await api('table_structure', { database: dbName, table: tableName });
            renderIndexesTab(container, dbName, tableName, fresh.indexes || [], tableCols);
        } catch (err: any) {
            errEl.textContent = err.message; errEl.classList.remove('hidden');
            btn.disabled = false; btn.textContent = 'Add Index';
        }
    });
}

// ── Foreign Keys tab ──────────────────────────────────────────────────────────

function renderForeignKeysTab(container: HTMLElement, dbName: string, tableName: string, fks: any[], indexes: any[], tableCols: string[]): void {
    const rules = ['RESTRICT', 'CASCADE', 'SET NULL', 'NO ACTION'];
    const ruleOpts = rules.map(r => `<option value="${r}">${r}</option>`).join('');

    container.innerHTML = `
        <div class="data-table-wrap">
            <table class="data-table">
                <thead><tr>
                    <th>Name</th><th>Columns</th><th>References</th><th>On Update</th><th>On Delete</th><th></th>
                </tr></thead>
                <tbody>
                    ${!fks.length ? `<tr><td colspan="6" class="table-empty">No foreign keys</td></tr>` :
                      fks.map(fk => `
                        <tr>
                            <td><strong>${escHtml(fk.name)}</strong></td>
                            <td style="font-family:var(--font-mono);font-size:.82rem">${escHtml(fk.columns.join(', '))}</td>
                            <td style="font-family:var(--font-mono);font-size:.82rem">
                                <span style="color:var(--accent)">${escHtml(fk.ref_db !== dbName ? fk.ref_db + '.' : '')}${escHtml(fk.ref_table)}</span>
                                (${escHtml(fk.ref_cols.join(', '))})
                            </td>
                            <td><span class="badge">${escHtml(fk.on_update)}</span></td>
                            <td><span class="badge">${escHtml(fk.on_delete)}</span></td>
                            <td><button class="btn btn-danger btn-sm fk-drop-btn" data-name="${escAttr(fk.name)}">Drop</button></td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>
        <div class="struct-add-section">
            <h4 class="struct-section-title">Add Foreign Key</h4>
            <div class="struct-form-row">
                <div class="struct-form-group">
                    <label>Name <span class="optional">(auto if empty)</span></label>
                    <input class="tbl-input" id="fk-name" placeholder="fk_name">
                </div>
                <div class="struct-form-group">
                    <label>Column(s)</label>
                    ${makeColPicker('fk-cols', tableCols, 'Select columns…', true)}
                </div>
            </div>
            <div class="struct-form-row" style="margin-top:10px">
                <div class="struct-form-group">
                    <label>Ref. Database</label>
                    <select class="tbl-input tbl-select" id="fk-ref-db">
                        <option value="${escAttr(dbName)}" selected>${escHtml(dbName)}</option>
                    </select>
                </div>
                <div class="struct-form-group">
                    <label>Ref. Table</label>
                    <select class="tbl-input tbl-select" id="fk-ref-table">
                        <option value="">— select table —</option>
                    </select>
                </div>
                <div class="struct-form-group">
                    <label>Ref. Column(s)</label>
                    ${makeColPicker('fk-ref-cols', [], 'Select ref. table first…', true)}
                </div>
            </div>
            <div class="struct-form-row" style="margin-top:10px">
                <div class="struct-form-group">
                    <label>On Update</label>
                    <select class="tbl-input tbl-select" id="fk-on-update">${ruleOpts}</select>
                </div>
                <div class="struct-form-group">
                    <label>On Delete</label>
                    <select class="tbl-input tbl-select" id="fk-on-delete">${ruleOpts}</select>
                </div>
                <div class="struct-form-group struct-form-btn">
                    <button class="btn btn-accent btn-sm" id="fk-add-btn">Add Foreign Key</button>
                </div>
            </div>
            <div id="fk-error" class="error-msg hidden" style="margin-top:8px"></div>
        </div>
    `;

    wireColPicker(container, 'fk-cols');
    wireColPicker(container, 'fk-ref-cols');

    const refDbSel    = container.querySelector('#fk-ref-db')    as HTMLSelectElement;
    const refTableSel = container.querySelector('#fk-ref-table') as HTMLSelectElement;

    const loadRefCols = async () => {
        const refTable = refTableSel.value;
        const refDb    = refDbSel.value || dbName;
        if (!refTable) { setColPickerCols(container, 'fk-ref-cols', []); return; }
        try {
            const data = await api('table_structure', { database: refDb, table: refTable });
            setColPickerCols(container, 'fk-ref-cols', (data.structure || []).map((r: any) => r.Field as string));
        } catch {
            setColPickerCols(container, 'fk-ref-cols', []);
        }
    };

    const loadRefTables = async () => {
        const refDb = refDbSel.value || dbName;
        refTableSel.innerHTML = '<option value="">— loading… —</option>';
        setColPickerCols(container, 'fk-ref-cols', []);
        try {
            const data = await api('tables', { database: refDb });
            const tables: string[] = (data.tables || []).map((t: any) => t.name as string);
            refTableSel.innerHTML = '<option value="">— select table —</option>' +
                tables.map(t => `<option value="${escAttr(t)}">${escHtml(t)}</option>`).join('');
        } catch {
            refTableSel.innerHTML = '<option value="">— error loading tables —</option>';
        }
    };

    // Populate databases list
    api('databases').then((data: any) => {
        const dbs: string[] = (data.databases || []).map((d: any) => d.name as string);
        refDbSel.innerHTML = dbs.map(d =>
            `<option value="${escAttr(d)}"${d === dbName ? ' selected' : ''}>${escHtml(d)}</option>`
        ).join('');
        loadRefTables();
    });

    refDbSel.addEventListener('change', loadRefTables);
    refTableSel.addEventListener('change', loadRefCols);

    container.querySelectorAll('.fk-drop-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const name = (btn as HTMLElement).dataset.name!;
            if (!confirm(`Drop foreign key "${name}"?`)) return;
            try {
                await api('foreign_keys', { action: 'drop', database: dbName, table: tableName, name });
                toast(`Foreign key "${name}" dropped`, 'success');
                const fresh = await api('table_structure', { database: dbName, table: tableName });
                renderForeignKeysTab(container, dbName, tableName, fresh.foreign_keys || [], fresh.indexes || [], tableCols);
            } catch (err: any) { toast('Error: ' + err.message, 'error'); }
        });
    });

    container.querySelector('#fk-add-btn')!.addEventListener('click', async () => {
        const name     = (container.querySelector('#fk-name')      as HTMLInputElement).value.trim();
        const cols     = getColPickerValues(container, 'fk-cols');
        const refDb    = (container.querySelector('#fk-ref-db')    as HTMLSelectElement).value || dbName;
        const refTable = (container.querySelector('#fk-ref-table') as HTMLSelectElement).value;
        const refCols  = getColPickerValues(container, 'fk-ref-cols');
        const onUpdate = (container.querySelector('#fk-on-update') as HTMLSelectElement).value;
        const onDelete = (container.querySelector('#fk-on-delete') as HTMLSelectElement).value;
        const errEl    = container.querySelector('#fk-error')!;

        if (!cols.length || !refTable || !refCols.length) {
            errEl.textContent = 'Column, ref. table and ref. column are required';
            errEl.classList.remove('hidden'); return;
        }
        errEl.classList.add('hidden');

        const btn = container.querySelector('#fk-add-btn') as HTMLButtonElement;
        btn.disabled = true; btn.textContent = 'Adding…';
        try {
            await api('foreign_keys', { action: 'add', database: dbName, table: tableName, name, columns: cols, ref_db: refDb, ref_table: refTable, ref_cols: refCols, on_update: onUpdate, on_delete: onDelete });
            toast('Foreign key added', 'success');
            const fresh = await api('table_structure', { database: dbName, table: tableName });
            renderForeignKeysTab(container, dbName, tableName, fresh.foreign_keys || [], fresh.indexes || [], tableCols);
        } catch (err: any) {
            errEl.textContent = err.message; errEl.classList.remove('hidden');
            btn.disabled = false; btn.textContent = 'Add Foreign Key';
        }
    });
}

// ── Structure editor ──────────────────────────────────────────────────────────

const TYPE_GROUPS: Record<string, string[]> = {
    'Integer':   ['TINYINT','SMALLINT','MEDIUMINT','INT','BIGINT'],
    'Decimal':   ['FLOAT','DOUBLE','DECIMAL','NUMERIC'],
    'String':    ['CHAR','VARCHAR','TINYTEXT','TEXT','MEDIUMTEXT','LONGTEXT'],
    'Binary':    ['BINARY','VARBINARY','TINYBLOB','BLOB','MEDIUMBLOB','LONGBLOB'],
    'Date/Time': ['DATE','DATETIME','TIMESTAMP','TIME','YEAR'],
    'Other':     ['ENUM','SET','JSON','BIT','BOOLEAN','GEOMETRY'],
};

const ALL_TYPES: string[] = ([] as string[]).concat(...Object.values(TYPE_GROUPS));

const TYPES_WITH_LENGTH   = new Set(['TINYINT','SMALLINT','MEDIUMINT','INT','BIGINT','FLOAT','DOUBLE','DECIMAL','NUMERIC','CHAR','VARCHAR','BINARY','VARBINARY','BIT']);
const TYPES_WITH_DECIMALS = new Set(['FLOAT','DOUBLE','DECIMAL','NUMERIC']);
const TYPES_WITH_VALUES   = new Set(['ENUM','SET']);
const TYPES_NO_DEFAULT    = new Set(['TEXT','TINYTEXT','MEDIUMTEXT','LONGTEXT','BLOB','TINYBLOB','MEDIUMBLOB','LONGBLOB','JSON','GEOMETRY']);
const TYPES_WITH_AUTO_INC = new Set(['TINYINT','SMALLINT','MEDIUMINT','INT','BIGINT']);
const TYPES_WITH_CHARSET  = new Set(['CHAR','VARCHAR','TINYTEXT','TEXT','MEDIUMTEXT','LONGTEXT','ENUM','SET']);

let _collationCache: CollationInfo[] | null = null;

async function getCollations(): Promise<CollationInfo[]> {
    if (_collationCache) return _collationCache;
    try {
        const data     = await api('collations');
        _collationCache = data.collations || [];
    } catch {
        _collationCache = [];
    }
    return _collationCache!;
}

function parseColumnDef(row: any): ColumnDef {
    const typeRaw   = row.Type || '';
    const typeUpper = typeRaw.toUpperCase();

    let baseType   = typeUpper.replace(/\(.*/, '').replace(/\s+UNSIGNED$/, '').trim();
    let length     = '';
    let decimals   = '';
    let enumValues = '';
    const unsigned = /unsigned/i.test(typeRaw);

    const mLen = typeRaw.match(/\(([^)]+)\)/);
    if (mLen) {
        const inner = mLen[1];
        if (TYPES_WITH_VALUES.has(baseType)) {
            enumValues = inner;
        } else if (TYPES_WITH_DECIMALS.has(baseType) && inner.includes(',')) {
            const parts = inner.split(',');
            length   = parts[0].trim();
            decimals = parts[1].trim();
        } else {
            length = inner.trim();
        }
    }

    return {
        originalName:  row.Field,
        name:          row.Field,
        baseType:      baseType || 'VARCHAR',
        length, decimals, enumValues, unsigned,
        allowNull:     row.Null === 'YES',
        defaultType:   row.Default === null ? 'NULL' : row.Default === '' ? 'EMPTY' : row.Default === 'CURRENT_TIMESTAMP' ? 'CURRENT_TIMESTAMP' : 'VALUE',
        defaultValue:  (row.Default !== null && row.Default !== 'CURRENT_TIMESTAMP') ? String(row.Default) : '',
        autoIncrement: /auto_increment/i.test(row.Extra || ''),
        key:           row.Key   || '',
        extra:         row.Extra || '',
        comment:       row.Comment   || '',
        collation:     row.Collation || '',
    };
}

function collectEditorState(): Partial<ColumnDef>[] {
    const rows   = document.querySelectorAll('#struct-editor-body tr[data-idx]');
    const result: Partial<ColumnDef>[] = [];

    rows.forEach(tr => {
        const get = (sel: string) => tr.querySelector(sel);
        const baseType = (get('.col-type') as HTMLSelectElement).value.toUpperCase();
        let defaultVal: string | null = null;
        const defType = (get('.col-default-type') as HTMLSelectElement | null)?.value;
        if (defType === 'VALUE')             defaultVal = (get('.col-default-value') as HTMLInputElement | null)?.value ?? '';
        else if (defType === 'EMPTY')        defaultVal = '';
        else if (defType === 'CURRENT_TIMESTAMP') defaultVal = 'CURRENT_TIMESTAMP';
        else                                 defaultVal = null;

        result.push({
            originalName:  (tr as HTMLElement).dataset.original,
            name:          (get('.col-name')     as HTMLInputElement).value.trim(),
            baseType,
            length:        (get('.col-length')   as HTMLInputElement  | null)?.value.trim()  || '',
            decimals:      (get('.col-decimals') as HTMLInputElement  | null)?.value.trim()  || '',
            enumValues:    (get('.col-enum')     as HTMLInputElement  | null)?.value.trim()  || '',
            unsigned:      (get('.col-unsigned') as HTMLInputElement  | null)?.checked || false,
            allowNull:     (get('.col-null')     as HTMLInputElement  | null)?.checked || false,
            defaultType:   defType || 'NULL',
            defaultValue:  defaultVal,
            autoIncrement: (get('.col-ai')       as HTMLInputElement  | null)?.checked || false,
            key:           (get('.col-primary')  as HTMLInputElement  | null)?.checked ? 'PRI' : ((tr as HTMLElement).dataset.key || ''),
            collation:     (get('.col-collation') as HTMLSelectElement | null)?.value  || '',
        });
    });

    return result;
}

function renderStructure(container: HTMLElement, columns: ColumnDef[], editMode: boolean, onUpdate: (cols: ColumnDef[]) => void): void {
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
                        const key      = col.key || '';
                        const keyBadge = key ? `<span class="badge${key === 'PRI' ? ' blue' : ''}">${escHtml(key)}</span>` : '';
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

    container.innerHTML = `
        <div class="struct-editor">
            <table class="data-table struct-edit-table">
                <thead>
                    <tr>
                        <th class="col-drag-th"></th>
                        <th>Field</th><th>Type</th><th>Length / Values</th>
                        <th>Collation</th><th>Unsigned</th><th>Allow NULL</th>
                        <th>Default</th><th>A_I</th><th>Key</th><th></th>
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

    wireEditorEvents(container, columns, onUpdate);
}

function buildTypeStr(col: ColumnDef): string {
    const t = col.baseType;
    if (TYPES_WITH_VALUES.has(t) && col.enumValues) return `${t}(${col.enumValues})`;
    if (TYPES_WITH_DECIMALS.has(t) && col.length && col.decimals) return `${t}(${col.length},${col.decimals})${col.unsigned ? ' unsigned' : ''}`;
    if (TYPES_WITH_LENGTH.has(t) && col.length) return `${t}(${col.length})${col.unsigned ? ' unsigned' : ''}`;
    return t + (col.unsigned ? ' unsigned' : '');
}

function buildEditorRow(col: Partial<ColumnDef>, idx: number): string {
    const baseType   = col.baseType || 'VARCHAR';
    const typeOptions = Object.entries(TYPE_GROUPS).map(([group, types]) =>
        `<optgroup label="${group}">${types.map(t =>
            `<option value="${t}"${baseType === t ? ' selected' : ''}>${t}</option>`
        ).join('')}</optgroup>`
    ).join('');

    const showLen      = TYPES_WITH_LENGTH.has(baseType) && !TYPES_WITH_VALUES.has(baseType);
    const showDec      = TYPES_WITH_DECIMALS.has(baseType);
    const showEnum     = TYPES_WITH_VALUES.has(baseType);
    const showCharset  = TYPES_WITH_CHARSET.has(baseType);
    const showUnsigned = (TYPES_WITH_LENGTH.has(baseType) && !TYPES_WITH_VALUES.has(baseType) && !['CHAR','VARCHAR','BINARY','VARBINARY','BIT'].includes(baseType)) || TYPES_WITH_DECIMALS.has(baseType);
    const canAI        = TYPES_WITH_AUTO_INC.has(baseType);
    const canDefault   = !TYPES_NO_DEFAULT.has(baseType);
    const isTimestamp  = baseType === 'TIMESTAMP' || baseType === 'DATETIME';

    const defOptions = [
        `<option value="NULL"${col.defaultType === 'NULL' ? ' selected' : ''}>NULL</option>`,
        `<option value="EMPTY"${col.defaultType === 'EMPTY' ? ' selected' : ''}>Empty string</option>`,
        `<option value="VALUE"${col.defaultType === 'VALUE' ? ' selected' : ''}>Value…</option>`,
        isTimestamp ? `<option value="CURRENT_TIMESTAMP"${col.defaultType === 'CURRENT_TIMESTAMP' ? ' selected' : ''}>CURRENT_TIMESTAMP</option>` : '',
    ].join('');

    return `
    <tr data-idx="${idx}" data-original="${escAttr(col.originalName || '')}" data-key="${escAttr(col.key || '')}">
        <td class="col-drag-td" draggable="true" title="Drag to reorder">
            <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" style="color:var(--text-dim);cursor:grab">
                <circle cx="4" cy="4" r="1.5"/><circle cx="8" cy="4" r="1.5"/>
                <circle cx="4" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
                <circle cx="4" cy="12" r="1.5"/><circle cx="8" cy="12" r="1.5"/>
            </svg>
        </td>
        <td><input class="col-name tbl-input" value="${escAttr(col.name || '')}" style="width:120px"></td>
        <td><select class="col-type tbl-input tbl-select" style="width:130px">${typeOptions}</select></td>
        <td class="col-extra-cell">
            <span class="col-len-wrap"${showLen ? '' : ' style="display:none"'}>
                <input class="col-length tbl-input" value="${escAttr(col.length || '')}" placeholder="Length" style="width:70px">
                <span class="col-dec-wrap"${showDec ? '' : ' style="display:none"'}>
                    , <input class="col-decimals tbl-input" value="${escAttr(col.decimals || '')}" placeholder="Dec" style="width:45px">
                </span>
            </span>
            <span class="col-enum-wrap"${showEnum ? '' : ' style="display:none"'}>
                <input class="col-enum tbl-input" value="${escAttr(col.enumValues || '')}" placeholder="'a','b','c'" style="width:160px">
            </span>
        </td>
        <td class="col-collation-cell">
            <span class="col-collation-wrap"${showCharset ? '' : ' style="display:none"'}>
                <select class="col-collation tbl-input tbl-select" style="width:170px">
                    <option value="">— inherit —</option>
                </select>
            </span>
        </td>
        <td style="text-align:center">
            <span class="col-unsigned-wrap"${showUnsigned ? '' : ' style="display:none"'}>
                <input type="checkbox" class="col-unsigned tbl-check"${col.unsigned ? ' checked' : ''}>
            </span>
        </td>
        <td style="text-align:center">
            <input type="checkbox" class="col-null tbl-check"${col.allowNull ? ' checked' : ''}>
        </td>
        <td class="col-default-cell">
            ${canDefault ? `
                <select class="col-default-type tbl-input tbl-select" style="width:130px">${defOptions}</select>
                <span class="col-default-value-wrap"${col.defaultType === 'VALUE' ? '' : ' style="display:none"'}>
                    <input class="col-default-value tbl-input" value="${escAttr(col.defaultValue ?? '')}" style="width:100px;margin-top:4px">
                </span>
            ` : '<span style="color:var(--text-dim);font-size:.75rem">—</span>'}
        </td>
        <td style="text-align:center">
            <span class="col-ai-wrap"${canAI ? '' : ' style="display:none"'}>
                <input type="checkbox" class="col-ai tbl-check"${col.autoIncrement ? ' checked' : ''}>
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

function buildCollationOptions(collations: CollationInfo[], current: string): string {
    const byCharset: Record<string, CollationInfo[]> = {};
    collations.forEach(c => {
        if (!byCharset[c.charset]) byCharset[c.charset] = [];
        byCharset[c.charset].push(c);
    });
    let opts = '<option value="">— inherit —</option>';
    Object.entries(byCharset).forEach(([cs, items]) => {
        opts += `<optgroup label="${escHtml(cs)}">`;
        items.forEach(c => {
            opts += `<option value="${escAttr(c.collation)}"${c.collation === current ? ' selected' : ''}>${escHtml(c.collation)}${c.isDefault ? ' ✓' : ''}</option>`;
        });
        opts += '</optgroup>';
    });
    return opts;
}

function fillCollationSelects(container: HTMLElement, columns: Partial<ColumnDef>[]): void {
    getCollations().then(collations => {
        container.querySelectorAll('tr[data-idx] .col-collation').forEach(sel => {
            const idx     = parseInt((sel.closest('tr') as HTMLElement).dataset.idx!);
            const current = columns[idx]?.collation || '';
            (sel as HTMLSelectElement).innerHTML = buildCollationOptions(collations, current);
        });
    });
}

function fillNewRowCollation(tr: HTMLElement): void {
    getCollations().then(collations => {
        const sel = tr.querySelector('.col-collation') as HTMLSelectElement | null;
        if (sel) sel.innerHTML = buildCollationOptions(collations, '');
    });
}

function wireEditorEvents(container: HTMLElement, columns: Partial<ColumnDef>[], onUpdate: (cols: any[]) => void): void {
    const tbody = container.querySelector('#struct-editor-body') as HTMLElement;

    fillCollationSelects(container, columns);

    tbody.addEventListener('change', (e: Event) => {
        const tr = (e.target as Element).closest('tr[data-idx]') as HTMLElement | null;
        if (!tr) return;
        if ((e.target as Element).classList.contains('col-type')) {
            updateRowVisibility(tr, (e.target as HTMLSelectElement).value.toUpperCase());
        }
        if ((e.target as Element).classList.contains('col-default-type')) {
            const valWrap = tr.querySelector('.col-default-value-wrap') as HTMLElement | null;
            if (valWrap) valWrap.style.display = (e.target as HTMLSelectElement).value === 'VALUE' ? '' : 'none';
        }
    });

    tbody.addEventListener('click', (e: Event) => {
        const btn = (e.target as Element).closest('.col-delete-btn');
        if (!btn) return;
        const tr = btn.closest('tr[data-idx]') as HTMLElement;
        if (confirm(`Delete column "${(tr.querySelector('.col-name') as HTMLInputElement).value}"?`)) {
            tr.remove();
            reindexRows(tbody);
        }
    });

    container.querySelector('#struct-add-col')!.addEventListener('click', () => {
        const newCol: Partial<ColumnDef> = {
            originalName: '', name: 'new_column',
            baseType: 'VARCHAR', length: '255', decimals: '', enumValues: '',
            unsigned: false, allowNull: true,
            defaultType: 'NULL', defaultValue: '',
            autoIncrement: false, key: '', extra: '',
        };
        const idx = tbody.querySelectorAll('tr[data-idx]').length;
        tbody.insertAdjacentHTML('beforeend', buildEditorRow(newCol, idx));
        reindexRows(tbody);
        fillNewRowCollation((tbody.querySelector(`tr[data-idx="${idx}"]`) || tbody.lastElementChild) as HTMLElement);
    });

    let dragSrc: HTMLElement | null = null;
    tbody.addEventListener('dragstart', (e: DragEvent) => {
        dragSrc = (e.target as Element).closest('tr[data-idx]') as HTMLElement | null;
        if (dragSrc) { dragSrc.classList.add('dragging'); e.dataTransfer!.effectAllowed = 'move'; }
    });
    tbody.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        const target = (e.target as Element).closest('tr[data-idx]') as HTMLElement | null;
        if (target && target !== dragSrc) {
            const rect  = target.getBoundingClientRect();
            const after = e.clientY > rect.top + rect.height / 2;
            tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-top', 'drag-over-bottom'));
            target.classList.add(after ? 'drag-over-bottom' : 'drag-over-top');
        }
    });
    tbody.addEventListener('dragleave', () => {
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-top', 'drag-over-bottom'));
    });
    tbody.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        const target = (e.target as Element).closest('tr[data-idx]') as HTMLElement | null;
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-top', 'drag-over-bottom', 'dragging'));
        if (!target || !dragSrc || target === dragSrc) return;
        const after = e.clientY > target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
        if (after) target.after(dragSrc); else target.before(dragSrc);
        reindexRows(tbody);
    });
    tbody.addEventListener('dragend', () => {
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom'));
    });
}

function updateRowVisibility(tr: HTMLElement, type: string): void {
    const showLen      = TYPES_WITH_LENGTH.has(type) && !TYPES_WITH_VALUES.has(type);
    const showDec      = TYPES_WITH_DECIMALS.has(type);
    const showEnum     = TYPES_WITH_VALUES.has(type);
    const showUnsigned = showLen && !['CHAR','VARCHAR','BINARY','VARBINARY','BIT'].includes(type);
    const canAI        = TYPES_WITH_AUTO_INC.has(type);
    const canDefault   = !TYPES_NO_DEFAULT.has(type);
    const isTimestamp  = type === 'TIMESTAMP' || type === 'DATETIME';

    setVisible(tr.querySelector('.col-len-wrap'),        showLen);
    setVisible(tr.querySelector('.col-dec-wrap'),        showDec);
    setVisible(tr.querySelector('.col-enum-wrap'),       showEnum);
    setVisible(tr.querySelector('.col-collation-wrap'),  TYPES_WITH_CHARSET.has(type));
    setVisible(tr.querySelector('.col-unsigned-wrap'),   showUnsigned);
    setVisible(tr.querySelector('.col-ai-wrap'),         canAI);

    const defCell = tr.querySelector('.col-default-cell') as HTMLElement | null;
    if (defCell) {
        if (!canDefault) {
            defCell.innerHTML = '<span style="color:var(--text-dim);font-size:.75rem">—</span>';
        } else {
            const existing = tr.querySelector('.col-default-type') as HTMLSelectElement | null;
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
                existing.querySelector('option[value="CURRENT_TIMESTAMP"]')?.remove();
            }
        }
    }
}

function reindexRows(tbody: HTMLElement): void {
    tbody.querySelectorAll('tr[data-idx]').forEach((tr, i) => {
        (tr as HTMLElement).dataset.idx = String(i);
    });
}
