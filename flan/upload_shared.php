<?php

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
   $new = array_values(json_decode($_POST['json']));
   $current = file_get_contents('history_shared.json');
   $submissions = array_values(json_decode($current));
   $n = array_merge($submissions, $new);
   $n = array_values(array_unique($n, SORT_REGULAR));

   $str = json_encode($n, JSON_PRETTY_PRINT);
   file_put_contents('history_shared.json', $str);
}

?>Sent
