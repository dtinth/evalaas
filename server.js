const express = require('express')
const crypto = require('crypto')
const zlib = require('zlib')
const app = express()
const { Storage } = require('@google-cloud/storage')
const storage = new Storage()

const EVALAAS_STORAGE_BASE = process.env.EVALAAS_STORAGE_BASE
const [, storageBucket, storageKeyPrefix = '/'] = EVALAAS_STORAGE_BASE.match(
  /^gs:\/\/([^/]+)(\/.*)?$/,
)

const moduleCache = {}

app.use(async (req, res, next) => {
  const match = req.url.match(/^\/run\/([a-zA-Z0-9_-]+)(?:$|\/)/)
  if (!match) {
    return next()
  }
  try {
    const filename = match[1]
    const bucket = storage.bucket(storageBucket)
    const filePrefix = (
      storageKeyPrefix +
      (storageKeyPrefix.endsWith('/') ? '' : '/') +
      filename
    ).replace(/^\//, '')
    const file = bucket.file(filePrefix + '.js.gz')
    const [response] = await file.download()
    const hash = crypto
      .createHash('sha256')
      .update(response)
      .digest('hex')

    let cachedModule = moduleCache[filename]
    if (!cachedModule || cachedModule.hash !== hash) {
      console.log(
        '[Compile]',
        filename,
        cachedModule ? cachedModule.hash : '(new)',
        '->',
        hash,
      )
      cachedModule = {
        hash,
        module: loadModule(filename, response),
      }
      moduleCache[filename] = cachedModule
    }
    req.url = req.url.slice(match[0].replace(/\/$/, '').length) || '/'
    console.log(req.url)
    cachedModule.module.exports(req, res)
  } catch (error) {
    next(error)
  }
})

function loadModule(filename, compressedSourceBuffer) {
  const source = zlib.gunzipSync(compressedSourceBuffer).toString('utf8')
  const newModule = { exports: {} }
  const fn = new Function(
    'require',
    'exports',
    'module',
    '__filename',
    '__dirname',
    source,
  )
  fn(require, newModule.exports, newModule, __filename, __dirname)
  return newModule
}

const port = process.env.PORT || 8080
app.listen(port, () => {
  console.log('Hello world listening on port', port)
})
