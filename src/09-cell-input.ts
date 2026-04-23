// ── Build input for a cell based on column meta ───────────────────────────────

function buildCellInput(meta: Partial<ColumnDef>, val: any, inline: boolean): HTMLElement {
    const base   = (meta.baseType || 'VARCHAR').toUpperCase();
    const strVal = val === null ? '' : String(val);

    const isLargeText = ['TEXT','TINYTEXT','MEDIUMTEXT','LONGTEXT'].includes(base);
    if (!inline && isLargeText) {
        const ta = document.createElement('textarea');
        ta.className = 'tbl-input rem-textarea';
        ta.value = strVal;
        return ta;
    }

    if (['TINYINT','SMALLINT','MEDIUMINT','INT','BIGINT'].includes(base)) {
        const inp = document.createElement('input') as HTMLInputElement;
        inp.type = 'number'; inp.step = '1';
        if (meta.unsigned) inp.min = '0';
        inp.className = 'tbl-input';
        inp.value = strVal;
        return inp;
    }

    if (['FLOAT','DOUBLE','DECIMAL','NUMERIC'].includes(base)) {
        const inp = document.createElement('input') as HTMLInputElement;
        inp.type = 'number'; inp.step = 'any';
        inp.className = 'tbl-input';
        inp.value = strVal;
        return inp;
    }

    if (base === 'DATE') {
        const inp = document.createElement('input') as HTMLInputElement;
        inp.type = 'date'; inp.className = 'tbl-input'; inp.value = strVal;
        return inp;
    }

    if (base === 'DATETIME' || base === 'TIMESTAMP') {
        const inp = document.createElement('input') as HTMLInputElement;
        inp.type = 'datetime-local'; inp.step = '1'; inp.className = 'tbl-input';
        inp.value = strVal.replace(' ', 'T');
        return inp;
    }

    if (base === 'TIME') {
        const inp = document.createElement('input') as HTMLInputElement;
        inp.type = 'time'; inp.step = '1'; inp.className = 'tbl-input'; inp.value = strVal;
        return inp;
    }

    if (base === 'YEAR') {
        const inp = document.createElement('input') as HTMLInputElement;
        inp.type = 'number'; inp.min = '1901'; inp.max = '2155'; inp.step = '1';
        inp.className = 'tbl-input'; inp.value = strVal;
        return inp;
    }

    if (base === 'ENUM' && meta.enumValues) {
        const sel = document.createElement('select');
        sel.className = 'tbl-input tbl-select';
        const rawVals = meta.enumValues.replace(/^'|'$/g, '').split("','");
        rawVals.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v; opt.textContent = v;
            if (v === strVal) opt.selected = true;
            sel.appendChild(opt);
        });
        return sel;
    }

    if (base === 'BOOLEAN' || (base === 'BIT' && meta.length === '1')) {
        const sel = document.createElement('select');
        sel.className = 'tbl-input tbl-select';
        (['0', 'No / 0'] as const);
        [['0','No / 0'],['1','Yes / 1']].forEach(([v, label]) => {
            const opt = document.createElement('option');
            opt.value = v; opt.textContent = label;
            if (strVal === v) opt.selected = true;
            sel.appendChild(opt);
        });
        return sel;
    }

    const inp = document.createElement('input') as HTMLInputElement;
    inp.type = 'text'; inp.className = 'tbl-input'; inp.value = strVal;
    if (inline) inp.style.width = '100%';
    return inp;
}

function getCellInputValue(input: HTMLElement, meta: Partial<ColumnDef>): any {
    const base = (meta.baseType || '').toUpperCase();
    const raw  = (input as HTMLInputElement).value;

    if ((input as HTMLInputElement).type === 'datetime-local' && raw) {
        return raw.replace('T', ' ');
    }
    if (raw === '' && ['TINYINT','SMALLINT','MEDIUMINT','INT','BIGINT','FLOAT','DOUBLE','DECIMAL','NUMERIC'].includes(base)) {
        return null;
    }
    return raw;
}

function buildWhereFromRow(row: Record<string, any>, colMeta: Record<string, ColumnDef>): Record<string, any> {
    const pkCols = Object.entries(colMeta).filter(([, m]) => m.key === 'PRI').map(([c]) => c);
    const useCols = pkCols.length ? pkCols : Object.keys(row);
    const where: Record<string, any> = {};
    useCols.forEach(c => { where[c] = row[c]; });
    return where;
}
