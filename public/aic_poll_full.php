<?php
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);


libxml_use_internal_errors(true);
setlocale(LC_CTYPE, "en_US.UTF-8");

$submitId = intval($_GET['id']);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://www.aicrowd.com/challenges/hackaprompt-2023/submissions/$submitId");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
));
$output = curl_exec($ch);
curl_close($ch);

$dom = new DomDocument();
$dom->loadHTML($output);

$xpath = new DOMXpath($dom);
$msgNode = $xpath->query('//h4[contains(text(), "Message")]')->item(0);
$message = $msgNode->nextSibling->nextSibling->nodeValue;
if (trim($message) === 'Evaluating…')
    die('WAIT');

$scoreText = '';

$scoresNode = $xpath->query('//h3[contains(text(), "Additional Information")]')->item(0);
if ($scoresNode === null)
    die('NO_SCORES');
$scoresNode = $scoresNode->parentNode;
while ($scoresNode->nextSibling) {
    $scoresNode = $scoresNode->nextSibling;
    if ($scoresNode->nodeType !== XML_ELEMENT_NODE)
        continue;
    $title = trim($xpath->query('.//h4', $scoresNode)->item(0)->nodeValue);
    $score = $xpath->query('.//span/a', $scoresNode)->item(0)->nodeValue;
    if ($title === "flan_only_score")
        continue;
    //print("$score ");
    $scoreText .= "$score ";
}
/*
$scoreNode = $xpath->query('//h4[contains(text(), "Score")]')->item(0);
$score = $scoreNode->nextSibling->nextSibling->nodeValue;
$score = intval($score);
print($score);
 */

print("OK\n$scoreText");
