<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

$cfg  = requireSession();
$body = jsonBody();

$db         = trim($body['database']   ?? '');
$table      = trim($body['table']      ?? '');
$updates    = $body['updates']          ?? [];   // col → { op, value }
$mode       = $body['mode']             ?? 'page'; // 'page' | 'all'
$whereRows  = $body['where_rows']       ?? null;   // array of where maps (for page mode)

if (!$db || !$table || !$updates) {
    jsonOut(['success' => false, 'error' => 'Missing required parameters']);
}

if (!preg_match('/^[a-zA-Z0-9_\-\.]+$/', $db) || !preg_match('/^[a-zA-Z0-9_\-\.]+$/', $table)) {
    jsonOut(['success' => false, 'error' => 'Invalid identifier']);
}

try {
    $pdo = getConnection($cfg);
    $pdo->exec("USE `{$db}`");

    // Build SET clause
    $setParts  = [];
    $setParams = [];

    foreach ($updates as $col => $spec) {
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $col)) {
            jsonOut(['success' => false, 'error' => "Invalid column: {$col}"]);
        }

        $op  = $spec['op']    ?? 'set';
        $val = $spec['value'] ?? null;

        if ($op === 'set') {
            if ($val === null) {
                $setParts[]  = "`{$col}` = NULL";
            } else {
                $setParts[]  = "`{$col}` = ?";
                $setParams[] = $val;
            }
        } elseif ($op === 'increment') {
            $setParts[]  = "`{$col}` = `{$col}` + ?";
            $setParams[] = (float)$val;
        } elseif ($op === 'decrement') {
            $setParts[]  = "`{$col}` = `{$col}` - ?";
            $setParams[] = (float)$val;
        }
    }

    if (!$setParts) {
        jsonOut(['success' => false, 'error' => 'No valid updates']);
    }

    $setClause = implode(', ', $setParts);
    $totalAffected = 0;

    $displaySql = '';

    if ($mode === 'all') {
        $sql  = "UPDATE `{$table}` SET {$setClause}";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($setParams);
        $totalAffected = $stmt->rowCount();
        $displaySql = interpolateSql($sql, $setParams);
    } else {
        if (empty($whereRows)) {
            jsonOut(['success' => false, 'error' => 'No rows specified']);
        }

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
                $placeholders = implode(',', array_fill(0, count($pkVals), '?'));
                $sql  = "UPDATE `{$table}` SET {$setClause} WHERE `{$pkCol}` IN ({$placeholders})";
                $stmt = $pdo->prepare($sql);
                $allParams = array_merge($setParams, $pkVals);
                $stmt->execute($allParams);
                $totalAffected = $stmt->rowCount();
                $displaySql = interpolateSql($sql, $allParams);
            }
        }

        if (!$canBatch) {
            $lastSql = '';
            foreach ($whereRows as $whereMap) {
                [$whereStr, $whereParams] = buildWhere($whereMap);
                $sql  = "UPDATE `{$table}` SET {$setClause} WHERE {$whereStr}";
                $stmt = $pdo->prepare($sql);
                $allParams = array_merge($setParams, $whereParams);
                $stmt->execute($allParams);
                $totalAffected += $stmt->rowCount();
                $lastSql = interpolateSql($sql, $allParams);
            }
            $displaySql = count($whereRows) > 1
                ? "-- {$totalAffected} individual UPDATE statements\n" . $lastSql
                : $lastSql;
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
    if (!$parts) throw new \RuntimeException('Empty WHERE clause');
    return [implode(' AND ', $parts), $params];
}
