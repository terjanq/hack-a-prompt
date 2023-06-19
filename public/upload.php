<?php
setlocale(LC_CTYPE, "en_US.UTF-8");
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
   $new = json_decode($_POST['json']);
   $current = file_get_contents('data/submissions.json');
   
   $submissions = json_decode($current);
   array_push($submissions, $new);

   $str = json_encode($submissions, JSON_PRETTY_PRINT);
   file_put_contents('data/submissions.json', $str);
   $estr = htmlentities($str);
}

?><!DOCTYPE html><html>
    <head>
        <meta charset="utf-8">
    </head>
    <body>
    <p>
        Paste a new submission.json here.
    </p>
    <form method=POST>
        <textarea name=json style="width:80vw;height:60vh"></textarea>
        <button>submit</button>
    </form>

    <pre><?=$estr;?></pre>
    </body>
</html>
