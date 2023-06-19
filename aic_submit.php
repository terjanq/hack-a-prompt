<?php
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);


libxml_use_internal_errors(true);
setlocale(LC_CTYPE, "en_US.UTF-8");
if ($_SERVER['REQUEST_METHOD'] !== 'POST')
    die("bad method");

$submit = json_decode($_POST['json']);
//$submit = json_decode(file_get_contents('submissions.json'));
file_put_contents('aic_pending_submission.json', json_encode($submit, JSON_PRETTY_PRINT));

$cookie = '_aicrowd_session=cookie-session';

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://www.aicrowd.com/challenges/hackaprompt-2023/submissions/new");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
    'Cookie: ' . $cookie
));
$output = curl_exec($ch);
curl_close($ch);

$dom = new DomDocument();
$dom->loadHTML($output);

$xpath = new DOMXpath($dom);
$form = $xpath->query('//form[@id="new_submission"]')->item(0);
$s3_upload_fields = json_decode($form->attributes->getNamedItem('data-form-data')->value, true);
//$s3_upload_url = $form->attributes->getNamedItem('data-url')->value;

$token_field = $xpath->query('//form[@id="new_submission"]/input[@name="authenticity_token"]')->item(0);
$token = $token_field->attributes->getNamedItem('value')->value;


$s3_upload_fields['file'] = new \CURLFile('aic_pending_submission.json', 'text/plain', 'submission.json');

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://aicrowd-production.s3.eu-central-1.amazonaws.com");
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $s3_upload_fields);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
));
$output = curl_exec($ch);
$http_status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
if ($http_status !== 201)
    die("File upload failed");
curl_close($ch);

$dom = new DomDocument();
$dom->loadXML($output);

$xpath = new DOMXpath($dom);
$key = $xpath->query('/PostResponse/Key')->item(0)->nodeValue;

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://www.aicrowd.com/challenges/hackaprompt-2023/submissions");
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, array(
    'utf8' => '✓',
    'authenticity_token' => $token,
    'submission[description]' => '',
    'submission[submission_files_attributes][0][seq]' => '',
    'submission[submission_files_attributes][0][submission_type]' => 'artifact',
    'commit' => 'Submit Submission',
    'submission[submission_files_attributes][0][submission_file_s3_key]' => $key,
));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
    'Cookie: ' . $cookie
));
$output = curl_exec($ch);
$http_status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
if ($http_status !== 302)
    die("Submission failed");
$res_url = curl_getinfo($ch, CURLINFO_REDIRECT_URL);
if ($res_url === "https://www.aicrowd.com/participants/sign_in")
    die("Login required");
curl_close($ch);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://www.aicrowd.com/challenges/hackaprompt-2023/submissions");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
    'Cookie: ' . $cookie
));
$output = curl_exec($ch);
$http_status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
if ($http_status !== 200)
    die("Failed to get submission list");
curl_close($ch);

$dom = new DomDocument();
$dom->loadHTML($output);

$xpath = new DOMXpath($dom);

$myUserName = $xpath->query('//a[@data-action="click->notifications#readNotifications"]')->item(0)->attributes->getNamedItem('data-notifications-notification-id')->value;

$rows = $xpath->query('//tbody[@id="submissions-div"]/tr');
$found = null;
foreach ($rows as $entry) {
    $userName = $xpath->query('.//span[@data-action="mouseenter->participants#getUserProfile"]/span', $entry)->item(0)->nodeValue;
    if ($userName === $myUserName) {
        $found = $entry;
        break;
    }
}
if ($found == null)
    die("Submission not found");
$submissionId = $xpath->query('.//td/a/strong', $found)->item(0)->nodeValue;
print("OK\n" . $submissionId);
