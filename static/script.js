const $ = e => document.querySelector(e);
const $$ = e => document.querySelectorAll(e);

const apikeyInput = $('#apikey');
const runButton = $('#run');
const run66Button = $('#run66');
const inputTextarea = $('#input');
const templateEl = $('#template');
const levelSelect = $('#level');
const revisionSelect = $('#revision');
const expectedInput = $('#expected');
const outputEl = $('#output');
const runsInput = $('#runs');
const saveButton = $('#save');
const removeButton = $('#remove');
const generateButton = $('#generate');
const submitButton = $('#submit');
const resetButton = $('#reset');
const historyEl = $('#history');
const tokensInput = $('#tokens');
const ptokensInput = $('#ptokens');
const clearHistoryButton = $('#clearHistory');
const runflanButton = $('#runFlan');
const translationApi = $('#trasnlateApi');
const replaceBanned = $('#replaceBanned');
const replaceAll = $('#replaceAll');
const clearOutputButton = $('#clearOutput');
const runPaddedButton = $('#runPadded')
const historyOutput = $('#historyOutput');

let CURRENT_LEVEL = parseInt(localStorage.getItem('last_level')) || 6;

apikeyInput.value = localStorage.getItem('sess');

window.SOCKETS = []

const CACHE = new Map();

function loadLevels() {
    for (const level in LEVELS) {
        const lvl = level.match(/level_(\d+)$/)[1];
        const option = document.createElement('option');
        if (lvl == CURRENT_LEVEL) option.selected = true;
        option.innerHTML = lvl;
        levelSelect.appendChild(option);
    }
}

loadLevels();


apikeyInput.onchange = () => {
    localStorage.setItem('sess', apikeyInput.value);
}

levelSelect.onchange = function (e) {
    CURRENT_LEVEL = parseInt(this.value);
    localStorage.setItem('last_level', `${CURRENT_LEVEL}`);
    loadTemplate();
    loadPrompt();
};

revisionSelect.onchange = function (e) {
    loadPrompt(this.value);
}

runButton.onclick = () => {
    tryLevels();
}

run66Button.onclick = () => {
    tryLevels(1);
}

runPaddedButton.onclick = () => {
    tryLevels(0, ' ');
}


saveButton.onclick = () => {
    savePrompt();
}

removeButton.onclick = () => {
    removePrompt();
}

generateButton.onclick = () => {
    generateSubmission();
}

submitButton.onclick = () => {
    openSubmitPage();
}

resetButton.onclick = () => {
    loadPrompt();
}

clearHistoryButton.onclick = () => {
    localStorage.removeItem('history');
    historyEl.textContent = '';
}
clearOutputButton.onclick = () => {
    outputEl.textContent = '';
}

inputTextarea.oninput = inputTextarea.onchange = inputTextarea.onpaste = () => {
    refreshPrompt();
}

let last_input = '';
let refreshInterval = null;

translationApi.onchange = () => {
    if (translationApi.checked) {
        inputTextarea.oninput = inputTextarea.onchange = inputTextarea.onpaste = null;
        refreshInterval = setInterval(() => {
            if (inputTextarea.value != last_input) {
                last_input = inputTextarea.value;
                refreshPrompt();
            }
        }, 1000);
    } else {
        inputTextarea.oninput = inputTextarea.onchange = inputTextarea.onpaste = () => {
            refreshPrompt();
        }
        clearInterval(refreshInterval);
    }
}

runsInput.onchange = runsInput.oninput = replaceBanned.onchange = replaceAll.onchange = () => {
    refreshPrompt();
}

fetchSubmissions();
setInterval(fetchSubmissions, 60 * 1000);
updateHistory();

function fetchSubmissions() {
    return fetch('/data/submissions.json', { cache: 'no-store' }).then(e => e.json()).then(updateSubmissions);
}

function getjson(name) {
    return JSON.parse(localStorage.getItem(name));
}
function setjson(name, obj) {
    localStorage.setItem(name, JSON.stringify(obj));
}

async function replaceAsync(str) {
    const promises = [];
    str.replace(/@@(.*?)@@/gi, (_, match, ...args) => {
        const promise = translate(match);
        promises.push(promise);
    });
    const data = await Promise.all(promises);
    return str.replace(/@@(.*?)@@/gi, () => data.shift());
}

async function getInput(padding) {
    // inputTextarea.readOnly=true;
    let prompt = inputTextarea.value;
    const curr_level = LEVELS[`level_${CURRENT_LEVEL}`];
    let rawprompt = prompt;
    if (translationApi.checked) {
        prompt = await replaceAsync(prompt);
    }
    
    if(replaceAll.checked){
        prompt = curr_level.replaceAll(prompt);
        // rawprompt = curr_level.replaceAll(rawprompt);
    }else
    if (replaceBanned.checked) {
        prompt = curr_level.replaceBanned(prompt);
        // rawprompt = curr_level.replaceAll(rawprompt);
    }

    if(padding){
        const msg = curr_level.template(prompt);
        const msgTokens = await getTokens(msg);
        // prompt = prompt + padding.repeat(4097 - msgTokens - 6 - 8);
        prompt = prompt.replace('$$', padding.repeat(2*(4097 - msgTokens - 6 - 8)));

        const _msg = curr_level.template(prompt);;
        const _msgTokens = await getTokens(_msg);
    }
    
    // inputTextarea.readOnly=false;
    return [prompt, rawprompt];
    // return curr_level.getPrompt(prompt, timeout);
}

function loadRevisions(revision) {
    revisionSelect.textContent = '';
    const submissions = getjson('submissions') || [];
    const tmp_submission = getjson('tmp_submission') || {};
    const lv = `level_${CURRENT_LEVEL}`;

    if (tmp_submission[lv]?.prompt) {
        const option = document.createElement('option');
        option.innerHTML = 'Revision#local';
        option.value = 'local';
        revisionSelect.appendChild(option);
        if (revision == 'local') {
            option.selected = true;
        }
    }
    let last_revision = null;
    for (let i = submissions.length - 1; i >= 0; i--) {
        if (!submissions[i][lv]?.prompt) continue;
        if (last_revision == submissions[i][lv].prompt) continue;
        last_revision = submissions[i][lv].prompt;
        const option = document.createElement('option');
        if (i == revision) {
            option.selected = true;
        }
        option.innerHTML = `Revision#${i}`;
        option.value = i;
        revisionSelect.appendChild(option);
    }
    if (revision === undefined && revisionSelect.options[0]) {
        revisionSelect.options[0].selected = true;
    }
}

function loadPrompt(revision) {
    loadRevisions(revision);
    if (CURRENT_LEVEL == 6) {
        run66Button.classList.remove('hidden');
    } else {
        run66Button.classList.add('hidden');
    }
    const tmp_submission = getjson('tmp_submission') || {};
    let prompt;
    const lv = `level_${CURRENT_LEVEL}`;
    const json = getjson('submissions');

    const selected_revision = revisionSelect.value;

    if (tmp_submission[lv]?.prompt && selected_revision == 'local') {
        prompt = tmp_submission[lv].raw || tmp_submission[lv].prompt;
        removeButton.disabled = false;
    } else {
        prompt = json?.[selected_revision]?.[lv]?.prompt || '';
        removeButton.disabled = true;
    }

    inputTextarea.value = prompt;
    refreshPrompt();
}

async function savePrompt() {
    const lv = `level_${CURRENT_LEVEL}`;
    const prompt = (await getInput())[0];
    const tmp_submission = getjson('tmp_submission') || {};
    if (!tmp_submission[lv]) {
        tmp_submission[lv] = {}
    }

    tmp_submission[lv].prompt = prompt;
    tmp_submission[lv].raw = inputTextarea.value;
    tmp_submission[lv].model = "gpt-3.5-turbo";

    setjson('tmp_submission', tmp_submission)
    loadPrompt();
}

function removePrompt() {
    const lv = `level_${CURRENT_LEVEL}`;
    const tmp_submission = getjson('tmp_submission') || {};
    tmp_submission[lv] = {
        "prompt": "",
        "model": ""
    }
    setjson('tmp_submission', tmp_submission);
    loadPrompt();
}

function updateSubmissions(json) {
    const old_json = getjson('submissions') || [];
    if (json.length > old_json.length) {
        if (confirm("New submission file available, update?")) {
            setjson('submissions', json);
            loadPrompt();
            return true;
        }
    }
    return false;
}

async function tryLevels(deep = 0, padding) {
    // outputEl.textContent = '';
    const level = CURRENT_LEVEL;
    const [prompt, rawprompt] = (await getInput(padding));

    const historyResults = isInHistory(prompt, level);

    if (historyResults){
        if(!window.confirm(`You already ran the prompt. Run again?\nPast results:\n${historyResults.join('\n\n')}`)) {
            return
        }
    }else{
        const sharedHistoryResults = await isInSharedHistory(prompt, level);
        if(sharedHistoryResults && !window.confirm(`Someone already ran the prompt. Run again?\nPast results:\n${sharedHistoryResults.join('\n\n')}`)){
            return;
        }
    }
    

    const runs = parseInt(runsInput.value);
    for (let i = 0; i < runs; i++) {
        deep ? tryLevelDeep(i, prompt, level) : tryLevel(i, prompt, level, rawprompt);
    }
}

async function tryLevelDeep(run, prompt, level) {
    if (level != 6) return;

    console.log(prompt);

    const onResult = new Promise(async resolve => {

        const token = apikeyInput.value;
        const lvl1 = LEVELS[`level_6`];
        const lvl2 = LEVELS[`level_66`];
        const expected = lvl2.expected;
        const msg1 = lvl1.template(prompt);
        const res1 = await apiCall(msg1, token, 1024);
        const tokens = await getTokens(prompt);
        const response1 = res1.choices[0].message.content;
        const msg2 = lvl2.template(response1);
        const res2 = await apiCall(msg2, token, 30);
        const response2 = res2.choices[0].message.content;



        if(!res2.error){
            sendMsg({
                type: 'history_update',
                prompt,
                output: response2,
                level
            });
        }

        const div = document.createElement('div');

        const pre_output = document.createElement('span');
        pre_output.innerHTML = `Run#${run}: (<span>${tokens}</span>): `;
    
        div.appendChild(pre_output);
    
        const output1 = document.createElement('p');
        output1.innerText = response1;
    
        div.appendChild(output1);
    
        const output2 = document.createElement('p');
        output2.innerText = response2;
        output2.classList.add(response2 == expected ? 'output-ok' : 'output-bad');
    
        div.appendChild(output2)

        addToHistory([prompt, div.innerHTML, level]);
        
        resolve(div.innerHTML);

    });
    
    const div = createOutputEntry(prompt, '', level, run, onResult);
    outputEl.prepend(div);
    return onResult;
}


async function tryLevel(run, prompt, level, rawprompt) {

    // const level = CURRENT_LEVEL;
    level = parseInt(level)
    const curr_level = LEVELS[`level_${level}`];
    const token = apikeyInput.value;
    
    let max_tokens = 30;
    if (level == 6) max_tokens = 100;
    if (level == 999) max_tokens = 200;
    if ([9, 91, 92].includes(level)) {
        max_tokens = -1;
    }
    
    // const prompt = await getInput(padding);
    const msg = curr_level.template(prompt);
    const expected = curr_level.expected;

    let response, tokens;

    const promptmsg = rawprompt !== prompt ? `${prompt}\n-------------------\n${rawprompt}\n---------------------\n` : prompt;
    const onResult = new Promise(async resolve => {
        const res = await apiCall(msg, token, max_tokens);
        response = res.choices[0].message.content;
        tokens = await getTokens(curr_level.getPrompt(prompt));
        const alltokens = res.usage.total_tokens;
        if(!res.error && level > 0 && level < 11 && level != 6){
                sendMsg({
                type: 'history_update',
                prompt,
                output: response,
                level
            });
        }

        const div = document.createElement('div');

        let expectedStr = level == 2 ? `(${expected}): ` : '';
        const pre_output = document.createElement('span');
        pre_output.innerHTML = `Run#${run}: (<span>input: ${tokens}, all: ${alltokens}</span>): ${expectedStr}`;

        const output = document.createElement('span');
        output.innerText = response ;
        output.classList.add(response == expected ? 'output-ok' : 'output-bad');

        div.appendChild(pre_output);
        div.appendChild(output);
        if(!res.error){
            addToHistory([promptmsg, div.innerHTML, level]);
        }
            
        resolve(div.innerHTML);
        // if(response == expected) {
        //     alert('Found it!');
        // }

    });

    const div = createOutputEntry(promptmsg, '', level, run, onResult);
    outputEl.prepend(div);
    return onResult;
    // outputEl.append(div);
}

function createOutputEntry(msg, htmlresp, level, run, resultPromise) {
    const div = document.createElement('div');
    if (resultPromise) {
        div.classList.add('pending');
    }
    const runStr = run !== undefined ? ` <span>Run#${run}</span>` : '';
    div.innerHTML = `<span>Level_${level}</span>${runStr}`;
    const pmsg = document.createElement('p');
    pmsg.classList.add('msg');
    pmsg.innerText = msg;
    div.appendChild(pmsg);
    const div2 = document.createElement('div2');
    div2.innerHTML = htmlresp;
    div.appendChild(div2);
    div.insertAdjacentHTML('beforeend', '<hr>');
    if (resultPromise) {
        resultPromise.then(resp => {
            div.classList.remove('pending');
            div2.innerHTML = resp;
        })
    }
    return div;
}

function isInHistory(prompt, level) {
    const history = getjson('history') || [];
    const results = new Set();

    for (let [_prompt, html, _level] of history) {
        if (prompt == _prompt && _level == level) {
            html = html.replace(/Run#\d+/g, 'Run#[N]');
            html = html.replaceAll(' (chatgpt)', '');
            results.add(html);
        }
    }
    if (results.size) {
        return Array.from(results);
    }
    return false;
}

function deduplicateHistory() {
    const history = getjson('history') || [];
    const dict = new Set();
    const sep = '$0923478912$';
    for (let [prompt, html, level] of history) {
        html = html.replace(/Run#\d+/g, 'Run#[N]');
        html = html.replaceAll(' (chatgpt)', '');
        dict.add([prompt, html, level].join(sep))
    }
    newHistory = Array.from(dict).map(e => e.split(sep));
    setjson('history', newHistory);
}

function addToHistory(entry) {
    const history = getjson('history') || [];
    history.push(entry);
    setjson('history', history);
    updateHistory();
    refreshPrompt();
}

function updateHistory() {
    deduplicateHistory();
    const history = getjson('history') || [];
    historyEl.textContent = '';
    for (const [msg, htmlresp, level] of history.reverse()) {
        const div = document.createElement('div');
        div.innerHTML = `<span>Level_${level}</span>`;
        const pmsg = document.createElement('p');
        pmsg.classList.add('msg');
        pmsg.innerText = msg;
        div.appendChild(pmsg)
        div.insertAdjacentHTML('beforeend', htmlresp);
        div.insertAdjacentHTML('beforeend', '<hr>');
        historyEl.appendChild(div);
    }
}

function loadTemplate() {
    const curr_level = LEVELS[`level_${CURRENT_LEVEL}`];
    const expected = CURRENT_LEVEL == 2 ? '{$SECRET_KEY}' : curr_level.expected;
    expectedInput.value = expected;
    templateEl.innerText = curr_level.template_raw;
    templateEl.innerHTML = templateEl.innerHTML.replace('{YOUR PROMPT}', `<strong id="prompt">{YOUR PROMPT}</strong>`);
}

let currentRefreshId = -1;
async function refreshPrompt() {
    currentRefreshId+=1;
    const refreshId = currentRefreshId;

    const level = CURRENT_LEVEL;
    const curr_level = LEVELS[`level_${level}`];
    const prompt = (await getInput())[0]; // = curr_level.replaceBanned(inputTextarea.value);
    if (refreshId !== currentRefreshId)
        return;
    if (!prompt) {
        $('#prompt').innerText = '{YOUR PROMPT}';
        return;
    }

    const histResults = isInHistory(prompt, level);
    historyOutput.textContent = '';
    if(histResults){
        historyOutput.innerHTML += histResults.join('\n');
        if(histResults.some(e=>e.includes('"output-ok"'))){
            inputTextarea.classList.add('good');
        }
        inputTextarea.classList.add('inHistory');
    }else{
        inputTextarea.className = '';
    }

    const responses = await isInSharedHistory(prompt, level);

    if (refreshId !== currentRefreshId)
        return;

    if(responses){
        if(!historyOutput.innerHTML) {
            historyOutput.innerHTML += "<hr>" + responses.join('\n');
        }
        if(responses.some(e=>e==curr_level.expected)){
            inputTextarea.classList.add('good');
        }
        inputTextarea.classList.add('inHistory');
    }

    const f_prompt = curr_level.getPrompt(prompt);
    $('#prompt').innerText = f_prompt;
    const tokens = await getTokens(f_prompt);

    if (refreshId !== currentRefreshId)
        return;

    tokensInput.value = tokens;

    const msg = LEVELS[`level_${CURRENT_LEVEL}`].template(prompt)
    const runs = runsInput.value;
    const tokensMsg = await getTokens(msg);

    if (refreshId !== currentRefreshId)
        return;

    const cost = (Number(tokensMsg) * Number(runs) * 0.002) / 1000;

    ptokensInput.value = `$${cost.toFixed(4)}`;
}

loadTemplate();
loadPrompt();

async function getTokens(msg) {
    const resp = await sendMsg({
        type: 'get_tokens',
        prompt: msg
    });
    return resp;
}

async function apiCall(msg, token = apikeyInput.value, max_tokens, maxErrors = 0) {
    let real_token = token;
    if(max_tokens == -1) max_tokens = undefined;
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        "headers": {
            "authorization": `Bearer ${real_token}`,
            "cache-control": "no-cache",
            "content-type": "application/json",
        },
        "body": JSON.stringify(
            {
                max_tokens,
                messages: [{
                    role: 'user',
                    content: msg
                }],
                model: "gpt-3.5-turbo",
                stream: false,
                temperature: 0,
            }
        ),
        "method": "POST",
        "mode": "cors",
        "credentials": "omit"
    }).then(e => e.json());

    if (res.error) {
        return {
            error: true,
            choices: [
                {
                    message: {
                        content: res.error.message
                    }
                }
            ]
        }
    }
    return res;

}

async function generateSubmissionData() {
    const changed = await fetchSubmissions();
    const submissions = getjson('submissions') || [];
    const tmp_submission = getjson('tmp_submission') || {};

    const last_submission = submissions[submissions.length - 1] || {};
    const previous_submission = submissions[submissions.length - 2] || {};

    const updatedLevels = [];

    for (const key in tmp_submission) {
        // if(key == 'level_9') continue;
        if (key == 'level_999') continue;
        const prompt = tmp_submission[key].prompt;
        if (!last_submission[key]) last_submission[key] = {};
        const lastsub = last_submission[key];
        if (prompt) {
            if (changed && lastsub.prompt !== previous_submission[key]?.prompt) {
                alert(`Skipping ${key}: You have a conflict with updated submission`);
                continue;
            }
            if (lastsub.prompt && lastsub.prompt.model == 'gpt-3.5-turbo') {
                const tokensNew = await getTokens(prompt);
                const tokensOld = await getTokens(lastsub.prompt);
                if (tokensNew > tokensOld) {
                    alert(`Skipping ${key}: Submitted payload has less tokens.`);
                    continue;
                }
            }

            if (lastsub.prompt == prompt) {
                continue;
            }
            if (!confirm(`Want to replace ${key}?`)) continue;
            updatedLevels.push(key)
            lastsub.prompt = prompt;
            lastsub.model = tmp_submission[key].model;
        }
    }

    alert(`New: ${updatedLevels}`);
    return last_submission;
}

async function generateSubmission() {
    const last_submission = await generateSubmissionData();
    const blob = new Blob([JSON.stringify(last_submission, null, 4)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'submission.json';
    a.click();
}

const TRANSLATION_URL = 'https://terjanq-me.translate.goog/translate-v1.html?_x_tr_sl=en&_x_tr_tl=zh-CN&_x_tr_hl=en&_x_tr_pto=wapp'

let translationWindow = null;
let trasnlateWindowOpened = null;

async function translate(msg) {
    trasnlateWindowOpened === null || await trasnlateWindowOpened;
    try {
        translationWindow.tiframe.location;
    } catch (e) {
        trasnlateWindowOpened = new Promise(resolve => {
            window.onmessage = e => {
                if(e.data == 'loaded'){
                    setTimeout(resolve, 1000);
                }
            }
        });
        translationWindow = open(TRANSLATION_URL, 'translationwindow');
        await trasnlateWindowOpened;
    }
    return new Promise(resolve => {
        const c = new MessageChannel();
        c.port1.onmessage = e => {
            if (e.data.error) {
                alert(e.data.error);
            }
            if (e.data.tr) {
                resolve(e.data.tr);
            }
        }
        translationWindow.postMessage({ tr: msg }, '*', [c.port2]);
    });

}

async function closeSocket(idx){
    return new Promise(resolve => {
        SOCKETS[idx].onclose = () => {
            const res =  delete SOCKETS[idx];
            if(res === false){
                console.error(`Failed to release socket#${idx}0`);
            }
            resolve();
        }
        SOCKETS[idx].close();
    }); 
}

async function sendMsg(json){
    json.pswd = WS_PASSWORD;
    json.model = 'gpt-3.5-turbo'
    const msg = JSON.stringify(json);
    if (CACHE.has(msg)) return CACHE.get(msg);
    return new Promise((resolve, reject) => {
        const idx = SOCKETS.push(new WebSocket(WS_SERVER)) - 1;
        SOCKETS[idx].onopen = () => { SOCKETS[idx].send(msg) }
        SOCKETS[idx].onmessage = async e => {
            const response = JSON.parse(e.data)
            closeSocket(idx);
           
            if(response?.err){
                console.error(response.err)
                reject(response);
                return;
            }
            resolve(response);
            
            if(
                (json.type == 'get_responses' && response.length) ||
                (json.type == 'get_tokens')
             ){
                CACHE.set(msg, response);
             } 
            
        }
    });
}

async function openSubmitPage(msg) {
  window.submitPageData = await generateSubmissionData();
  open('submit.html', 'submitwindow');
}

async function isInSharedHistory(prompt, level) {
    level = parseInt(level)
    if(level < 1 || level >10) return false;
    const resp = await sendMsg({
        type: 'get_responses',
        level,
        prompt
    });
    if(resp.length == 0) return false;
    return resp
}
