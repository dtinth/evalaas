# evalaas

Personal serverless prototyping platform on top of [Google Cloud Run](https://cloud.google.com/run).

Check out [the **basic usage** example](<./specs/Basic usage.md>) which also serves as an **executable specification**, [continuously tested on GitHub Actions](https://github.com/dtinth/evalaas/actions) using [Gauge](https://gauge.org/). You can [view the latest test result here](https://dtinth.github.io/evalaas/specs/Basic%20usage.html).

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
  Code deployed to evalaas has access to the whole Node.js runtime
  as well as the whole Google Cloud project it resides in,
  so don’t run any untrusted code.
  If security is a concern, create a separate Google Cloud project.

- **The code to be deployed must be in a single .js file.**
  You can use [@zeit/ncc](https://github.com/zeit/ncc) to compile your code into a single `.js` file.
  Because of this limitation, you cannot use modules with native addons,
  but your JS code can require any module the runtime can,
  that means you can give your code access to native modules by listing them in `package.json`.
  For example, `puppeteer` and `@google-cloud/vision` is listed inside this project’s `package.json` although it is not used here because some of my projects may use it.

## Building and testing locally

1. Install [buildpacks](https://buildpacks.io/docs/tools/pack/)

2. Build the image

   ```
   pack build --builder gcr.io/buildpacks/builder:v1 evalaas
   ```

3. Run evalaas with fake filesystem

   ```
   docker run -ti --rm --init -p 3741:3741 -e EVALAAS_STORAGE_BASE=gs://demo-evalaas -e EVALAAS_FAKE_STORAGE_DIR=tmp/fakefs -v $PWD/tmp/fakefs:/usr/src/app/tmp/fakefs -e EVALAAS_FAKE_REGISTRY_DIR=tmp/fakereg -v $PWD/tmp/fakefs:/usr/src/app/tmp/fakereg -e EVALAAS_FAKE_TOKEN=admintoken -e PORT=3741 evalaas
   ```

## Deployment

**Building the image on the cloud:**

```
gcloud builds submit --pack image=gcr.io/$GOOGLE_CLOUD_PROJECT/evalaas
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

The first run will fail. Go to Cloud Run console and set up the environment variable.

**Environment variable config:**

- `EVALAAS_STORAGE_BASE` The Google Cloud Storage URL that hosts the code files, such as `gs://my-bucket`

## Synopsis

**Deploying code to run on evalaas:**

1. Create a file that exports an HTTP handler, like this:

   ```js
   // example.js
   module.exports = (req, res) => {
     const name = process.env.HELLO_TARGET || 'world'
     res.json({ message: 'hello, ' + name })
   }
   ```

2. Gzip the code and upload the file to Google Clous Storage:

   ```
   cat example.js | gzip -9 | gsutil cp - gs://my-bucket/example.js.gz
   ```

3. Your endpoint is ready:

   ```
   https://<service>.run.app/run/example
   ```

Your code must reside in a single file.
You can use [@zeit/ncc](https://github.com/zeit/ncc) to compile code into a single `.js` file.

**Adding in environment variables:**

Copy your `.env` file to the bucket:

```
echo 'HELLO_TARGET=evalaas' | gsutil cp - gs://my-bucket/example.js.env
```

The secrets are now available in `req.env`.

## Name

This project is taking a JavaScript `eval` function and exposing as a service.
So the name comes from `eval` + aaS (-as-a-Service).
You can pronounce it like “everlast” because I have less fear that Google Cloud will sunset anytime soon.
