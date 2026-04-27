<?php
// Runs the actual import in the background, streams SSE progress
require __DIR__ . '/_session.php';
$cfg = requireSession();

$importId = trim($_GET['import_id'] ?? '');
if (!$importId || !preg_match('/^[a-f0-9]{16}$/', $importId)) {
    http_response_code(400); exit;
}

$importDir  = sys_get_temp_dir() . '/yoursql_import';
$sqlPath    = $importDir . '/' . $importId . '.sql';
$statusPath = $importDir . '/' . $importId . '.json';

if (!file_exists($sqlPath) || !file_exists($statusPath)) {
    http_response_code(404); exit;
}

$status   = json_decode(file_get_contents($statusPath), true);
$database = $status['database'];
$fileSize = $status['fileSize'];

// SSE headers
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('X-Accel-Buffering: no');
while (ob_get_level()) ob_end_clean();

function sse(array $data): void {
    echo 'data: ' . json_encode($data) . "\n\n";
    flush();
}

try {
    $pdo = getConnection(array_merge($cfg, ['database' => $database]));
    $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
    $pdo->exec('SET NAMES utf8mb4');
} catch (PDOException $e) {
    sse(['state' => 'error', 'error' => 'Connection error: ' . $e->getMessage()]);
    exit;
}

$fh = fopen($sqlPath, 'r');
if (!$fh) {
    sse(['state' => 'error', 'error' => 'Cannot open import file']);
    exit;
}

$stmt         = '';
$bytesRead    = 0;
$executed     = 0;
$errors       = [];
$inString     = false;
$strChar      = '';
$inComment    = false;
$delimiter    = ';';       // current delimiter
$inDelimiter  = false;     // inside a DELIMITER block (procedure/function/trigger)
$lastPct      = -1;

sse(['state' => 'running', 'pct' => 0, 'executed' => 0]);

while (!feof($fh)) {
    $line = fgets($fh, 65536);
    if ($line === false) break;
    $bytesRead += strlen($line);

    $trimmed = trim($line);

    // Handle DELIMITER command — e.g. "DELIMITER ;;" or "DELIMITER ;"
    if (preg_match('/^DELIMITER\s+(\S+)/i', $trimmed, $m)) {
        $newDelim = $m[1];
        if ($newDelim === ';') {
            // Returning to standard delimiter — end of procedure block, skip it silently
            $inDelimiter = false;
            $delimiter   = ';';
        } else {
            // Entering a non-standard delimiter block (stored procedure/function/trigger)
            $inDelimiter = true;
            $delimiter   = $newDelim;
        }
        $stmt = '';
        continue;
    }

    // Skip everything inside a DELIMITER block — we can't execute it via PDO
    if ($inDelimiter) {
        continue;
    }

    // Skip single-line comments when not building a statement
    if ($stmt === '' && (str_starts_with($trimmed, '--') || str_starts_with($trimmed, '#'))) {
        continue;
    }

    // Parse char by char to handle strings and block comments correctly
    $len = strlen($line);
    for ($i = 0; $i < $len; $i++) {
        $ch   = $line[$i];
        $next = $line[$i + 1] ?? '';

        if ($inComment) {
            if ($ch === '*' && $next === '/') { $inComment = false; $i++; }
            continue;
        }

        if ($inString) {
            $stmt .= $ch;
            if ($ch === '\\') { $stmt .= $next; $i++; continue; }
            if ($ch === $strChar) $inString = false;
            continue;
        }

        // Start block comment
        if ($ch === '/' && $next === '*') { $inComment = true; $i++; continue; }

        // Start string
        if ($ch === "'" || $ch === '"' || $ch === '`') {
            $inString = true; $strChar = $ch; $stmt .= $ch; continue;
        }

        // Statement terminator
        if ($ch === $delimiter[0] && substr($line, $i, strlen($delimiter)) === $delimiter) {
            $i += strlen($delimiter) - 1;
            $stmt = trim($stmt);
            if ($stmt !== '') {
                try {
                    $pdo->exec($stmt);
                    $executed++;
                } catch (PDOException $e) {
                    $errors[] = ['stmt' => substr($stmt, 0, 120), 'error' => $e->getMessage()];
                    if (count($errors) >= 50) {
                        fclose($fh);
                        $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
                        sse(['state' => 'error', 'error' => 'Too many errors (50+). Aborting.', 'errors' => $errors]);
                        exit;
                    }
                }
            }
            $stmt = '';

            // Report progress
            $pct = $fileSize > 0 ? (int)(($bytesRead / $fileSize) * 100) : 0;
            if ($pct !== $lastPct) {
                $lastPct = $pct;
                sse(['state' => 'running', 'pct' => $pct, 'executed' => $executed, 'errors' => count($errors)]);
            }
            continue;
        }

        $stmt .= $ch;
    }
}

fclose($fh);

// Execute any trailing statement without semicolon
$stmt = trim($stmt);
if ($stmt !== '') {
    try { $pdo->exec($stmt); $executed++; } catch (PDOException $e) {
        $errors[] = ['stmt' => substr($stmt, 0, 120), 'error' => $e->getMessage()];
    }
}

$pdo->exec('SET FOREIGN_KEY_CHECKS=1');

// Cleanup
@unlink($sqlPath);
@unlink($statusPath);

sse(['state' => 'done', 'pct' => 100, 'executed' => $executed, 'errors' => $errors]);
