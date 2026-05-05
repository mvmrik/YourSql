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

    if ($action === 'list') {
        $stmt = $pdo->prepare("
            SELECT
                kcu.CONSTRAINT_NAME          AS name,
                kcu.COLUMN_NAME              AS col,
                kcu.REFERENCED_TABLE_SCHEMA  AS ref_db,
                kcu.REFERENCED_TABLE_NAME    AS ref_table,
                kcu.REFERENCED_COLUMN_NAME   AS ref_col,
                rc.UPDATE_RULE               AS on_update,
                rc.DELETE_RULE               AS on_delete
            FROM information_schema.KEY_COLUMN_USAGE kcu
            JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
                ON  rc.CONSTRAINT_NAME   = kcu.CONSTRAINT_NAME
                AND rc.CONSTRAINT_SCHEMA = kcu.TABLE_SCHEMA
                AND rc.TABLE_NAME        = kcu.TABLE_NAME
            WHERE kcu.TABLE_SCHEMA = :db
              AND kcu.TABLE_NAME   = :tbl
              AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
            ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
        ");
        $stmt->execute([':db' => $db, ':tbl' => $table]);
        $rows = $stmt->fetchAll();

        $fks = [];
        foreach ($rows as $r) {
            $n = $r['name'];
            if (!isset($fks[$n])) {
                $fks[$n] = [
                    'name'      => $n,
                    'columns'   => [],
                    'ref_db'    => $r['ref_db'],
                    'ref_table' => $r['ref_table'],
                    'ref_cols'  => [],
                    'on_update' => $r['on_update'],
                    'on_delete' => $r['on_delete'],
                ];
            }
            $fks[$n]['columns'][]  = $r['col'];
            $fks[$n]['ref_cols'][] = $r['ref_col'];
        }

        jsonOut(['success' => true, 'foreign_keys' => array_values($fks)]);

    } elseif ($action === 'add') {
        $name     = trim($body['name']      ?? '');
        $cols     = $body['columns']        ?? [];
        $refDb    = trim($body['ref_db']    ?? $db);
        $refTable = trim($body['ref_table'] ?? '');
        $refCols  = $body['ref_cols']       ?? [];
        $onUpdate = strtoupper(trim($body['on_update'] ?? 'RESTRICT'));
        $onDelete = strtoupper(trim($body['on_delete'] ?? 'RESTRICT'));

        if (empty($cols) || empty($refTable) || empty($refCols)) {
            jsonOut(['success' => false, 'error' => 'columns, ref_table and ref_cols are required']);
        }

        $allowed = ['RESTRICT','CASCADE','SET NULL','NO ACTION','SET DEFAULT'];
        if (!in_array($onUpdate, $allowed)) $onUpdate = 'RESTRICT';
        if (!in_array($onDelete, $allowed)) $onDelete = 'RESTRICT';

        foreach (array_merge([$refTable, $refDb], $cols, $refCols) as $id) {
            if (!preg_match('/^[a-zA-Z0-9_\-\.]+$/', $id)) {
                jsonOut(['success' => false, 'error' => "Invalid identifier: {$id}"]);
            }
        }

        $pdo->exec("USE `{$db}`");

        // Check engine — MyISAM silently ignores FK constraints
        $engStmt = $pdo->prepare(
            "SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?"
        );
        $engStmt->execute([$db, $table]);
        $engine = strtoupper($engStmt->fetchColumn() ?: '');
        if ($engine && $engine !== 'INNODB') {
            jsonOut(['success' => false, 'error' => "Foreign keys require InnoDB. This table uses {$engine}."]);
        }

        $constraintName = $name ?: 'fk_' . $table . '_' . implode('_', $cols);
        $colList    = implode(', ', array_map(fn($c) => "`{$c}`", $cols));
        $refColList = implode(', ', array_map(fn($c) => "`{$c}`", $refCols));

        $sql = "ALTER TABLE `{$table}` ADD CONSTRAINT `{$constraintName}` " .
               "FOREIGN KEY ({$colList}) REFERENCES `{$refDb}`.`{$refTable}` ({$refColList}) " .
               "ON UPDATE {$onUpdate} ON DELETE {$onDelete}";
        $pdo->exec($sql);
        jsonOut(['success' => true, 'sql' => $sql]);

    } elseif ($action === 'drop') {
        $name = trim($body['name'] ?? '');
        if (!$name) jsonOut(['success' => false, 'error' => 'Constraint name is required']);
        if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $name)) jsonOut(['success' => false, 'error' => 'Invalid constraint name']);

        $pdo->exec("USE `{$db}`");
        $sql = "ALTER TABLE `{$table}` DROP FOREIGN KEY `{$name}`";
        $pdo->exec($sql);
        jsonOut(['success' => true, 'sql' => $sql]);
    }

} catch (PDOException $e) {
    jsonOut(['success' => false, 'error' => $e->getMessage()]);
}
