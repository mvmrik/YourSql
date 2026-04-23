<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

$cfg       = requireSession();
$body      = jsonBody();

$db        = trim($body['database']   ?? '');
$table     = trim($body['table']      ?? '');
$mode      = $body['mode']             ?? 'page';
$whereRows = $body['where_rows']       ?? null;

if (!$db || !$table) {
    jsonOut(['success' => false, 'error' => 'Missing required parameters']);
}

if (!preg_match('/^[a-zA-Z0-9_\-\.]+$/', $db) || !preg_match('/^[a-zA-Z0-9_\-\.]+$/', $table)) {
    jsonOut(['success' => false, 'error' => 'Invalid identifier']);
}

try {
    $pdo = getConnection($cfg);
    $pdo->exec("USE `{$db}`");

    $totalAffected = 0;
    $displaySql    = '';

    if ($mode === 'all') {
        $sql  = "DELETE FROM `{$table}`";
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $totalAffected = $stmt->rowCount();
        $displaySql    = $sql;
    } else {
        if (empty($whereRows)) {
            jsonOut(['success' => false, 'error' => 'No rows specified']);
        }

        // Batch with IN if single PK column
        $pkCols   = array_keys($whereRows[0]);
        $canBatch = count($pkCols) === 1;

        if ($canBatch) {
            $pkCol    = $pkCols[0];
            if (!preg_match('/^[a-zA-Z0-9_]+$/', $pkCol)) {
                jsonOut(['success' => false, 'error' => 'Invalid PK column']);
            }
            $pkVals   = array_column($whereRows, $pkCol);
            $canBatch = !in_array(null, $pkVals, true);

            if ($canBatch) {
                $phs  = implode(',', array_fill(0, count($pkVals), '?'));
                $sql  = "DELETE FROM `{$table}` WHERE `{$pkCol}` IN ({$phs})";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($pkVals);
                $totalAffected = $stmt->rowCount();
                $displaySql    = interpolateSql($sql, $pkVals);
            }
        }

        if (!$canBatch) {
            foreach ($whereRows as $whereMap) {
                [$whereStr, $whereParams] = buildWhere($whereMap);
                $sql  = "DELETE FROM `{$table}` WHERE {$whereStr}";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($whereParams);
                $totalAffected += $stmt->rowCount();
                $displaySql = interpolateSql($sql, $whereParams);
            }
            if (count($whereRows) > 1) {
                $displaySql = "-- {$totalAffected} DELETE statements\n" . $displaySql;
            }
        }
    }

    jsonOut(['success' => true, 'affected' => $totalAffected, 'sql' => $displaySql]);
} catch (PDOException $e) {
    jsonOut(['success' => false, 'error' => $e->getMessage()]);
}

function buildWhere(array $where): array {
    $parts  = [];
    $params = [];
    foreach ($where as $col => $val) {
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $col)) continue;
        if ($val === null) {
            $parts[] = "`{$col}` IS NULL";
        } else {
            $parts[] = "`{$col}` = ?";
            $params[] = $val;
        }
    }
    if (!$parts) throw new \RuntimeException('Empty WHERE clause — refusing to delete');
    return [implode(' AND ', $parts), $params];
}
