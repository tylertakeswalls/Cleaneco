<?php
$data = ['service_ids' => '[1, 2]'];

$serviceIds = [];
if (isset($data['service_ids'])) {
    if (is_array($data['service_ids'])) {
        $serviceIds = $data['service_ids'];
    } else {
        $decoded = json_decode($data['service_ids'], true);
        if (is_array($decoded)) {
            $serviceIds = $decoded;
        } else {
            $serviceIds = array_filter(array_map('intval', explode(',', $data['service_ids'])));
        }
    }
}
print_r($serviceIds);

$idList = implode(',', array_map('intval', $serviceIds));
echo "ID List: " . $idList . "\n";
?>
