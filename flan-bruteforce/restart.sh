#!/bin/bash

pid=`ps -ef | grep flan.py | awk '{print $2}'`
kill $pid
source venv/bin/activate
python3 flan.py &