#set up local volumes
kubectl create -f local-volumes.yaml
kubectl get pv

# Replace MYSQL_PASSWORD with your own password
kubectl create secret generic mysql-pass --from-literal=password=MYSQL_PASSWORD

# Replace BLUEFYRE_AGENT_ID with the API key from the Bluefyre app
kubectl create secret generic bluefyre-agent-id --from-literal=agentid=BLUEFYRE_AGENT_ID


kubectl get secrets

kubectl create -f mysql-deployment.yaml
kubectl get pods


kubectl create -f timeoffapp-init-deployment.yaml
kubectl create -f timeoffapp-deployment.yaml

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
