# timeoffapp:latest
# docker build -t timeoffapp:v1 .

FROM node:6.11.4

RUN apt-get update -y && apt-get upgrade -y
RUN apt-get install -y git build-essential
RUN apt-get install -y telnet httpie vim

RUN mkdir -p application
COPY application application/.
RUN  true \
    && chown -R root /application/ \
    && true

WORKDIR /application
COPY bluefyre-agent-node-1.2.3.tgz .

RUN npm install ./bluefyre-agent-node-1.2.3.tgz
RUN npm install

EXPOSE 3000
