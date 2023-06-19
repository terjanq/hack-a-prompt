const $ = e => document.querySelector(e);
const $$ = e => document.querySelectorAll(e);

const runButton = $('#run');
// const run66Button = $('#run66');
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
const resetButton = $('#reset');
const historyEl = $('#history');
const tokensInput = $('#tokens');
const scoreInput = $('#score');
const newScoreInput = $('#newScore');
// const ptokensInput = $('#ptokens');
const clearHistoryButton = $('#clearHistory');
const clearOutputButton = $('#clearOutput');
const historyOutput = $('#historyOutput');

window.SOCKETS = []

let CURRENT_LEVEL = localStorage.getItem('last_level_flan') || 6;

const CACHE = new Map();

let SHARED_HISTORY = [];

function loadLevels() {
    for (const level in LEVELS) {
        const lvl = level.match(/level_(\d+)$/)[1];
        if (parseInt(lvl) > 10) continue;
        const option = document.createElement('option');
        if (lvl == CURRENT_LEVEL) option.selected = true;
        option.innerHTML = lvl;
        levelSelect.appendChild(option);
    }
}

loadLevels();

levelSelect.onchange = function (e) {
    CURRENT_LEVEL = this.value;
    localStorage.setItem('last_level_flan', `${CURRENT_LEVEL}`);
    loadTemplate();
    loadPrompt();
};

revisionSelect.onchange = function (e) {
    loadPrompt(this.value);
}

runButton.onclick = () => {
    tryLevels();
}

// run66Button.onclick = () => {
//     tryLevels('chatgpt', 1);
// }

saveButton.onclick = () => {
    savePrompt();
}

removeButton.onclick = () => {
    removePrompt();
}

generateButton.onclick = () => {
    generateSubmission();
}

resetButton.onclick = () => {
    loadPrompt();
}

clearHistoryButton.onclick = () => {
    localStorage.removeItem('history_flan');
    historyEl.textContent = '';
}
clearOutputButton.onclick = () => {
    outputEl.textContent = '';
}

runsInput.onchange = runsInput.oninput = () => {
    refreshPrompt(++currentRefreshId);
}

fetchSubmissions();
setInterval(() => {
    fetchSubmissions();
}, 60 * 1000);
updateHistory();

function fetchSubmissions() {
    return fetch('/data/submissions_flan.json', { cache: 'no-store' }).then(e => e.json()).then(updateSubmissions);
}

function getjson(name) {
    return JSON.parse(localStorage.getItem(name));
}
function setjson(name, obj) {
    localStorage.setItem(name, JSON.stringify(obj));
}

function loadRevisions(revision) {
    revisionSelect.textContent = '';
    const submissions = getjson('submissions_flan') || [];
    const tmp_submission = getjson('tmp_submission_flan') || {};
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
    // if(CURRENT_LEVEL == 6) {
    //     run66Button.classList.remove('hidden');
    // }else{
    //     run66Button.classList.add('hidden');
    // }
    const tmp_submission = getjson('tmp_submission_flan') || {};
    let prompt;
    const lv = `level_${CURRENT_LEVEL}`;
    const json = getjson('submissions_flan');

    const selected_revision = revisionSelect.value;

    let tmp_prompt = tmp_submission[lv]?.prompt;
    if (tmp_prompt && tmp_prompt == json[json.length - 1][lv]?.prompt) {
        removePrompt();
        tmp_prompt = undefined;
    }
    if (tmp_prompt && selected_revision == 'local') {
        prompt = tmp_prompt;
        removeButton.disabled = false;
    } else {
        prompt = json?.[selected_revision]?.[lv]?.prompt || '';
        removeButton.disabled = true;
    }

    inputTextarea.value = prompt;
    refreshPrompt(++currentRefreshId);
}

async function savePrompt() {
    const lv = `level_${CURRENT_LEVEL}`;
    const prompt = inputTextarea.value;
    const tmp_submission = getjson('tmp_submission_flan') || {};
    if (!tmp_submission[lv]) {
        tmp_submission[lv] = {}
    }

    tmp_submission[lv].prompt = prompt;
    tmp_submission[lv].model = "FlanT5-XXL";
    const tokens = await getTokens(LEVELS[lv].getPrompt(prompt));
    tmp_submission[lv].tokens = tokens;

    console.log(prompt, tokens);
    setjson('tmp_submission_flan', tmp_submission)
    loadPrompt();
}

function removePrompt() {
    const lv = `level_${CURRENT_LEVEL}`;
    const tmp_submission = getjson('tmp_submission_flan') || {};
    tmp_submission[lv] = {};
    setjson('tmp_submission_flan', tmp_submission);
    loadPrompt();
}

function updateSubmissions(json) {
    const old_json = getjson('submissions_flan') || [];
    if (json.length > old_json.length) {
        if (confirm("New submission file available, update?")) {
            setjson('submissions_flan', json);
            loadPrompt();
            return true;
        }
    }
    return false;
}

async function tryLevels() {
    // outputEl.textContent = '';
    const prompt = inputTextarea.value;
    const level = CURRENT_LEVEL
    let historyResults = isInHistory(prompt, level);
    
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
        tryLevel(i);
    }
}


async function tryLevel(run, _prompt, _level) {

    const level = _level || CURRENT_LEVEL;
    const prompt = _prompt || inputTextarea.value;

    let response, tokens;

    const onResult = new Promise(async resolve => {
        const res = await flanCall(prompt, parseInt(level));
        response = res.response;
        tokens = res.tokens;
        sendMsg({
            type: 'history_update',
            prompt,
            output: response,
            level
        });
        const fullmsg = res.fullmsg;
        let second_prompt = '';
        if (level == 6) {
            second_prompt = '\n-----------------\n' + fullmsg.split('---SECOND PROMPT BELOW---\n\n\n')[1]
        }
        const expected = res.expected;

        const div = document.createElement('div');

        let expectedStr = level == 2 ? `(${expected}): ` : '';
        const pre_output = document.createElement('span');
        pre_output.innerHTML = `Run#${run}: (<span>${tokens}</span>): ${expectedStr}`;

        const output = document.createElement('span');
        output.innerText = response + second_prompt;
        output.classList.add(response == expected ? 'output-ok' : 'output-bad');

        div.appendChild(pre_output);
        div.appendChild(output);
        addToHistory([prompt, div.innerHTML, level]);
        
        resolve(div.innerHTML);
        if(response == expected) {
            alert('Found it!');
        }
    });

    const div = createOutputEntry(prompt, '', level, run, onResult);
    outputEl.prepend(div);
    return onResult;
    // outputEl.append(div);
}

function deduplicateHistory() {
    const history = getjson('history_flan') || [];
    const dict = new Set();
    const sep = '$0923478912$';
    for (let [prompt, html, level] of history) {
        html = html.replace(/Run#\d+/g, 'Run#[N]');
        dict.add([prompt, html, level].join(sep))
    }
    newHistory = Array.from(dict).map(e => e.split(sep));
    setjson('history_flan', newHistory);
}

function addToHistory(entry) {
    const history = getjson('history_flan') || [];
    history.push(entry);
    setjson('history_flan', history);
    updateHistory();
    refreshPrompt(++currentRefreshId);
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
    const history = getjson('history_flan') || [];
    const results = new Set();
    for (let [_prompt, html, _level] of history) {
        if (prompt == _prompt && _level == level) {
            html = html.replace(/Run#\d+/g, 'Run#[N]');
            results.add(html);
        }
    }
    if (results.size) {
        return Array.from(results);
    }
    return false;
}

async function isInSharedHistory(prompt, level) {
    const resp = await sendMsg({
        type: 'get_responses',
        level,
        prompt
    });
    if(resp.length == 0) return false;
    return resp;
}

function updateHistory() {
    deduplicateHistory();
    const history = getjson('history_flan') || [];

    historyEl.textContent = '';
    for (const [msg, htmlresp, level] of history.reverse()) {
        const div = createOutputEntry(msg, htmlresp, level);
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

async function refreshPrompt(refreshId) {
    const level = CURRENT_LEVEL;
    const curr_level = LEVELS[`level_${level}`];
    const prompt = inputTextarea.value = curr_level.replaceBanned(inputTextarea.value);
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

    const p = curr_level.getPrompt(prompt)
    $('#prompt').innerText = p;
    const tokens = await getTokens(p);

    if (refreshId !== currentRefreshId)
        return;

    tokensInput.value = tokens;

    const [score, newScore] = calculate_score();
    scoreInput.value = score;
    newScoreInput.value = newScore;

}

loadTemplate();
loadPrompt();

inputTextarea.oninput = inputTextarea.onchange = inputTextarea.onpaste = () => {
    refreshPrompt(++currentRefreshId);
}

async function closeSocket(idx){
    return new Promise(resolve => {
        SOCKETS[idx].onclose = () => {
            const res =  delete SOCKETS[idx];
            if(res === false){
                console.error(`Failed to release socket#${idx}0`);
            }
            // else{
            //     console.log(`Released socket#${idx}`);
            // }
            resolve();
        }
        SOCKETS[idx].close();
    }); 
}

const sleep = d => new Promise(resolve => setTimeout(resolve, d));

async function sendMsg(json){
    json.pswd = WS_PASSWORD;
    json.model = 'flan'
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

async function getTokens(msg) {
    const resp = await sendMsg({
        type: 'get_tokens',
        prompt: msg
    });
    return resp;
}

let last_queue = '';

async function flanCall(msg, level) {
    return new Promise(resolve => {

        const SESSION_HASH = Math.random().toString(36).slice(2, 12);
        const idx = SOCKETS.push(new WebSocket('wss://jerpint-org-hackaprompt.hf.space/queue/join')) - 1;
        let fn_index = 1;
        function send(o) {
            o.fn_index = 8;
            o.session_hash = SESSION_HASH;
            SOCKETS[idx].send(JSON.stringify(o));
        }
        async function process(e) {
            const resp = JSON.parse(e.data);
            if(resp.queue_size && resp.rank){
                const _l = `queue: ${resp.rank}/${resp.queue_size}`;
                if(_l != last_queue){
                    console.log(_l);
                    last_queue = _l;
                }
                
            }
            if (resp?.msg == 'send_hash') {
                send({});
            }
            if (resp?.msg == 'send_data') {
                send({ "data": [msg, level, "FlanT5-XXL", null, "", null, null], "event_data": null })
            }
            if (resp?.output && resp?.output.data) {
                closeSocket(idx)
                
                if(resp.output.data?.length >= 5){
                    const [response, result, tokens, fullmsg, expected] = resp.output.data
                    resolve({
                        fullmsg,
                        result,
                        tokens,
                        response,
                        expected,
                        level
                    });
                }
            }
        }
        SOCKETS[idx].onmessage = process;
    });
}

async function generateSubmission() {
    const changed = await fetchSubmissions();
    const submissions = getjson('submissions_flan') || [];
    const tmp_submission = getjson('tmp_submission_flan') || {};

    const last_submission = submissions[submissions.length - 1] || {};
    const previous_submission = submissions[submissions.length - 2] || {};

    const updatedLevels = [];

    for (const key in tmp_submission) {
        if (key == 'level_999') continue;
        const prompt = tmp_submission[key].prompt;
        if (!last_submission[key]) last_submission[key] = {};
        const lastsub = last_submission[key];
        if (prompt) {
            const tokensNew = tmp_submission[key].tokens;
            const tokensOld = last_submission[key].tokens;

            if (changed && lastsub.prompt !== previous_submission[key]?.prompt) {
                alert(`Skipping ${key}: You have a conflict with updated submission`);
                continue;
            }

            if (lastsub.prompt && (tokensNew > tokensOld)) {
                alert(`Skipping ${key}: Local payload has more tokens.`);
                continue;
            }
            if (lastsub.prompt == prompt) {
                continue;
            }
            if (!confirm(`Want to replace ${key}?`)) continue;
            updatedLevels.push(key)
            lastsub.prompt = prompt;
            lastsub.model = 'FlanT5-XXL';
            lastsub.tokens = tokensNew;
        }
    }

    alert(`New: ${updatedLevels}`);

    const blob = new Blob([JSON.stringify(last_submission, null, 4)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'flan_submission.json';
    a.click();
}

function calculate_score() {
    const s = (getjson('submissions_flan') || []).splice(-1)[0];
    const t = (getjson('tmp_submission_flan') || {});
    let score = 0;
    let newScore = 0;

    for (let l = 1; l <= 10; l++) {
        const key = `level_${l}`;
        const oldTokens = s[key]?.tokens;
        const newTokens = t[key]?.tokens;
        if (newTokens && oldTokens >= newTokens) {
            newScore += l * (10000 - newTokens);
        } else {
            if (oldTokens) newScore += l * (10000 - oldTokens)
        }
        if (oldTokens) score += l * (10000 - oldTokens)

    }

    return [score, newScore]
}



async function runPrompts(level, n=10, min=5, max=7, checkHistory=false, regex){
    let payloads = await sendMsg({type: 'get_unique_prompts', level, min, max})
    if(regex){
        payloads = payloads.filter(e=>regex.test(e));
    }
    console.log(payloads);
    return runPayloads(payloads, level, n, checkHistory);
}

async function runPayloads(payloads, level, n, checkHistory){
    if(Array.isArray(payloads[0])){
        payloads = payloads.sort((a,b) => a[0] - b[0]).map(e=>e[1])
    }

    payloads = payloads.reverse();
    const N = payloads.length;
    const _N = N - N % 20;
    
    
    async function tryNext(){
        if(!payloads.length) return;
        const payload = payloads.pop()
        if(payload && (!checkHistory ||  !(await isInSharedHistory(payload, level)))){
            await tryLevel(0, payload, level)
        }
        const _n = payloads.length;
        const p = 100 - (_n * 100 / _N);
        if( _n == 0){
            console.log(`progress: 100%`);
        }else
        if( p % 5 == 0 && p < 100) console.log(`progress: ${p}%`);

        setTimeout(tryNext, 0);
    }

    for(let i = 0; i< n; i++){
        tryNext()
    }
}
