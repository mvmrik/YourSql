<?php
require __DIR__ . '/_session.php';
$cfg = requireSession();

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonOut(['success' => false, 'error' => 'POST required']);
}

// database comes as a GET param so it survives even if post_max_size is exceeded
$database = trim($_GET['database'] ?? $_POST['database'] ?? '');
if (!$database) {
    $postMax   = ini_get('post_max_size');
    $uploadMax = ini_get('upload_max_filesize');
    jsonOut(['success' => false, 'error' =>
        "Missing database. If the file is large, check nginx client_max_body_size " .
        "(server php limits: upload_max_filesize={$uploadMax}, post_max_size={$postMax})."
    ]);
}

if (empty($_FILES['sql_file'])) {
    jsonOut(['success' => false, 'error' =>
        'No file received by PHP. ' .
        'FILES keys: [' . implode(', ', array_keys($_FILES)) . '] ' .
        'Content-Type: ' . ($_SERVER['CONTENT_TYPE'] ?? 'none') . ' ' .
        'Content-Length: ' . ($_SERVER['CONTENT_LENGTH'] ?? 'none') . ' ' .
        'upload_max_filesize=' . ini_get('upload_max_filesize') . ' ' .
        'post_max_size=' . ini_get('post_max_size') . ' ' .
        'file_uploads=' . ini_get('file_uploads')
    ]);
}

if ($_FILES['sql_file']['error'] !== UPLOAD_ERR_OK) {
    $errCode = $_FILES['sql_file']['error'];
    $errMap  = [
        UPLOAD_ERR_INI_SIZE   => 'File exceeds upload_max_filesize=' . ini_get('upload_max_filesize'),
        UPLOAD_ERR_FORM_SIZE  => 'File exceeds MAX_FILE_SIZE in form',
        UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded',
        UPLOAD_ERR_NO_FILE    => 'No file selected',
        UPLOAD_ERR_NO_TMP_DIR => 'Missing tmp folder — check upload_tmp_dir in php.ini',
        UPLOAD_ERR_CANT_WRITE => 'Cannot write to tmp folder',
        UPLOAD_ERR_EXTENSION  => 'Upload blocked by PHP extension',
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
