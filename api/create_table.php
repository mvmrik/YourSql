<?php
require __DIR__ . '/_session.php';
header('Content-Type: application/json');

$cfg  = requireSession();
$body = jsonBody();

$db        = trim($body['database']  ?? '');
$table     = trim($body['table']     ?? '');
$columns   = $body['columns']         ?? [];
$engine    = trim($body['engine']    ?? 'InnoDB');
$collation = trim($body['collation'] ?? '');
$comment   = trim($body['comment']   ?? '');

if (!$db || !$table || !$columns) {
    jsonOut(['success' => false, 'error' => 'Missing required parameters']);
}

if (!preg_match('/^[a-zA-Z0-9_]+$/', $db) || !preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
    jsonOut(['success' => false, 'error' => 'Invalid identifier']);
}

try {
    $pdo = getConnection($cfg);
    $pdo->exec("USE `{$db}`");

    $colDefs    = [];
    $primaryKeys = [];

    foreach ($columns as $col) {
        $name     = trim($col['name']     ?? '');
        $baseType = strtoupper(trim($col['baseType'] ?? 'VARCHAR'));

        if (!$name) continue;
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $name)) {
            jsonOut(['success' => false, 'error' => "Invalid column name: {$name}"]);
        }

        $typeStr   = buildTypeStr($baseType, $col);
        $allowNull = !empty($col['allowNull']);
        $autoInc   = !empty($col['autoIncrement']);
        $isPrimary = !empty($col['primary']);
        $nullStr   = $allowNull ? 'NULL' : 'NOT NULL';

        // Default
        $defaultStr = '';
        $noDefaultTypes = ['TEXT','TINYTEXT','MEDIUMTEXT','LONGTEXT','BLOB','TINYBLOB','MEDIUMBLOB','LONGBLOB','JSON','GEOMETRY'];
        if (!$autoInc && !in_array($baseType, $noDefaultTypes)) {
            $defType = $col['defaultType'] ?? 'NULL';
            $defVal  = $col['defaultValue'] ?? '';

            if ($defType === 'NULL' && $allowNull) {
                $defaultStr = 'DEFAULT NULL';
            } elseif ($defType === 'EMPTY') {
                $stringTypes = ['CHAR','VARCHAR','TINYTEXT','TEXT','MEDIUMTEXT','LONGTEXT','BINARY','VARBINARY','ENUM','SET'];
                if (in_array($baseType, $stringTypes)) $defaultStr = "DEFAULT ''";
            } elseif ($defType === 'CURRENT_TIMESTAMP') {
                $defaultStr = 'DEFAULT CURRENT_TIMESTAMP';
            } elseif ($defType === 'VALUE' && $defVal !== '') {
                $defaultStr = 'DEFAULT ' . $pdo->quote($defVal);
            }
        }

        $aiStr = $autoInc ? 'AUTO_INCREMENT' : '';

        $collation  = trim($col['collation'] ?? '');
        $charsetStr = '';
        if ($collation && preg_match('/^[a-zA-Z0-9_]+$/', $collation)) {
            $charset    = explode('_', $collation)[0];
            $charsetStr = "CHARACTER SET {$charset} COLLATE {$collation}";
        }

        $colDefs[] = trim("`{$name}` {$typeStr} {$charsetStr} {$nullStr} {$defaultStr} {$aiStr}");

        if ($isPrimary) {
            $primaryKeys[] = "`{$name}`";
        }
    }

    if (!$colDefs) {
        jsonOut(['success' => false, 'error' => 'No valid columns defined']);
    }

    if ($primaryKeys) {
        $colDefs[] = 'PRIMARY KEY (' . implode(', ', $primaryKeys) . ')';
    }

    $options = "ENGINE=" . ($engine ?: 'InnoDB');
    if ($collation) $options .= " COLLATE={$collation}";
    if ($comment)   $options .= " COMMENT=" . $pdo->quote($comment);

    $sql = "CREATE TABLE `{$table}` (\n  " . implode(",\n  ", $colDefs) . "\n) {$options}";

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

    if ($needsEnum && $enumVals)                        return "{$base}({$enumVals})";
    if ($needsDecimals && $length && $decimals)         return "{$base}({$length},{$decimals})" . ($unsigned && $canUnsigned ? ' UNSIGNED' : '');
    if ($needsLength && $length)                        return "{$base}({$length})" . ($unsigned && $canUnsigned ? ' UNSIGNED' : '');
    return $base . ($unsigned && $canUnsigned ? ' UNSIGNED' : '');
}
