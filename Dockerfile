# timeoffapp:latest
# docker build -t timeoffapp:v1 .

########################################################################
# BUILD STAGE 1 - Start with the same image that will be used at runtime
FROM node:8-alpine as builder

# set up python for node-signature
RUN apk --no-cache add --virtual native-deps \
  g++ gcc libgcc libstdc++ linux-headers make python git openssh

# set up the runtime user
RUN addgroup -S nupp && adduser -S -g nupp nupp
ENV HOME=/home/nupp
ADD --chown=nupp:nupp application $HOME/app

ADD --chown=nupp:nupp https://github.com/Yelp/dumb-init/releases/download/v1.1.1/dumb-init_1.1.1_amd64 /usr/local/bin/dumb-init

WORKDIR $HOME/app
COPY --chown=nupp:nupp bluefyre-agent-node-1.2.6.tgz .
RUN ls -la $HOME/app

RUN  chmod +x /usr/local/bin/dumb-init && \
#    npm install --silent --progress=false --production && \
    npm install && \
    npm install ./bluefyre-agent-node-1.2.6.tgz && \
    chown -R nupp:nupp $HOME/* /usr/local/

RUN echo "builder -- finished"

########################################################################
# BUILD STAGE 2 - copy the compiled app dir into a fresh runtime image
FROM node:8-alpine as runtime

# set up python for node-signature
RUN apk --no-cache add --virtual native-deps \
  g++ gcc libgcc libstdc++ linux-headers make python

RUN addgroup -S nupp && adduser -S -g nupp nupp

ENV HOME=/home/nupp

COPY --chown=nupp:nupp --from=builder /home/nupp/app /home/nupp/app

WORKDIR $HOME/app
RUN ls -la $HOME/app

# do this to make the image somewhat thin
RUN apk del native-deps

RUN chown -R nupp:nupp $HOME/* /usr/local/
RUN echo "runtime -- finished"

USER nupp

EXPOSE 3000