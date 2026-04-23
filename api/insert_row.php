<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

$cfg    = requireSession();
$body   = jsonBody();

$db     = trim($body['database'] ?? '');
$table  = trim($body['table']    ?? '');
$values = $body['values']         ?? [];

if (!$db || !$table || !is_array($values)) {
    jsonOut(['success' => false, 'error' => 'Missing required parameters']);
}

if (!preg_match('/^[a-zA-Z0-9_\-\.]+$/', $db) || !preg_match('/^[a-zA-Z0-9_\-\.]+$/', $table)) {
    jsonOut(['success' => false, 'error' => 'Invalid identifier']);
}

try {
    $pdo = getConnection($cfg);
    $pdo->exec("USE `{$db}`");

    $cols   = [];
    $phs    = [];
    $params = [];

    foreach ($values as $col => $val) {
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $col)) {
            jsonOut(['success' => false, 'error' => "Invalid column name: {$col}"]);
        }
        $cols[]   = "`{$col}`";
        if ($val === null) {
            $phs[]  = 'NULL';
        } else {
            $phs[]    = '?';
            $params[] = $val;
        }
    }

    if (!$cols) {
        jsonOut(['success' => false, 'error' => 'No columns provided']);
    }

    $sql  = "INSERT INTO `{$table}` (" . implode(', ', $cols) . ") VALUES (" . implode(', ', $phs) . ")";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $insertId = $pdo->lastInsertId();

    // Build display SQL with values interpolated
    $displayPhs = array_map(function($col, $val) {
        if ($val === null) return 'NULL';
        return "'" . addslashes((string)$val) . "'";
    }, array_keys($values), array_values($values));

    $displaySql = "INSERT INTO `{$table}` (" . implode(', ', $cols) . ") VALUES (" . implode(', ', $displayPhs) . ")";

    jsonOut(['success' => true, 'insert_id' => $insertId, 'sql' => $displaySql]);
} catch (PDOException $e) {
    jsonOut(['success' => false, 'error' => $e->getMessage()]);
}
