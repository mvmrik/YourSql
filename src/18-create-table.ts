// ── Create Table ──────────────────────────────────────────────────────────────

function showCreateTable(dbName: string): void {
    setBreadcrumb([
        { label: dbName, onClick: () => selectDatabase(dbName) },
        { label: 'Create Table', active: true },
    ]);
    setTopbarActions([]);

    const area = document.getElementById('content-area')!;
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
                        <th>Collation</th>
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

    const defaultCols: Partial<ColumnDef>[] = [
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

    const tbody = area.querySelector('#struct-editor-body') as HTMLElement;
    defaultCols.forEach((col, i) => tbody.insertAdjacentHTML('beforeend', buildEditorRow(col, i)));

    wireEditorEvents(area, defaultCols, () => {});

    area.querySelector('#create-save-btn')!.addEventListener('click', async () => {
        const tableName = (area.querySelector('#ct-name') as HTMLInputElement).value.trim();
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

        const btn = area.querySelector('#create-save-btn') as HTMLButtonElement;
        btn.disabled    = true;
        btn.textContent = 'Saving…';

        try {
            await api('create_table', {
                database:  dbName,
                table:     tableName,
                engine:    (area.querySelector('#ct-engine')    as HTMLSelectElement).value,
                collation: (area.querySelector('#ct-collation') as HTMLSelectElement).value,
                comment:   (area.querySelector('#ct-comment')   as HTMLInputElement).value.trim(),
                columns,
            });
            toast('Table created successfully', 'success');

            const dbItem = document.querySelector(`.db-item[data-db="${CSS.escape(dbName)}"]`);
            if (dbItem) {
                const tablesEl = dbItem.querySelector('.db-tables') as HTMLElement | null;
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
        } catch (err: any) {
            showCreateError(err.message);
            btn.disabled    = false;
            btn.textContent = 'Save';
        }
    });

    function showCreateError(msg: string): void {
        const el = area.querySelector('#create-error') as HTMLElement;
        el.textContent = msg;
        el.classList.remove('hidden');
    }
}
