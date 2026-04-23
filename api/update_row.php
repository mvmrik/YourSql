<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

$cfg  = requireSession();
$body = jsonBody();

$db      = trim($body['database'] ?? '');
$table   = trim($body['table']    ?? '');
$updates = $body['updates']        ?? [];
$where   = $body['where']          ?? [];

if (!$db || !$table || !$updates || !$where) {
    jsonOut(['success' => false, 'error' => 'Missing required parameters']);
}

if (!preg_match('/^[a-zA-Z0-9_\-\.]+$/', $db) || !preg_match('/^[a-zA-Z0-9_\-\.]+$/', $table)) {
    jsonOut(['success' => false, 'error' => 'Invalid identifier']);
}

try {
    $pdo = getConnection($cfg);
    $pdo->exec("USE `{$db}`");

    $setParts  = [];
    $setParams = [];

    foreach ($updates as $col => $val) {
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $col)) {
            jsonOut(['success' => false, 'error' => "Invalid column name: {$col}"]);
        }
        if ($val === null) {
            $setParts[] = "`{$col}` = NULL";
        } else {
            $setParts[] = "`{$col}` = ?";
            $setParams[] = $val;
        }
    }

    [$whereStr, $whereParams] = buildWhere($where);

    $sql = "UPDATE `{$table}` SET " . implode(', ', $setParts) . " WHERE {$whereStr}";
    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_merge($setParams, $whereParams));

    jsonOut(['success' => true, 'affected' => $stmt->rowCount(), 'sql' => interpolateSql($sql, array_merge($setParams, $whereParams))]);
} catch (PDOException $e) {
    jsonOut(['success' => false, 'error' => $e->getMessage()]);
} catch (\RuntimeException $e) {
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
    if (!$parts) throw new \RuntimeException('Empty WHERE clause — refusing to update');
    return [implode(' AND ', $parts), $params];
}
