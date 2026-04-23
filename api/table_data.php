<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

$cfg  = requireSession();
$body = jsonBody();

$db       = trim($body['database']  ?? '');
$table    = trim($body['table']     ?? '');
$page     = max(1, (int)($body['page']      ?? 1));
$pageSize = min(10000, max(1, (int)($body['page_size'] ?? 50)));
$filters  = $body['filters'] ?? [];   // [{ col, op, val }]
$sort     = $body['sort']    ?? [];   // [{ col, dir }]

if (!$db || !$table) {
    jsonOut(['success' => false, 'error' => 'Database and table are required']);
}

if (!preg_match('/^[a-zA-Z0-9_\-\.]+$/', $db) || !preg_match('/^[a-zA-Z0-9_\-\.]+$/', $table)) {
    jsonOut(['success' => false, 'error' => 'Invalid identifier']);
}

// Allowed operators (whitelist)
const ALLOWED_OPS = ['=','!=','<','>','<=','>=','LIKE','NOT LIKE','LIKE %%','REGEXP','NOT REGEXP','IN','NOT IN','IS NULL','IS NOT NULL'];

try {
    $pdo = getConnection($cfg);

    // ── Build WHERE ──────────────────────────────────────────────────────────
    $whereParts  = [];
    $whereParams = [];

    foreach ($filters as $f) {
        $col = $f['col'] ?? '';
        $op  = $f['op']  ?? '=';
        $val = $f['val'] ?? '';

        if (!$col || !preg_match('/^[a-zA-Z0-9_]+$/', $col)) continue;
        if (!in_array($op, ALLOWED_OPS, true)) continue;

        if ($op === 'IS NULL') {
            $whereParts[] = "`{$col}` IS NULL";
        } elseif ($op === 'IS NOT NULL') {
            $whereParts[] = "`{$col}` IS NOT NULL";
        } elseif ($op === 'LIKE %%') {
            $whereParts[]  = "`{$col}` LIKE ?";
            $whereParams[] = '%' . $val . '%';
        } elseif ($op === 'IN' || $op === 'NOT IN') {
            // val is comma-separated
            $vals = array_filter(array_map('trim', explode(',', $val)));
            if (!$vals) continue;
            $phs  = implode(',', array_fill(0, count($vals), '?'));
            $whereParts[]  = "`{$col}` {$op} ({$phs})";
            array_push($whereParams, ...$vals);
        } else {
            $whereParts[]  = "`{$col}` {$op} ?";
            $whereParams[] = $val;
        }
    }

    $whereClause = $whereParts ? 'WHERE ' . implode(' AND ', $whereParts) : '';

    // ── Build ORDER BY ───────────────────────────────────────────────────────
    $orderParts = [];
    foreach ($sort as $s) {
        $col = $s['col'] ?? '';
        $dir = strtoupper($s['dir'] ?? 'ASC');
        if (!$col || !preg_match('/^[a-zA-Z0-9_]+$/', $col)) continue;
        if (!in_array($dir, ['ASC','DESC'])) $dir = 'ASC';
        $orderParts[] = "`{$col}` {$dir}";
    }
    $orderClause = $orderParts ? 'ORDER BY ' . implode(', ', $orderParts) : '';

    // ── Count ────────────────────────────────────────────────────────────────
    $countSql  = "SELECT COUNT(*) FROM `{$db}`.`{$table}` {$whereClause}";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($whereParams);
    $total = (int)$countStmt->fetchColumn();

    // ── Data ─────────────────────────────────────────────────────────────────
    $offset  = ($page - 1) * $pageSize;
    $dataSql = "SELECT * FROM `{$db}`.`{$table}` {$whereClause} {$orderClause} LIMIT {$pageSize} OFFSET {$offset}";
    $stmt    = $pdo->prepare($dataSql);
    $stmt->execute($whereParams);
    $rows = $stmt->fetchAll();

    $columns = [];
    if ($rows) {
        $columns = array_keys($rows[0]);
    } else {
        $colStmt = $pdo->query("SELECT * FROM `{$db}`.`{$table}` LIMIT 0");
        for ($i = 0; $i < $colStmt->columnCount(); $i++) {
            $columns[] = $colStmt->getColumnMeta($i)['name'];
        }
    }

    jsonOut([
        'success'   => true,
        'columns'   => $columns,
        'rows'      => $rows,
        'total'     => $total,
        'page'      => $page,
        'page_size' => $pageSize,
        'sql'       => interpolateSql($dataSql, $whereParams),
    ]);
} catch (PDOException $e) {
    jsonOut(['success' => false, 'error' => $e->getMessage()]);
}
