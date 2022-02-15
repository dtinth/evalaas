// @ts-check
/// <reference path="./types.d.ts" />

require('isomorphic-fetch')

const express = require('express')
const multer = require('multer')
const dotenv = require('dotenv')
const crypto = require('crypto')
const zlib = require('zlib')
const fs = require('fs')
const vm = require('vm')
const app = express()
const { Storage } = require('@google-cloud/storage')
const { Firestore } = require('@google-cloud/firestore')
const { auth, claimEquals } = require('express-oauth2-jwt-bearer')
const { dirname } = require('path')

if (fs.existsSync('.env')) {
  dotenv.config()
}

const storage = createStorage()
const registry = createRegistry()

const EVALAAS_STORAGE_BASE = process.env.EVALAAS_STORAGE_BASE
if (!EVALAAS_STORAGE_BASE) {
  throw new Error('Missing environment variable EVALAAS_STORAGE_BASE')
}
const [, storageBucket, storageKeyPrefix = '/'] = Array.from(
  EVALAAS_STORAGE_BASE.match(/^gs:\/\/([^/]+)(\/.*)?$/) || [],
)

/** @type {Evalaas.ModuleCache} */
const moduleCache = {}

/** @type {import('express').RequestHandler} */
const adminAuthenticate = process.env.EVALAAS_FAKE_TOKEN
  ? (req, res, next) => {
      if (
        req.headers.authorization !== `Bearer ${process.env.EVALAAS_FAKE_TOKEN}`
      ) {
        res.status(401).send('Unauthorized')
        return
      }
      next()
    }
  : auth({
      issuerBaseURL: 'https://accounts.google.com',
    })

/** @type {import('express').RequestHandler} */
const adminAuthorize = process.env.EVALAAS_FAKE_TOKEN
  ? (req, res, next) => next()
  : claimEquals('sub', /** @type {any} */ (process.env.ADMIN_SUBJECT))

const uploadStorage = multer.memoryStorage()
const upload = multer({ storage: uploadStorage })
app.put(
  '/admin/endpoints/:endpointId',
  adminAuthenticate,
  adminAuthorize,
  upload.single('file'),
  async (req, res, next) => {
    try {
      const bucket = storage.bucket(storageBucket)
      const filePrefix = getFilePrefix(req.params.endpointId)
      const file = bucket.file(`${filePrefix}.js.gz`)
      if (!req.file) {
        throw new Error('No file')
      }
      await file.save(req.file.buffer)
      res.send('ok')
    } catch (error) {
      next(error)
    }
  },
)

app.put(
  '/admin/env/:endpointId',
  adminAuthenticate,
  adminAuthorize,
  upload.single('file'),
  async (req, res, next) => {
    try {
      const bucket = storage.bucket(storageBucket)
      const filePrefix = getFilePrefix(req.params.endpointId)
      const file = bucket.file(`${filePrefix}.env`)
      if (!req.file) {
        throw new Error('No file')
      }
      await file.save(req.file.buffer)
      res.send('ok')
    } catch (error) {
      next(error)
    }
  },
)

app.use(async (req, res, next) => {
  const match = req.url.match(/^\/run\/([a-zA-Z0-9_-]+)(?:$|\/)/)
  if (!match) {
    return next()
  }
  try {
    const endpointId = match[1]
    const bucket = storage.bucket(storageBucket)
    const filePrefix = getFilePrefix(endpointId)

    const envFile = bucket.file(filePrefix + '.env')
    const envPromise = envFile
      .download()
      .catch((e) => '')
      .then(([b]) => dotenv.parse(String(b)))

    const sourceFile = bucket.file(filePrefix + '.js.gz')
    const sourceResponse = await sourceFile
      .download()
      .then(([buffer]) => buffer)
    const hash = crypto
      .createHash('sha256')
      .update(sourceResponse)
      .digest('hex')

    let cachedModule = moduleCache[endpointId]
    if (!cachedModule || cachedModule.hash !== hash) {
      console.log(
        '[Compile]',
        endpointId,
        cachedModule ? cachedModule.hash : '(new)',
        '->',
        hash,
      )
      const sourceCode = zlib.gunzipSync(sourceResponse).toString('utf8')
      cachedModule = {
        hash,
        source: sourceCode,
        module: loadModule(endpointId, hash, sourceCode),
      }
      moduleCache[endpointId] = cachedModule
    }
    req.url = req.url.slice(match[0].replace(/\/$/, '').length) || '/'
    req.env = await envPromise
    await (cachedModule.module.exports.default || cachedModule.module.exports)(
      req,
      res,
    )
  } catch (error) {
    next(error)
  }
})

app.get('/', (req, res) => {
  res.send('hi')
})

/**
 * @param {string} endpointId
 */
function getFilePrefix(endpointId) {
  return (
    storageKeyPrefix +
    (storageKeyPrefix.endsWith('/') ? '' : '/') +
    endpointId
  ).replace(/^\//, '')
}

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
  /**
   * @returns {any}
   */
  retrieveFile: function (path) {
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

/**
 * @returns {Evalaas.Storage}
 */
function createStorage() {
  return process.env.EVALAAS_FAKE_STORAGE_DIR
    ? createFakeStorage(process.env.EVALAAS_FAKE_STORAGE_DIR)
    : new Storage()
}

/**
 * @param {string} baseDir
 * @returns {Evalaas.Storage}
 */
function createFakeStorage(baseDir) {
  return {
    bucket(bucketName) {
      return {
        file(key) {
          return {
            async download() {
              return [fs.readFileSync(`${baseDir}/${bucketName}/${key}`)]
            },
            async save(buffer) {
              fs.mkdirSync(dirname(`${baseDir}/${bucketName}/${key}`), {
                recursive: true,
              })
              fs.writeFileSync(`${baseDir}/${bucketName}/${key}`, buffer)
            },
          }
        },
      }
    },
  }
}

/**
 * @returns {Evalaas.Registry}
 */
function createRegistry() {
  return process.env.EVALAAS_FAKE_REGISTRY_DIR
    ? createFakeRegistry(process.env.EVALAAS_FAKE_REGISTRY_DIR)
    : new Firestore()
}

/**
 * @param {string} baseDir
 * @returns {Evalaas.Registry}
 */
function createFakeRegistry(baseDir) {
  return {
    doc(path) {
      return {
        async get() {
          try {
            const data = fs.readFileSync(`${baseDir}/${path}`, 'utf8')
            return {
              exists: true,
              data: () => JSON.parse(data),
            }
          } catch (e) {
            if (/** @type {any} */ (e).code === 'ENOENT') {
              return {
                exists: false,
                data: () => undefined,
              }
            }
            throw e
          }
        },
        async set(data) {
          fs.mkdirSync(dirname(`${baseDir}/${path}`), { recursive: true })
          fs.writeFileSync(`${baseDir}/${path}`, JSON.stringify(data))
          return {}
        },
      }
    },
  }
}
