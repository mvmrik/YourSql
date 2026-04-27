<?php
require __DIR__ . '/_session.php';
$cfg = requireSession();
header('Content-Type: application/json');

$body     = jsonBody();
$database = trim($body['database'] ?? '');
$tables   = $body['tables']    ?? [];
$op       = trim($body['op']   ?? ''); // truncate | drop

$destructive  = ['truncate', 'drop'];
$maintenance  = ['analyze', 'optimize', 'check', 'repair'];
$allowedOps   = array_merge($destructive, $maintenance);

if (!$database || empty($tables) || !in_array($op, $allowedOps, true)) {
    jsonOut(['success' => false, 'error' => 'Invalid request']);
}

try {
    $pdo = getConnection(array_merge($cfg, ['database' => $database]));
} catch (PDOException $e) {
    jsonOut(['success' => false, 'error' => 'Connection error: ' . $e->getMessage()]);
}

$done   = [];
$errors = [];

if (in_array($op, $maintenance, true)) {
    // Maintenance ops: run as a single statement across all tables, return per-table results
    $tableList = implode(', ', array_map(fn($t) => '`' . (string)$t . '`', $tables));
    $sql = strtoupper($op) . ' TABLE ' . $tableList;
    try {
        $stmt = $pdo->query($sql);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        // rows: Table, Op, Msg_type, Msg_text
        foreach ($rows as $row) {
            $tbl = $row['Table'] ?? ($row['table'] ?? '');
            // Strip "database.table" prefix
            if (str_contains($tbl, '.')) $tbl = substr($tbl, strrpos($tbl, '.') + 1);
            $type = strtolower($row['Msg_type'] ?? '');
            $msg  = $row['Msg_text'] ?? '';
            if ($type === 'error') {
                $errors[] = ['table' => $tbl, 'error' => $msg];
            } else {
                $done[] = ['table' => $tbl, 'type' => $type, 'msg' => $msg];
            }
        }
    } catch (PDOException $e) {
        jsonOut(['success' => false, 'error' => $e->getMessage()]);
    }
} else {
    // Destructive ops
    $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
    foreach ($tables as $table) {
        $table = (string)$table;
        if (!preg_match('/^[\w\-\.]+$/u', $table)) {
            $errors[] = ['table' => $table, 'error' => 'Invalid table name'];
            continue;
        }
        try {
            if ($op === 'truncate') {
                $pdo->exec('TRUNCATE TABLE `' . $table . '`');
            } else {
                $pdo->exec('DROP TABLE IF EXISTS `' . $table . '`');
            }
            $done[] = $table;
        } catch (PDOException $e) {
            $errors[] = ['table' => $table, 'error' => $e->getMessage()];
        }
    }
    $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
}

jsonOut(['success' => true, 'done' => $done, 'errors' => $errors]);
