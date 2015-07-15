#!/usr/bin/bash
if [[ $(basename `pwd`) != "flm" ]]
then
    echo "not in flm directory"
    exit -1
fi
cd ..
tar cpvjf ~/flm.tgz --exclude=flm/node_modules\* --exclude=tmp --exclude=save flm
