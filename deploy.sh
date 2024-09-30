#!/bin/bash

cd ~/bandosquatter || exit

git pull origin prod

docker-compose -f prod-compose.yml up --build up -d
