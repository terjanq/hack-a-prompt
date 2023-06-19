<?php
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);


$mySubmissionId = '' . intval($_GET['id']);

libxml_use_internal_errors(true);
setlocale(LC_CTYPE, "en_US.UTF-8");

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://www.aicrowd.com/challenges/hackaprompt-2023/submissions");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
));
$output = curl_exec($ch);
$http_status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
if ($http_status !== 200)
    die("Failed to get submission list");
curl_close($ch);

$dom = new DomDocument();
$dom->loadHTML($output);

$xpath = new DOMXpath($dom);

$rows = $xpath->query('//tbody[@id="submissions-div"]/tr');
$found = null;
foreach ($rows as $entry) {
    $submissionId = $xpath->query('.//td/a/strong', $entry)->item(0)->nodeValue;
    if ($submissionId === $mySubmissionId) {
        $found = $entry;
        break;
    }
}
if ($found == null)
    die("Submission not found");
$score = $xpath->query('.//td', $found)->item(3)->nodeValue;
$msg = trim($xpath->query('.//p', $xpath->query('.//td', $found)->item(4))->item(0)->nodeValue);

if ($msg === 'Evaluating…')
    die('WAIT');
print($score);
