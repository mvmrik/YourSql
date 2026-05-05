<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

$cfg  = requireSession();
$body = jsonBody();

$action = trim($body['action'] ?? 'list');
$db     = trim($body['database'] ?? '');
$table  = trim($body['table']    ?? '');

if (!$db || !$table) jsonOut(['success' => false, 'error' => 'database and table are required']);
if (!preg_match('/^[a-zA-Z0-9_\-\.]+$/', $db) || !preg_match('/^[a-zA-Z0-9_\-\.]+$/', $table)) {
    jsonOut(['success' => false, 'error' => 'Invalid identifier']);
}

try {
    $pdo = getConnection($cfg);
    $pdo->exec("USE `{$db}`");

    if ($action === 'list') {
        $rows = $pdo->query("SHOW INDEX FROM `{$table}`")->fetchAll();

        // Group by key name
        $indexes = [];
        foreach ($rows as $r) {
            $name = $r['Key_name'];
            if (!isset($indexes[$name])) {
                $indexes[$name] = [
                    'name'    => $name,
                    'type'    => $name === 'PRIMARY' ? 'PRIMARY' : ($r['Index_type'] === 'FULLTEXT' ? 'FULLTEXT' : ($r['Non_unique'] == 0 ? 'UNIQUE' : 'INDEX')),
                    'columns' => [],
                    'method'  => $r['Index_type'],
                ];
            }
            $indexes[$name]['columns'][] = $r['Column_name'];
        }

        jsonOut(['success' => true, 'indexes' => array_values($indexes)]);

    } elseif ($action === 'add') {
        $name    = trim($body['name']    ?? '');
        $type    = strtoupper(trim($body['type'] ?? 'INDEX'));
        $cols    = $body['columns'] ?? [];

        if (empty($cols)) jsonOut(['success' => false, 'error' => 'At least one column is required']);

        $colList = implode(', ', array_map(fn($c) => '`' . preg_replace('/[^a-zA-Z0-9_]/', '', $c) . '`', $cols));

        if ($type === 'PRIMARY') {
            $sql = "ALTER TABLE `{$table}` ADD PRIMARY KEY ({$colList})";
        } elseif ($type === 'UNIQUE') {
            $idxName = $name ?: implode('_', $cols) . '_unique';
            $sql = "ALTER TABLE `{$table}` ADD UNIQUE INDEX `{$idxName}` ({$colList})";
        } elseif ($type === 'FULLTEXT') {
            $idxName = $name ?: implode('_', $cols) . '_fulltext';
            $sql = "ALTER TABLE `{$table}` ADD FULLTEXT INDEX `{$idxName}` ({$colList})";
        } else {
            $idxName = $name ?: implode('_', $cols) . '_idx';
            $sql = "ALTER TABLE `{$table}` ADD INDEX `{$idxName}` ({$colList})";
        }

        $pdo->exec($sql);
        jsonOut(['success' => true, 'sql' => $sql]);

    } elseif ($action === 'drop') {
        $name = trim($body['name'] ?? '');
        if (!$name) jsonOut(['success' => false, 'error' => 'Index name is required']);

        if ($name === 'PRIMARY') {
            $sql = "ALTER TABLE `{$table}` DROP PRIMARY KEY";
        } else {
            $sql = "ALTER TABLE `{$table}` DROP INDEX `{$name}`";
        }
        $pdo->exec($sql);
        jsonOut(['success' => true, 'sql' => $sql]);
    }

} catch (PDOException $e) {
    jsonOut(['success' => false, 'error' => $e->getMessage()]);
}
