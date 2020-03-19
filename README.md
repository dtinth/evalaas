# evalaas

Personal serverless prototyping platform on top of [Google Cloud Run](https://cloud.google.com/run).

**Use case:**

- **I want to be able to quickly prototype, build, and deploy serverless endpoints.**

- **It should take no more than 5 seconds to deploy a new version.**
  So, obviously I don’t want to create Docker images each time I want to prototype something.
  This is inspired by [webtask.io](https://webtask.io/) (which no longer accepts new signups and may sunset anytime now),
  [Glitch](https://glitch.com/) (which has request limits and occasional downtimes),
  and [RunKit](https://runkit.com/) — they all deploy instantly,
  unlike [Firebase Cloud Functions](https://firebase.google.com/docs/functions) where I have to wait about a minute to deploy.
  Well, actually, I want the experience to be like FTP’ing a PHP file to a server and have it instantly available.

- **No fixed cost and no hard caps.**
  I could use [Now.sh](https://zeit.co/pricing) but going beyond its Hobby tier costs at least $20/mo.
  [Google App Engine](https://cloud.google.com/appengine/quotas#Instances) also has free quotas
  but despite [having already limited the resource usage to be within the quota](https://github.com/dtinth/automatron/blob/8a8b6ac6ca6f4db15515ccac3ffd95a35a2c6dca/app.yaml#L5),
  GAE still manages to charge me about $5/mo.
  More other free tools have hard caps that can’t be increased.
  I want “pay-as-you-go” model, so that’s why I settled on Google Cloud Run.

**Assumptions:**

- **The Google Cloud project is not shared with anyone.**
  This simplifies our security model.
  If others have access to the Google Cloud project, they will see the service’s secrets.

- **All code that runs on it is trusted.**
  This simplifies our security model.
  Code deployed to evalaas has access to the whole Google Cloud project it resides in,
  so don’t run any untrusted code.
  If security is a concern, create a separate Google Cloud project.

**Building the image on the cloud:**

```
gcloud builds submit --tag gcr.io/$GOOGLE_CLOUD_PROJECT/evalaas
```

**Deploying the image to the cloud:**

```
gcloud run deploy evalaas \
  --image gcr.io/$GOOGLE_CLOUD_PROJECT/evalaas \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --max-instances=1
```
