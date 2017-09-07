#!/bin/bash
tmux new -d -s identity_prepare
tmux send-keys -t identity_prepare 'nvm use 6'
tmux send-keys -t identity_prepare 'Enter'
tmux send-keys -t identity_prepare 'npm run prepare:watch'
tmux send-keys -t identity_prepare 'Enter'

tmux new -d -s testrpc
tmux send-keys -t testrpc 'nvm use 6'
tmux send-keys -t testrpc 'Enter'
tmux send-keys -t testrpc 'npm run testrpc'
tmux send-keys -t testrpc 'Enter'

tmux new -d -s identity_devmon
tmux send-keys -t identity_devmon 'nvm use 6'
tmux send-keys -t identity_devmon 'Enter'
tmux send-keys -t identity_devmon 'npm run devmon'
