<?php
require __DIR__ . '/_session.php';
$cfg = requireSession();

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonOut(['success' => false, 'error' => 'POST required']);
}

$database = trim($_GET['database'] ?? '');
if (!$database) {
    jsonOut(['success' => false, 'error' => 'Missing database parameter']);
}

$importId  = bin2hex(random_bytes(8));
$importDir = sys_get_temp_dir() . '/yoursql_import';
if (!is_dir($importDir)) mkdir($importDir, 0700, true);

$destPath   = $importDir . '/' . $importId . '.sql';
$statusPath = $importDir . '/' . $importId . '.json';

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';

if (str_contains($contentType, 'multipart/form-data')) {
    // Small file via normal FormData upload — still support it
    if (empty($_FILES['sql_file']) || $_FILES['sql_file']['error'] !== UPLOAD_ERR_OK) {
        $code = $_FILES['sql_file']['error'] ?? -1;
        $map  = [
            1 => 'File exceeds upload_max_filesize=' . ini_get('upload_max_filesize'),
            2 => 'File exceeds form MAX_FILE_SIZE',
            3 => 'File only partially uploaded',
            4 => 'No file selected',
            6 => 'Missing tmp folder',
            7 => 'Cannot write to tmp folder',
        ];
        jsonOut(['success' => false, 'error' => $map[$code] ?? 'Upload error #' . $code]);
    }
    if (!move_uploaded_file($_FILES['sql_file']['tmp_name'], $destPath)) {
        jsonOut(['success' => false, 'error' => 'Failed to move uploaded file']);
    }
    $fileSize = filesize($destPath);
} else {
    // Large file: raw binary stream via fetch — bypasses upload_max_filesize entirely
    $in  = fopen('php://input', 'rb');
    $out = fopen($destPath, 'wb');
    if (!$in || !$out) {
        jsonOut(['success' => false, 'error' => 'Cannot open stream']);
    }
    $fileSize = 0;
    while (!feof($in)) {
        $chunk = fread($in, 1048576); // 1 MB chunks
        if ($chunk === false) break;
        fwrite($out, $chunk);
        $fileSize += strlen($chunk);
    }
    fclose($in);
    fclose($out);

    if ($fileSize === 0) {
        @unlink($destPath);
        jsonOut(['success' => false, 'error' => 'Received empty file']);
    }
}

file_put_contents($statusPath, json_encode([
    'state'    => 'pending',
    'database' => $database,
    'fileSize' => $fileSize,
    'bytesRead'=> 0,
    'executed' => 0,
    'errors'   => [],
]));

jsonOut([
    'success'   => true,
    'import_id' => $importId,
    'file_size' => $fileSize,
]);
