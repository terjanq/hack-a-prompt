const submitTextArea = document.getElementById("submit-text");
const submitButton = document.getElementById("submit-button");
const submitStatus = document.getElementById("submit-status");
const submitScore = document.getElementById("submit-score");
const submitRetries = document.getElementById("submit-retries");
const logPre = document.getElementById("log");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function log(txt) {
    logPre.appendChild(document.createTextNode(txt + '\n'));
}

async function doSubmit(data) {
  const minScore = parseInt(submitScore.value);
  const retries = parseInt(submitRetries.value);
  for (let i = 1; i <= retries; i++) {
    submitButton.disabled = true;
    submitStatus.textContent = '[Attempt ' + i + '] Uploading submission...';

    let res = await fetch('aic_submit.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
      },
      body: "json=" + encodeURIComponent(submitTextArea.value)
    });
    let resText = await res.text();
    if (!resText.startsWith("OK\n")) {
      alert(resText);
      return;
    }

    const submitId = parseInt(resText.split('\n')[1]);
    submitStatus.textContent = '[Attempt ' + i + '] Waiting for grading for submission ID ' + submitId + '...';
    let shouldWaitIfZero = 2;
    let parseFailCount = 0;
    const submitTime = new Date().getTime();
    while (true) {
      await sleep(2000);

      res = await fetch('aic_poll_full.php?id='+submitId);
      resText = await res.text();
      resText = resText.trim();
      if (resText === 'WAIT')
        continue;
      if (resText === '0' && shouldWaitIfZero > 0) {
        await sleep(7500);
        shouldWaitIfZero--;
      }

      if (resText === 'NO_SCORES') {
        log('Attempt ' + i + ': No scores.');

        console.error('Do resubmit');
        break;
      }
      if (!resText.startsWith('OK\n')) {
        console.error(resText);
        parseFailCount++;
        if (parseFailCount === 10) {
          alert(resText);
        }
        continue;
      }
      parseFailCount = 0;

      resText = resText.substring(3);
/*
      const score = parseInt(resText);

      res = await fetch('aic_poll_full.php?id='+submitId);
      let resTextFull = await res.text();
      resTextFull = resTextFull.trim();*/
      const resTextFull = resText;
      let score = resTextFull.split(' ').reduce((x,y)=>x+parseInt(y), 0);

      //log('Attempt ' + i + ': ' + resTextFull + ' [total='+(altScore!==score?altScore+'/'+score:score)+']');
      log('Attempt ' + i + ': ' + resTextFull + ' [total='+score+']');

      if (score >= minScore/* || altScore >= minScore*/) {
        submitStatus.textContent = 'Done';
        return;
      }

      console.error('Do resubmit');
      break;
    }
    const failTime = new Date().getTime();
    const waitTime = 30000 - (failTime - submitTime);
    if (waitTime > 0)
      await sleep(waitTime);
  }
  alert('Exhausted tries!');
}

submitButton.onclick = () => doSubmit().catch(alert);

try{
  submitTextArea.value = JSON.stringify(top.opener.submitPageData, null, 4);
  submitTextArea.style.height = (submitTextArea.scrollHeight) + "px";
}
catch(e){}

