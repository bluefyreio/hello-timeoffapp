# push images to registry
    app=timeoff
    docker build -t $app -f .
    docker tag $app:v1 gcr.io/upbeat-circlet-199920/$app:v1
    docker push gcr.io/upbeat-circlet-199920/$app



#set up local volumes
kubectl create -f local-volumes.yaml -n timeoff
kubectl get pv -n timeoff

# Replace MYSQL_PASSWORD with your own password
kubectl create secret generic mysql-pass --from-literal=password=MYSQL_PASSWORD -n timeoff

# Replace BLUEFYRE_AGENT_ID with the API key from the Bluefyre app
kubectl create secret generic bluefyre-agent-id --from-literal=agentid=BLUEFYRE_AGENT_ID -n timeoff


kubectl get secrets -n timeoff

kubectl create -f mysql-deployment.yaml -n timeoff
kubectl get pods


kubectl create -f timeoffapp-init-deployment.yaml -n timeoff
kubectl create -f timeoffapp-deployment.yaml -n timeoff

minikube service timeoffapp --url




# Clean up
kubectl delete secret mysql-pass
kubectl delete secret bluefyre-agent-id 
kubectl delete deployment -l app=timeoffapp
kubectl delete service -l app=timeoffapp
kubectl delete pvc -l app=timeoffapp
kubectl delete pv local-pv-1 local-pv-2

kubectl delete job timeoffapp-init
kubectl delete service,deployment timeoffapp
kubectl delete pvc to-pv-claim
