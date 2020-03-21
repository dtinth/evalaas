# Bundled modules

Some modules are large or requires native addons, and putting them in JS files may not be practical. Therefore, they are bundled as part of the runtime.

## puppeteer

You can use puppeteer to automate a headless Chrome browser.

* Deploy "[example-files/puppeteer-example.js](example-files/puppeteer-example.js)" to evalaas
* Make a GET request to "`/run/puppeteer-example`"
* You should get the following JSON response:

  | json response    |
  |------------------|
  | `{ "title": "Example Domain" }` |
