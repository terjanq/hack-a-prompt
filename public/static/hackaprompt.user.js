// ==UserScript==
// @name         Hackaprompt
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  Hackaprompt scripts
// @author       terjanq
// @match        https://www.aicrowd.com/challenges/hackaprompt-2023/submissions/*
// @match        https://jerpint-org-hackaprompt.hf.space/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=aicrowd.com
// @downloadURL  https://hack-a-prompt.terjanq.me/static/hackaprompt.user.js
// @updateURL    https://hack-a-prompt.terjanq.me/static/hackaprompt.user.js
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at

// ==/UserScript==

(function() {

    document.querySelectorAll('h4').forEach(e=>{
        const level = parseInt(e.innerText.match(/LEVEL_(\d+)_/)?.[1])
        if(!level) return;
        const score = parseInt(e.nextElementSibling.innerText);
        let text = '';
        const tokensChatGPT = 10000 - (score/(level*2));
        const tokensOther = 10000 - (score/(level));

        if(score == 0) return;
        if(tokensChatGPT > 5000){
          text = `Flan: (${tokensOther})`;
        }else{
           text = `ChatGPT: (${tokensChatGPT})`;
        }
        e.parentElement.appendChild(document.createTextNode(text));
    });

    const interval = setInterval(()=>{
        if(document.querySelector('#component-6 > label > input')){
         clearInterval(interval);
            const input = document.querySelector('#component-6 > label > input');
        input.value = GM_getValue('sessKey') || "";
            input.dispatchEvent(new Event('input', { bubbles: true }));
        input.onchange = function(){
            GM_setValue('sessKey', this.value);
        };
        }
    }, 500);

})();