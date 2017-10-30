# timeoffapp:v3
FROM node:6.11.2

RUN apt-get update -y && apt-get upgrade -y
RUN apt-get install -y git
RUN apt-get install -y telnet httpie vim

WORKDIR /
RUN mkdir -p timeoff-management
COPY . /timeoff-management/
RUN  true \
    && chown -R root /timeoff-management/ \
    && true

WORKDIR /timeoffmanagement
RUN npm install

EXPOSE 3000
CMD npm start
