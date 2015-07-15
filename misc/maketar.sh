#!/usr/bin/sh
cd ~pgj/code
tar cpvjf flm.tgz --exclude=flm/node_modules\* --exclude=misc --exclude=tmp --exclude=save flm
