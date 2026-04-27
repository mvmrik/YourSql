<?php
require __DIR__ . '/_session.php';
requireSession();
header('Content-Type: application/json');

function parseSize(string $val): int {
    $val  = trim($val);
    $last = strtolower($val[strlen($val) - 1]);
    $num  = (int)$val;
    return match($last) {
        'g' => $num * 1024 * 1024 * 1024,
        'm' => $num * 1024 * 1024,
        'k' => $num * 1024,
        default => $num,
    };
}

$uploadMax = ini_get('upload_max_filesize');
$postMax   = ini_get('post_max_size');

// Effective limit is the smaller of the two (for multipart); for raw stream only post_max_size matters
// But since we now use raw stream, post_max_size is the real ceiling
$effectiveBytes = min(parseSize($uploadMax), parseSize($postMax));

jsonOut([
    'success'        => true,
    'upload_max'     => $uploadMax,
    'post_max'       => $postMax,
    'effective_bytes'=> $effectiveBytes,
]);
