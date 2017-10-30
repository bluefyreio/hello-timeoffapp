[logo]: https://portal.bluefyre.io/public2/images/logo.bluefyre.new.png "Bluefyre"
## TimeOff App - Bluefyre's demo app for k8
A vulnerable Node.js web application based on the [TimeOff Management app](https://github.com/timeoff-management/application) utilizing [Bluefyre](https://bluefyre.io)'s kubernetes native runtime application security.

### Instructions
This repo sets up the docker image for the TimeOff Application, the create scripts for mySQL in Kubernetes along with volumes.

### Prerequisites
Refer to this [blog post](https://bluefyre.io/getting-started-with-nodejs-and-kubernetes) for prerequisites for minikube, xhyve, OSX. You can certainly run this without minikube as well.

If you're running minikube on OSX, make sure to run the following to set the right context for your docker images
```
minikube config set vm-driver xhyve
minikube start --memory=4096
eval $(minikube docker-env)
```


### Running
1. Create the local volumes for stateful mysql in k8
```
cd k8
kubectl create -f local-volumes.yaml
kubectl get pv
```
2. Set up mySQL secret for password
Remember to replace YOUR_PASSWORD with a string that you'd choose
```
kubectl create secret generic mysql-pass --from-literal=password=YOUR_PASSWORD
```

3. Set up the mySQL service
```
kubectl create -f mysql-deployment.yaml
```

4. Signup at [Bluefyre](https://portal.bluefyre.io/signup) to obtain a free agent API key. Refer [docs](https://bluefyre.io/docs) here for how to do this. 
Once you've obtained this
```
kubectl create secret generic bluefyre-agent-id --from-literal=agentid=BLUEFYRE_AGENT_ID
```

5. Also once you've signed up at [Bluefyre](https://portal.bluefyre.io/account3/download) to download the Node.js microagent. Place the `bluefyre-agent-node-1.2.0.tgz` in the same folder as the Dockerfile

6. Now lets set up the app build
```
cd ../
docker build -t timeoffapp:v1 .
```

7. Lets set up a job to create the database
```
cd k8
kubectl create -f timeoffapp-init-deployment.yaml
```
Verify that the job ran successfully
```
kubectl get jobs
kubectl logs REPLACE_YOUR_POD_ID_HERE -f
```

8. Now lets set up the app
```
kubectl create -f timeoffapp-deployment.yaml
```

9. Now in your brower, navigate to the service
```
minikube service hello-timeoffapp --url
```

10. View realtime vulnerabilities in your [Bluefyre](https://portal.bluefyre.io) portal



