# Basic usage

**evalaas** is a serverless prototyping platform on top of [Google Cloud Run](https://cloud.google.com/run) which encourages the Save and Refresh development cycle, giving rapid feedback when developing serverless endpoints.

> **This file is an executable specification.** The steps in this tutorial is [continuously tested on GitHub Actions](https://github.com/dtinth/evalaas/actions) using [Gauge](https://gauge.org/). You can [view the latest test result here](https://dtinth.github.io/evalaas/specs/Basic%20usage.html).

This guide assumes that evalaas is already deployed.

* You have created the Google Cloud Storage bucket named "`evalaas-test`"
* You have configured the environment variable "`EVALAAS_STORAGE_BASE`" to "`gs://evalaas-test`"
* You have deployed evalaas to Google Cloud Run and made it accessible at "`https://test.evalaas.dev`"

## Deploy a JavaScript endpoint

After setting up, deploying a simple endpoint is not much more complicated than an old-school way of copying PHP files to an FTP server.

But here, the file must gzipped before uploading, Google Cloud Storage is used instead of FTP. To upload files to GCS from a shell script, you can use the [gsutil](https://cloud.google.com/storage/docs/gsutil) command.

* Compress and upload "[example-files/hello.js](example-files/hello.js)" to "`gs://evalaas-test/hello.js.gz`"
* Make a GET request to "`https://test.evalaas.dev/run/hello`"
* You should get the following JSON response:

  | json response    |
  |------------------|
  | `{ "ok": 1 }`    |

## Updating a JavaScript endpoint

One of the advantage of using evalaas is **almost instant deploys.** When you upload a new file to Google Cloud Storage, the change takes effect **immediately.** This is in contrast with some other serverless providers where you have to wait about 1 minute to get your code updated.

First, upload the 1st version:

* Compress and upload "[example-files/hello.js](example-files/hello.js)" to "`gs://evalaas-test/hello.js.gz`"
* Make a GET request to "`https://test.evalaas.dev/run/hello`"
* You should get the following JSON response:

  | json response    |
  |------------------|
  | `{ "ok": 1 }`    |

Then, upload the 2nd version:

* Compress and upload "[example-files/hello-v2.js](example-files/hello-v2.js)" to "`gs://evalaas-test/hello.js.gz`"
* Make a GET request to "`https://test.evalaas.dev/run/hello`"
* You should get the following JSON response:

  | json response    |
  |------------------|
  | `{ "ok": "it is working!" }` |

## Environment variables

Since multiple endpoints may be run on the same Node.js process (unless you deploy multiple instances of evalaas), they all share the same set of system environment variables (`process.env`), so `process.env` cannot be customized per-endpoint.

However, we still may want to give each endpoint a different configuration, but we might not want to hard-code them into the source code or check them into source control. Alternatively, you can upload a `.env` file next to the `.js.gz` file, and it will be made available in the endpoint as `req.env`.

* Compress and upload "[example-files/env-example.js](example-files/env-example.js)" to "`gs://evalaas-test/env-example.js.gz`"
* Upload a file to "`gs://evalaas-test/env-example.env`" with the following contents

  | `env-example.env` |
  | --- |
  | # this is a comment |
  | A=hello |
  | B="world" |

* Make a GET request to "`https://test.evalaas.dev/run/env-example`"
* You should get the following JSON response:

  | json response |
  | --- |
  | `{ "env": { "A": "hello", "B": "world" } }` |

## Source map support

To make compiled endpoints easy to debug, evalaas supports **inline source maps**.

* Compress and upload "[example-files/source-map-example.js](example-files/source-map-example.js)" to "`gs://evalaas-test/source-map-example.js.gz`"
* Make a GET request to "`https://test.evalaas.dev/run/source-map-example`"
* You should find these strings in the response:

  | text to find |
  |------------------|
  | `src/f.js` |
  | `src/index.js` |

<details>
<summary>How to generate the example file</summary>

You can use webpack to generate [example-files/source-map-example.js](example-files/source-map-example.js) with these files:

`src/index.js`:

```js
import f from './f'

export default (req, res) => {
  res.json({ stack: f() })
}
```

`src/f.js`:

```js
export default function foo() {
  return bar()
}

function bar() {
  return new Error('test source map').stack
}
```

`webpack.config.js`:

```js
module.exports = {
  entry: './src/index.js',
  devtool: 'inline-source-map',
  target: 'node',
  mode: 'production',
  output: {
    path: `${__dirname/dist}`,
    filename: 'source-map-example.js',
    library: 'endpoint',
    libraryTarget: 'umd',
  },
}
```

Then run:

```
yarn add --dev webpack webpack-cli && yarn webpack
```

</details>
