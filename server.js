// @ts-check
/// <reference path="./types.d.ts" />

const express = require('express')
const dotenv = require('dotenv')
const crypto = require('crypto')
const zlib = require('zlib')
const fs = require('fs')
const vm = require('vm')
const app = express()
const { Storage } = require('@google-cloud/storage')
const storage = new Storage()

const EVALAAS_STORAGE_BASE = process.env.EVALAAS_STORAGE_BASE
if (!EVALAAS_STORAGE_BASE) {
  throw new Error('Missing environment variable EVALAAS_STORAGE_BASE')
}
const [, storageBucket, storageKeyPrefix = '/'] = Array.from(
  EVALAAS_STORAGE_BASE.match(/^gs:\/\/([^/]+)(\/.*)?$/) || [],
)

if (fs.existsSync('.env')) {
  dotenv.config()
}

/** @type {Evalaas.ModuleCache} */
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
      const sourceCode = zlib.gunzipSync(sourceResponse).toString('utf8')
      cachedModule = {
        hash,
        source: sourceCode,
        module: loadModule(filename, hash, sourceCode),
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

/**
 * @param {string} filename
 * @param {string} hash
 * @param {string} source
 */
function loadModule(filename, hash, source) {
  const newModule = { exports: {} }
  const fn = vm.compileFunction(
    source,
    ['require', 'exports', 'module', '__filename', '__dirname'],
    { filename: `/evalaas/${filename}/${hash}.js` },
  )
  fn(require, newModule.exports, newModule, __filename, __dirname)
  return newModule
}

require('source-map-support').install({
  // @ts-ignore
  retrieveFile: function(path) {
    const match = path.match(/^\/evalaas\/([^/]+)\/(\w+)\.js$/)
    if (!match) {
      return null
    }
    const [, filename, hash] = match
    const cachedModule = moduleCache[filename]
    if (!cachedModule) {
      return null
    }
    if (cachedModule.hash !== hash) {
      return null
    }
    return cachedModule.source
  },
})

const port = process.env.PORT || 8080
app.listen(port, () => {
  console.log('evalaas listening on port', port)
})
