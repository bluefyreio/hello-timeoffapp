# -------------------------------------------------------------------
# Minimal dockerfile from alpine base
#
# Instructions:
# =============
# 1. Create an empty directory and copy this file into it.
#
# 2. Create image with: 
#	docker build --tag timeoffapp:latest .
#
# 3. Run with: 
#	docker run -d -p 3000:3000 --name alpine_timeoff timeoffapp
#
# 4. Login to running container (to update config (vi config/app.json): 
#	docker exec -ti --user root alpine_timeoff /bin/sh
# --------------------------------------------------------------------
FROM alpine:3.8

EXPOSE 3000

LABEL org.label-schema.schema-version="1.0"
LABEL org.label-schema.docker.cmd="docker run -d -p 3000:3000 --name alpine_timeoff"

RUN apk add --no-cache \
    git \
    make \
    nodejs npm \
    python \
    vim \
    build-base

RUN adduser --system app --home /app    
USER app
WORKDIR /app

RUN mkdir -p application
COPY application application/.

WORKDIR /app/application
COPY bluefyre-agent-node-1.2.16.tgz .

RUN npm install ./bluefyre-agent-node-1.2.16.tgz
RUN npm install

CMD DEBUG='bluefyre:config,bluefyre:receiver' npm start
