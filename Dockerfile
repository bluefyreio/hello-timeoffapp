# timeoffapp:v1
# docker build -t timeoffapp:v1 .

FROM node:8-alpine

# set up python for node-signature
RUN apk --no-cache add --virtual native-deps \
  g++ gcc libgcc libstdc++ linux-headers make python git openssh

# set up the runtime user
ENV HOME=/home
ADD . $HOME/app

ADD  https://github.com/Yelp/dumb-init/releases/download/v1.1.1/dumb-init_1.1.1_amd64 /usr/local/bin/dumb-init

WORKDIR $HOME/app/application
#COPY bluefyre-agent-node-1.2.7-alpha.tgz .
RUN mv ../bluefyre-agent-node-1.2.7-alpha.tgz .
RUN ls -la $HOME/app/application

RUN  chmod +x /usr/local/bin/dumb-init && \
#    npm install --silent --progress=false --production && \
    npm install && \
    npm install ./bluefyre-agent-node-1.2.7-alpha.tgz

# do this to make the image somewhat thin
RUN apk del native-deps

EXPOSE 3000