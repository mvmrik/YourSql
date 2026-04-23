// ── SQL Panel ─────────────────────────────────────────────────────────────────

declare const CodeMirror: any;
let sqlCm: any = null;

function setSqlPanel(sql: string): void {
    state.lastSql = sql;
    if (sqlCm) sqlCm.setValue(sql);
    updateSqlBadgeBtn();
}

function updateSqlBadgeBtn(): void {
    const btn = document.getElementById('sql-badge-btn');
    if (!btn) return;
    btn.classList.toggle('hidden', !state.lastSql);
}

function toggleSqlPanel(forceOpen: boolean | null = null): void {
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

function renderSqlPanel(container: HTMLElement): void {
    const panel       = document.createElement('div');
    panel.id          = 'sql-panel';
    panel.className   = 'sql-panel' + (state.sqlPanelOpen ? '' : ' hidden');
    panel.innerHTML   = `
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

    const cmWrap = panel.querySelector('#sql-cm-wrap') as HTMLElement;
    if (typeof CodeMirror !== 'undefined') {
        sqlCm = CodeMirror(cmWrap, {
            value:          state.lastSql || '',
            mode:           'text/x-mysql',
            theme:          'dracula',
            lineNumbers:    true,
            indentWithTabs: false,
            indentUnit:     4,
            tabSize:        4,
            lineWrapping:   true,
            autofocus:      false,
            extraKeys: {
                'Ctrl-Enter': () => executeSqlPanel(),
                'Cmd-Enter':  () => executeSqlPanel(),
            },
        });
    } else {
        cmWrap.innerHTML = `<textarea id="sql-panel-textarea" class="sql-textarea" spellcheck="false">${escHtml(state.lastSql || '')}</textarea>`;
    }

    panel.querySelector('#sql-close-btn')!.addEventListener('click', () => toggleSqlPanel(false));

    panel.querySelector('#sql-clear-btn')!.addEventListener('click', () => {
        if (sqlCm) sqlCm.setValue('');
        else (panel.querySelector('#sql-panel-textarea') as HTMLTextAreaElement).value = '';
        const res = document.getElementById('sql-result');
        if (res) { res.className = 'sql-result hidden'; res.innerHTML = ''; }
    });

    panel.querySelector('#sql-execute-btn')!.addEventListener('click', () => executeSqlPanel());
}

async function executeSqlPanel(): Promise<void> {
    const result = document.getElementById('sql-result') as HTMLElement | null;
    const sql    = sqlCm
        ? sqlCm.getValue().trim()
        : (document.getElementById('sql-panel-textarea') as HTMLTextAreaElement | null)?.value.trim();
    if (!sql || !result) return;

    const btn = document.getElementById('sql-execute-btn') as HTMLButtonElement;
    btn.disabled    = true;
    btn.textContent = 'Running…';
    result.className = 'sql-result';
    result.innerHTML = '<div style="display:flex;gap:8px;align-items:center;color:var(--text-muted)"><div class="spinner"></div> Executing…</div>';

    try {
        const response = await fetch('api/sql_query.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ database: state.currentDb, sql }),
        });
        const res = await response.json();

        if (!res.success) {
            result.className = 'sql-result sql-result-error';
            result.innerHTML = `<div class="sql-error-msg">${escHtml(res.error)}</div>`;
        } else if (res.rows !== undefined) {
            renderSqlResultTable(result, res);
        } else {
            result.className = 'sql-result sql-result-ok';
            result.innerHTML = `<span>✓ Query OK — ${res.affected} row${res.affected !== 1 ? 's' : ''} affected</span>`;
            if (state.currentTable) {
                loadTableData(state.currentDb!, state.currentTable, state.page);
            }
        }
    } catch (err: any) {
        result.className = 'sql-result sql-result-error';
        result.innerHTML = `<div class="sql-error-msg">${escHtml(err.message)}</div>`;
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Execute';
    }
}

function renderSqlResultTable(container: HTMLElement, res: any): void {
    const { columns, rows } = res;
    container.className = 'sql-result sql-result-ok';

    if (!rows || !rows.length) {
        container.innerHTML = `<span style="color:var(--text-muted)">No rows returned</span>`;
        return;
    }

    const info = document.createElement('div');
    info.className = 'sql-result-info';
    info.textContent = `${rows.length} row${rows.length !== 1 ? 's' : ''}`;

    const wrap  = document.createElement('div');
    wrap.className = 'data-table-wrap sql-result-table-wrap';

    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `
        <thead><tr>${columns.map((c: string) => `<th>${escHtml(c)}</th>`).join('')}</tr></thead>
        <tbody>
            ${rows.map((row: any) => `<tr>${columns.map((col: string) => {
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
