<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

$cfg  = requireSession();
$body = jsonBody();

$db      = trim($body['database'] ?? '');
$table   = trim($body['table']    ?? '');
$columns = $body['columns']        ?? [];

if (!$db || !$table || !$columns) {
    jsonOut(['success' => false, 'error' => 'Missing required parameters']);
}

if (!preg_match('/^[a-zA-Z0-9_\-\.]+$/', $db) || !preg_match('/^[a-zA-Z0-9_\-\.]+$/', $table)) {
    jsonOut(['success' => false, 'error' => 'Invalid identifier']);
}

try {
    $pdo = getConnection($cfg);
    $pdo->exec("USE `{$db}`");

    // Get current column order from DB for AFTER positioning
    $stmt = $pdo->query("SHOW COLUMNS FROM `{$table}`");
    $existing = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $existingNames = array_column($existing, 'Field');

    $clauses = [];
    $prev = null; // for AFTER / FIRST positioning

    foreach ($columns as $col) {
        $origName = trim($col['originalName'] ?? '');
        $newName  = trim($col['name']         ?? '');
        $baseType = strtoupper(trim($col['baseType'] ?? 'VARCHAR'));

        if (!$newName) continue;
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $newName)) {
            jsonOut(['success' => false, 'error' => "Invalid column name: {$newName}"]);
        }

        // Build type string
        $typeStr = buildTypeStr($baseType, $col);

        // NULL / NOT NULL
        $nullStr = !empty($col['allowNull']) ? 'NULL' : 'NOT NULL';

        // Default
        $defaultStr = '';
        $defType  = $col['defaultType'] ?? 'NULL';
        $defVal   = $col['defaultValue'] ?? '';
        $allowNull = !empty($col['allowNull']);
        $autoInc   = !empty($col['autoIncrement']);

        $noDefaultTypes = ['TEXT','TINYTEXT','MEDIUMTEXT','LONGTEXT','BLOB','TINYBLOB','MEDIUMBLOB','LONGBLOB','JSON','GEOMETRY'];

        if ($autoInc) {
            // AUTO_INCREMENT columns must not have a DEFAULT
            $defaultStr = '';
        } elseif (!in_array($baseType, $noDefaultTypes)) {
            if ($defType === 'NULL') {
                // DEFAULT NULL is only valid when column allows NULL
                if ($allowNull) {
                    $defaultStr = 'DEFAULT NULL';
                }
                // NOT NULL without default → no DEFAULT clause, MySQL picks implicit default or errors on insert
            } elseif ($defType === 'EMPTY') {
                // Empty string only valid for string types
                $stringTypes = ['CHAR','VARCHAR','TINYTEXT','TEXT','MEDIUMTEXT','LONGTEXT','BINARY','VARBINARY','ENUM','SET'];
                if (in_array($baseType, $stringTypes)) {
                    $defaultStr = "DEFAULT ''";
                }
            } elseif ($defType === 'CURRENT_TIMESTAMP') {
                $defaultStr = 'DEFAULT CURRENT_TIMESTAMP';
            } elseif ($defType === 'VALUE' && $defVal !== '') {
                $quoted = $pdo->quote($defVal);
                $defaultStr = "DEFAULT {$quoted}";
            }
        }

        // AUTO_INCREMENT
        $aiStr = $autoInc ? 'AUTO_INCREMENT' : '';

        // Position
        $posStr = $prev === null ? 'FIRST' : "AFTER `{$prev}`";

        $colDef = trim("`{$newName}` {$typeStr} {$nullStr} {$defaultStr} {$aiStr}");

        // CHANGE (rename or redefine) vs MODIFY (same name, redefine)
        if ($origName && in_array($origName, $existingNames)) {
            $clauses[] = "CHANGE `{$origName}` {$colDef} {$posStr}";
        } else {
            // New column
            $clauses[] = "ADD COLUMN {$colDef} {$posStr}";
        }

        $prev = $newName;
    }

    // Drop columns that were in DB but not in the new list
    $newOriginals = array_filter(array_column($columns, 'originalName'));
    foreach ($existingNames as $exName) {
        if (!in_array($exName, $newOriginals)) {
            $clauses[] = "DROP COLUMN `{$exName}`";
        }
    }

    if (!$clauses) {
        jsonOut(['success' => true, 'message' => 'No changes']);
    }

    $sql = "ALTER TABLE `{$table}` " . implode(', ', $clauses);
    $pdo->exec($sql);

    jsonOut(['success' => true, 'sql' => $sql]);
} catch (PDOException $e) {
    jsonOut(['success' => false, 'error' => $e->getMessage()]);
}

function buildTypeStr(string $base, array $col): string {
    $length   = trim($col['length']     ?? '');
    $decimals = trim($col['decimals']   ?? '');
    $enumVals = trim($col['enumValues'] ?? '');
    $unsigned = !empty($col['unsigned']);

    $needsLength   = in_array($base, ['TINYINT','SMALLINT','MEDIUMINT','INT','BIGINT','FLOAT','DOUBLE','DECIMAL','NUMERIC','CHAR','VARCHAR','BINARY','VARBINARY','BIT']);
    $needsDecimals = in_array($base, ['FLOAT','DOUBLE','DECIMAL','NUMERIC']);
    $needsEnum     = in_array($base, ['ENUM','SET']);
    $canUnsigned   = in_array($base, ['TINYINT','SMALLINT','MEDIUMINT','INT','BIGINT','FLOAT','DOUBLE','DECIMAL','NUMERIC']);

    if ($needsEnum && $enumVals) {
        return "{$base}({$enumVals})";
    }
    if ($needsDecimals && $length && $decimals) {
        return "{$base}({$length},{$decimals})" . ($unsigned && $canUnsigned ? ' UNSIGNED' : '');
    }
    if ($needsLength && $length) {
        return "{$base}({$length})" . ($unsigned && $canUnsigned ? ' UNSIGNED' : '');
    }
    return $base . ($unsigned && $canUnsigned ? ' UNSIGNED' : '');
}
