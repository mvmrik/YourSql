<?php
require __DIR__ . '/_session.php';
$cfg = requireSession();

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonOut(['success' => false, 'error' => 'POST required']);
}

// When the upload exceeds post_max_size, PHP empties $_POST and $_FILES entirely
if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($_POST) && empty($_FILES)) {
    $postMax    = ini_get('post_max_size');
    $uploadMax  = ini_get('upload_max_filesize');
    jsonOut(['success' => false, 'error' =>
        "Upload was rejected by PHP (file too large). " .
        "Server limits: upload_max_filesize={$uploadMax}, post_max_size={$postMax}."
    ]);
}

$database = trim($_POST['database'] ?? '');
if (!$database) {
    jsonOut(['success' => false, 'error' => 'Missing database — this usually means the upload exceeded the PHP size limit (upload_max_filesize=' . ini_get('upload_max_filesize') . ')']);
}

if (empty($_FILES['sql_file']) || $_FILES['sql_file']['error'] !== UPLOAD_ERR_OK) {
    $errCode = $_FILES['sql_file']['error'] ?? -1;
    $errMap  = [
        UPLOAD_ERR_INI_SIZE   => 'File exceeds upload_max_filesize in php.ini',
        UPLOAD_ERR_FORM_SIZE  => 'File exceeds MAX_FILE_SIZE in form',
        UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded',
        UPLOAD_ERR_NO_FILE    => 'No file uploaded',
        UPLOAD_ERR_NO_TMP_DIR => 'Missing tmp folder',
        UPLOAD_ERR_CANT_WRITE => 'Failed to write file',
        UPLOAD_ERR_EXTENSION  => 'Upload stopped by extension',
    ];
    jsonOut(['success' => false, 'error' => $errMap[$errCode] ?? 'Upload error #' . $errCode]);
}

$tmpPath = $_FILES['sql_file']['tmp_name'];
$fileSize = filesize($tmpPath);

// Move to a persistent tmp location so SSE endpoint can track progress
$importId  = bin2hex(random_bytes(8));
$importDir = sys_get_temp_dir() . '/yoursql_import';
if (!is_dir($importDir)) mkdir($importDir, 0700);

$destPath    = $importDir . '/' . $importId . '.sql';
$statusPath  = $importDir . '/' . $importId . '.json';

if (!move_uploaded_file($tmpPath, $destPath)) {
    jsonOut(['success' => false, 'error' => 'Failed to move uploaded file']);
}

// Write initial status
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
