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

