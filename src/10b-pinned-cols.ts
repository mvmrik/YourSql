// ── Pinned columns ────────────────────────────────────────────────────────────

const PINNED_STORAGE_KEY = 'yoursql_pinned';

function pinnedKey(dbName: string, tableName: string): string {
    return dbName + '.' + tableName;
}

function getPinnedCols(dbName: string, tableName: string): string[] {
    try {
        const raw = localStorage.getItem(PINNED_STORAGE_KEY);
        if (!raw) return [];
        const all = JSON.parse(raw);
        return all[pinnedKey(dbName, tableName)] || [];
    } catch {
        return [];
    }
}

function setPinnedCols(dbName: string, tableName: string, cols: string[]): void {
    try {
        const raw = localStorage.getItem(PINNED_STORAGE_KEY);
        const all = raw ? JSON.parse(raw) : {};
        const key = pinnedKey(dbName, tableName);
        if (cols.length === 0) {
            delete all[key];
        } else {
            all[key] = cols;
        }
        localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(all));
    } catch {}
}

function pinColumn(dbName: string, tableName: string, col: string): void {
    const pinned = getPinnedCols(dbName, tableName);
    if (!pinned.includes(col)) {
        setPinnedCols(dbName, tableName, [...pinned, col]);
    }
    loadTableData(dbName, tableName, state.page);
}

function unpinColumn(dbName: string, tableName: string, col: string): void {
    const pinned = getPinnedCols(dbName, tableName).filter(c => c !== col);
    setPinnedCols(dbName, tableName, pinned);
    loadTableData(dbName, tableName, state.page);
}

function unpinAllColumns(dbName: string, tableName: string): void {
    setPinnedCols(dbName, tableName, []);
    loadTableData(dbName, tableName, state.page);
}

// Reorder columns array so pinned ones come first (preserving their pin order)
function applyPinnedOrder(dbName: string, tableName: string, columns: string[]): string[] {
    const pinned = getPinnedCols(dbName, tableName).filter(c => columns.includes(c));
    const rest   = columns.filter(c => !pinned.includes(c));
    return [...pinned, ...rest];
}

// ── Column context menu ───────────────────────────────────────────────────────

function showColContextMenu(e: MouseEvent, col: string, dbName: string, tableName: string): void {
    e.preventDefault();
    removeColContextMenu();

    const pinned    = getPinnedCols(dbName, tableName);
    const isPinned  = pinned.includes(col);
    const hasMany   = pinned.length > 1;

    const menu = document.createElement('div');
    menu.id = 'col-context-menu';
    menu.className = 'tab-context-menu';
    menu.innerHTML = `
        ${!isPinned ? `<div class="tab-ctx-item" data-action="pin">Pin column</div>` : ''}
        ${isPinned  ? `<div class="tab-ctx-item" data-action="unpin">Unpin column</div>` : ''}
        ${hasMany   ? `<div class="tab-ctx-divider"></div>
                       <div class="tab-ctx-item" data-action="unpin-all">Unpin All</div>` : ''}
    `;

    menu.style.left = e.clientX + 'px';
    menu.style.top  = e.clientY + 'px';
    document.body.appendChild(menu);

    menu.querySelectorAll('.tab-ctx-item').forEach(item => {
        item.addEventListener('click', () => {
            const action = (item as HTMLElement).dataset.action!;
            removeColContextMenu();
            if (action === 'pin')        pinColumn(dbName, tableName, col);
            if (action === 'unpin')      unpinColumn(dbName, tableName, col);
            if (action === 'unpin-all')  unpinAllColumns(dbName, tableName);
        });
    });

    setTimeout(() => document.addEventListener('click', removeColContextMenu, { once: true }), 0);
}

function removeColContextMenu(): void {
    document.getElementById('col-context-menu')?.remove();
}
