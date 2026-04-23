// ── Types ─────────────────────────────────────────────────────────────────────

interface ColumnDef {
    originalName: string;
    name: string;
    baseType: string;
    length: string;
    decimals: string;
    enumValues: string;
    unsigned: boolean;
    allowNull: boolean;
    defaultType: string;
    defaultValue: string;
    autoIncrement: boolean;
    key: string;
    extra: string;
    comment: string;
    collation: string;
}

interface Filter {
    col: string;
    op: string;
    val: string;
}

interface SortEntry {
    col: string;
    dir: 'ASC' | 'DESC';
}

interface AppState {
    currentDb: string | null;
    currentTable: string | null;
    colMeta: Record<string, ColumnDef>;
    page: number;
    pageSize: number;
    totalRows: number;
    filters: Filter[];
    sort: SortEntry[];
    lastSql: string | null;
    sqlPanelOpen: boolean;
    selection: {
        mode: 'none' | 'page' | 'all';
        pageRows: any[];
    };
    autoRefresh: {
        intervalSec: number;
        _timerId: any;
        _remaining: number;
        _tickId: any;
    };
}

interface ThemeVars {
    '--bg': string;
    '--bg-2': string;
    '--bg-3': string;
    '--bg-4': string;
    '--border': string;
    '--border-light': string;
    '--accent': string;
    '--accent-hover': string;
    '--accent-dim': string;
    '--text': string;
    '--text-muted': string;
    '--text-dim': string;
    '--color-num': string;
    '--color-date': string;
    [key: string]: string;
}

interface Theme {
    label: string;
    vars: ThemeVars;
}

interface CollationInfo {
    collation: string;
    charset: string;
    isDefault: boolean;
}

interface TopbarAction {
    label: string;
    onClick?: () => void;
    dropdown?: { label: string; onClick: () => void }[];
}

interface BreadcrumbItem {
    label: string;
    onClick?: () => void;
    active?: boolean;
}
