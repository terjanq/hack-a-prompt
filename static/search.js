const $ = e => document.querySelector(e);
const $$ = e => document.querySelectorAll(e);

function sortByKeys(obj, ...keys) {
    return obj.sort((x, y) => {
        for (const key of keys) {
            if (typeof x[key] == 'string') {
                const cmp = x[key].localeCompare(y[key]);
                if (cmp !== 0) {
                    return cmp
                }
            } else {
                if (x[key] < y[key]) return -1
                if (x[key] > y[key]) return 1
            }
        }
        return 0
    });
}

const levelInput = document.forms[0].level;

for (let i = 1; i < 11; i++) {
    const option = document.createElement('option');
    option.innerText = i;
    levelInput.appendChild(option);
}

function fetchModel(model) {
    return fetch(`/data/shared_unique_${model}.json`).then(e => e.json()).then(_results => {
        const completions = {}
        const prompts = {}


        for (const lv in _results) {
            for (const checksum in _results[lv]) {
                const row = _results[lv][checksum];
                for (const response of row.responses) {
                    if (!response) continue;
                    if (!completions[lv]) completions[lv] = {}
                    if (!completions[lv][response]) completions[lv][response] = []

                    completions[lv][response].push({
                        prompt: row.prompt,
                        tokens: row.tokens,
                        level: lv,
                    });

                    const prompt = row.prompt;
                    if (!prompt) continue;
                    if (!prompts[lv]) prompts[lv] = {}
                    if (!prompts[lv][prompt]) prompts[lv][prompt] = {
                        responses: new Set(),
                        tokens: row.tokens,
                        level: lv
                    }

                    prompts[lv][prompt].responses.add(response)
                }
            }
        }

        for (const lv in completions) {
            for (const response in completions[lv]) {
                sortByKeys(completions[lv][response], 'level', 'tokens', 'prompt');
            }

            for (const prompt in prompts[lv]) {
                prompts[lv][prompt].responses = Array.from(prompts[lv][prompt].responses).sort((a, b) => a.localeCompare(b))
            }
        }


        window.onhashchange();
        return [completions, prompts];
    });
}

const fetchedResults = {
    gpt: fetchModel('gpt'),
    flan: fetchModel('flan')
}

let refreshId = 0;

function refreshData() {
    refreshId++;
    fetchedResults.gpt = fetchModel('gpt')
    fetchedResults.flan = fetchModel('flan')
}


async function getCompletionResults(level, negate, regex, model) {

    const [results, _] = await fetchedResults[model];
    let toSearch = []
    if (level > 0 && level <= 10) {
        toSearch.push(...Object.entries(results[level]))
    } else {
        for (const lv in results) {
            toSearch.push(...Object.entries(results[lv]))
        }
    }


    toSearch = toSearch.filter(e => negate ^ regex.test(e[0]));
    toSearch = toSearch.map(e=>[...e[1]].map(f=>({...f, completion: e[0]}))).flat()
    sortByKeys(toSearch, 'level', 'tokens', 'completion', 'prompt')
    return toSearch
}

async function getPromptResults(level, negate, regex, model) {
    const [_, prompts] = await fetchedResults[model];
    let toSearch = []
    if (level > 0 && level <= 10) {
        toSearch.push(...Object.entries(prompts[level]))
    } else {
        for (const lv in prompts) {
            toSearch.push(...Object.entries(prompts[lv]))
        }
    }

    toSearch = toSearch.filter(e => negate ^ regex.test(e[0])).map(e => ({ prompt: e[0], ...e[1] }))
    sortByKeys(toSearch, 'level', 'tokens', 'prompt')
    return toSearch;
}

let last_processed = "";

const makeHash = (...keys) => keys.join('|€|');

function getCurrentValues() {
    const form = document.forms[0];
    return [form.model.value, form.regex.value, form.searchType.value, form.negate.checked, form.level.value, form.regexFlags.value]
}

function setCurrentValues(model, regex, type, negate, level, flags) {
    const form = document.forms[0];
    if (regex) {
        form.regex.value = regex;
    }
    if (type) {
        form.searchType.value = type
    }
    if (negate) {
        form.negate.checked = negate === "true"
    }
    if (level) {
        form.level.value = level
    }
    if (flags) {
        form.regexFlags.value = flags
    }
    if (model) {
        form.model.value = model
    }
}

function createRow(...values) {
    const tr = document.createElement('tr');
    for (const [value, type] of values) {
        const td = document.createElement('td');
        const pre = document.createElement('pre');
        td.appendChild(pre);
        if (type == 'html') {
            pre.innerHTML = value;
        } else {
            pre.innerText = value;
        }
        tr.appendChild(td);
    }
    return tr;
}

async function processor() {
    try {
        const [model, regexStr, type, negate, level, flags] = getCurrentValues()
        const currentProcess = makeHash(...getCurrentValues(), refreshId)

        const regex = new RegExp(regexStr, flags);

        if (last_processed != currentProcess) {
            $('#output').textContent = '';
            const table = document.createElement('table');
            table.id = 'output';
            const heading = document.createElement('tr');
            heading.className = 'header';
            table.appendChild(heading);
            if (type == 'completion') {
                const completions = await getCompletionResults(level, negate, regex, model);

                if (makeHash(...getCurrentValues(), refreshId) == currentProcess) {
                    heading.innerHTML = `<th>Completion</th><th>Prompt</th><th>Tokens</th><th>Level</th>`;

                    for (const {prompt, completion, tokens, level} of completions) {
                        const tr = createRow([completion], [prompt], [tokens], [level]);
                        if (completion == 'I have been PWNED') {
                            tr.classList.add('correct')
                        }
                        table.appendChild(tr)
                    }
                    $('#output').replaceWith(table);
                    last_processed = currentProcess;
                }
            } else {
                const prompts = await getPromptResults(level, negate, regex, model);
                if (makeHash(...getCurrentValues(), refreshId) == currentProcess) {
                    heading.innerHTML = `<th>Prompt</th><th>Completion</th><th>Tokens</th><th>Level</th>`;

                    for (const o of prompts) {
                        for (const completion of o.responses) {
                            const tr = createRow([o.prompt], [completion], [o.tokens], [o.level]);
                            if (completion == 'I have been PWNED') {
                                tr.classList.add('correct');
                            }
                            table.appendChild(tr)
                        }
                    }
                    $('#output').replaceWith(table);
                    last_processed = currentProcess;
                }

            }
        }
    } catch (e) { console.error(e) }

    setTimeout(processor, 500)
}

function copyLink(btn) {
    const url = new URL(location.href);
    url.hash = makeHash(...getCurrentValues())
    const result = navigator.clipboard.writeText(url.href);
    if (!result) {
        prompt("Failed to copy :(", url.href)
    } else {
        const oldValue = btn.value;
        btn.value = "Copied!";
        setTimeout(() => {
            btn.value = oldValue;
        }, 2000);
    }
}

window.onhashchange = () => {
    if (location.hash) {
        setCurrentValues(...decodeURIComponent(location.hash.slice(1)).split('|€|'))
        history.pushState("", document.title, window.location.pathname
            + window.location.search);
    }
}
processor()