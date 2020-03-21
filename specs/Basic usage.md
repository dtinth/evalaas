# Basic usage

**evalaas** is a serverless prototyping platform on top of [Google Cloud Run](https://cloud.google.com/run) which encourages the Save and Refresh development cycle, giving rapid feedback when developing serverless endpoints.

Assuming that evalaas has been deployed to Google Cloud, and a Cloud Storage bucket has been created, you first need to tell **evalaas** which GCS bucket to use.

* Set environment variable "`EVALAAS_STORAGE_BASE`" to "`gs://evalaas-test`"
* Deploy evalaas and make it accessible at "`https://test.evalaas.dev`"

## Deploy a JavaScript endpoint

* Compress and upload "[example-files/hello.js](example-files/hello.js)" to "`gs://evalaas-test/hello.js.gz`"
* Make a GET request to "`https://test.evalaas.dev/run/hello`"
* You should get a JSON response

  | json response    |
  |------------------|
  | `{ "ok": 1 }`    |

## Environment variables

Since multiple endpoints are run on the same server, they all share the same system environment variables (`process.env`).

However, we still may want to give each endpoint a different configuration, but we might not want to hard-code them into the source code. You can upload a `.env` file next to the `.js.gz` file and it will be made available in the endpoint as `req.env`.

* Compress and upload "[example-files/env-example.js](example-files/env-example.js)" to "`gs://evalaas-test/env-example.js.gz`"
* Upload a file to "`gs://evalaas-test/env-example.env`" with the following contents

  | `env-example.env` |
  | --- |
  | # this is a comment |
  | A=hello |
  | B="world" |

* Make a GET request to "`https://test.evalaas.dev/run/env-example`"
* You should get a JSON response

  | json response |
  | --- |
  | `{ "env": { "A": "hello", "B": "world" } }` |
