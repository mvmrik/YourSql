// ── State ─────────────────────────────────────────────────────────────────────

const state: AppState = {
    currentDb: null,
    currentTable: null,
    colMeta: {},
    page: 1,
    pageSize: 50,
    totalRows: 0,
    filters: [],
    sort: [],
    lastSql: null,
    sqlPanelOpen: false,
    selection: {
        mode: 'none',
        pageRows: [],
    },
    autoRefresh: {
        intervalSec: 0,
        _timerId:    null,
        _remaining:  0,
        _tickId:     null,
    },
};
