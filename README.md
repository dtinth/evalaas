# evalaas

Goals:

- Allow prototyping and deployment of serverless functions on the cloud, a la Glitch.
- Sub-second deployment time.

Assumptions:

- The Google Cloud project is not shared with anyone. This simplifies our security model.

```
gcloud builds submit --tag gcr.io/$GOOGLE_CLOUD_PROJECT/evalaas
```

```
gcloud run deploy evalaas \
  --image gcr.io/$GOOGLE_CLOUD_PROJECT/evalaas \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --max-instances=1
```