<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

$cfg  = requireSession();
$body = jsonBody();

$db     = trim($body['database'] ?? '');
$table  = trim($body['table']    ?? '');
$column = trim($body['column']   ?? '');
$value  = $body['value'] ?? null;   // null means SQL NULL
$where  = $body['where']  ?? [];

if (!$db || !$table || !$column || !$where) {
    jsonOut(['success' => false, 'error' => 'Missing required parameters']);
}

if (!preg_match('/^[a-zA-Z0-9_\-\.]+$/', $db) || !preg_match('/^[a-zA-Z0-9_\-\.]+$/', $table)) {
    jsonOut(['success' => false, 'error' => 'Invalid identifier']);
}
if (!preg_match('/^[a-zA-Z0-9_]+$/', $column)) {
    jsonOut(['success' => false, 'error' => 'Invalid column name']);
}

try {
    $pdo = getConnection($cfg);
    $pdo->exec("USE `{$db}`");

    [$whereStr, $params] = buildWhere($where, $pdo);

    if ($value === null) {
        $sql = "UPDATE `{$table}` SET `{$column}` = NULL WHERE {$whereStr}";
    } else {
        $sql = "UPDATE `{$table}` SET `{$column}` = ? WHERE {$whereStr}";
        array_unshift($params, $value);
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    jsonOut(['success' => true, 'affected' => $stmt->rowCount(), 'sql' => interpolateSql($sql, $params)]);
} catch (PDOException $e) {
    jsonOut(['success' => false, 'error' => $e->getMessage()]);
}

function buildWhere(array $where, PDO $pdo): array {
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
