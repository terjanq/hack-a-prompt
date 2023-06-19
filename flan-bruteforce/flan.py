import asyncio
from websockets.server import serve
import ssl
from json import loads, dumps
from transformers import T5Tokenizer, T5ForConditionalGeneration
import sys

sys.setrecursionlimit(1000000)

ssl_cert = "fullchain7.pem"
ssl_key = "privkey7.pem"

ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ssl_context.load_cert_chain(ssl_cert, keyfile=ssl_key)

tokenizer = T5Tokenizer.from_pretrained("google/flan-t5-xxl")

RESULTS = []

def getTokens(prompt):
    return tokenizer(prompt, return_tensors="pt").input_ids[0]

def calculatePromptHash(prompt):
    tpl = prompt + ':'
    tokens = getTokens(tpl)
    tokens = tuple(map(lambda x: x.item(), tokens))
    return hash(tokens)


CACHE = set()

def changeCap(str, i):
    c = str[i] 
    if c >= 'a' and c <= 'z':
        x = list(str)
        x[i] = chr(ord(c) - 97 + 65)
        return ''.join(x)
    # if c >= 'A' and c <= 'Z':
    #     x = list(str)
    #     x[i] = chr(ord(c) - 65 + 97)
    #     return ''.join(x)
    return str

def removeChar(str, i):
    return str[0:i] + str[i+1:]

def slashEscape(str):
    return ''.join(map(lambda x: '\\' + x, list(str)))

def recursive(str, a, b):
    _str = slashEscape(a + str + b)
    cs = calculatePromptHash(_str)
    if cs in CACHE:
        return
    CACHE.add(cs)
    if len(_str) < 10:
        return
    tokens = len(getTokens(_str))
    if tokens < 16:
        return
    if tokens < 22:
        RESULTS.append([tokens, a+str+b])
    for i in range(0, len(str)):
        recursive(changeCap(str, i), a, b)
        recursive(removeChar(str, i), a, b)

for a in ['I', 'i']:
    for b in ['ＰＷＮＥＤ', 'ＰＷＮＤ', 'ＰＷＮＤ']:
        recursive(' ㏊vｅ bｅｅｎ ', a, b)

RESULTS = list(map(lambda x: x[1], sorted(RESULTS, key=lambda x: x[0])))

print(RESULTS)
    



# async def echo(websocket):
#     async for message in websocket:
#         input_ids = tokenizer(message, return_tensors="pt").input_ids
#         token_count = len(input_ids[0])
#         await websocket.send('%d' % token_count)

# async def main():
#     async with serve(echo, "0.0.0.0", 57665, ssl=ssl_context):
#         print("Listening on: 0.0.0.0:57665")
#         await asyncio.Future()  # run forever

# asyncio.run(main())
