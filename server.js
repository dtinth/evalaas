const express = require('express')
const dotenv = require('dotenv')
const crypto = require('crypto')
const zlib = require('zlib')
const fs = require('fs')
const app = express()
const { Storage } = require('@google-cloud/storage')
const storage = new Storage()

const EVALAAS_STORAGE_BASE = process.env.EVALAAS_STORAGE_BASE
const [, storageBucket, storageKeyPrefix = '/'] = EVALAAS_STORAGE_BASE.match(
  /^gs:\/\/([^/]+)(\/.*)?$/,
)

if (fs.existsSync('.env')) {
  dotenv.config()
}

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

    const envFile = bucket.file(filePrefix + '.env')
    const envPromise = envFile
      .download()
      .catch(e => '')
      .then(([b]) => dotenv.parse(String(b)))

    const sourceFile = bucket.file(filePrefix + '.js.gz')
    const sourceResponse = await sourceFile
      .download()
      .then(([buffer]) => buffer)
    const hash = crypto
      .createHash('sha256')
      .update(sourceResponse)
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
        module: loadModule(filename, sourceResponse),
      }
      moduleCache[filename] = cachedModule
    }
    req.url = req.url.slice(match[0].replace(/\/$/, '').length) || '/'
    req.env = await envPromise
    ;(cachedModule.module.exports.default || cachedModule.module.exports)(
      req,
      res,
    )
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
