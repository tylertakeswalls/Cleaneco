<?php
if (function_exists('opcache_reset')) {
    opcache_reset();
    echo "OPcache reset successfully.\n";
} else {
    echo "OPcache is not loaded.\n";
}
echo "upload_max_filesize: " . ini_get("upload_max_filesize") . "\n";
echo "post_max_size: " . ini_get("post_max_size") . "\n";
?>
