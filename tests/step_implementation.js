let state

beforeSpec(async () => {
  state = {
    endpoint: '',
    env: {
      EVALAAS_STORAGE_BASE: 'gs://test-evalaas-default',
    },
  }
})

const fs = require('fs')
const zlib = require('zlib')
const path = require('path')
const execa = require('execa')
const expect = require('expect')
const mkdirp = require('mkdirp')
const fetch = require('node-fetch')
const { Buffer } = require('buffer')
const pTimeout = require('p-timeout')

const parseCode = text => text.replace(/^`([^]*)`$/, '$1')
const parseLink = text => text.replace(/^\[([^]*)\]\([^]*\)/, '$1')
const replaceUrl = url =>
  url
    .replace(state.endpoint, 'http://localhost:3741')
    .replace(/^\//, 'http://localhost:3741/')
const tableToFileContents = table => {
  return Buffer.from(table.rows.map(row => parseCode(row.cells[0])).join('\n'))
}
const fakeUpload = (uri, buffer) => {
  const [, bucket, key] = uri.match(/^gs:\/\/([^/]+)\/([^]*)$/)
  const fakeStorageFilePath = `tmp/fake-storage/${bucket}/${key}`
  mkdirp.sync(path.dirname(fakeStorageFilePath))
  fs.writeFileSync(fakeStorageFilePath, buffer)
}

step(
  'You have created the Google Cloud Storage bucket named <bucket>',
  async function() {
    // No-op, the fake folder will be created on upload step
  },
)
step(
  'You have configured the environment variable <name> to <value>',
  async function(name, value) {
    state.env[parseCode(name)] = parseCode(value)
  },
)
step(
  'You have deployed evalaas to Google Cloud Run and made it accessible at <endpoint>',
  async function(endpoint) {
    state.endpoint = parseCode(endpoint)
    await ensureServerInitialized()
  },
)

step('Compress and upload <file> to <uri>', async function(file, uri) {
  const buffer = zlib.gzipSync(fs.readFileSync(`specs/${parseLink(file)}`))
  fakeUpload(parseCode(uri), buffer)
})
step('Deploy <file> to evalaas', async function(file) {
  const buffer = zlib.gzipSync(fs.readFileSync(`specs/${parseLink(file)}`))
  fakeUpload(
    'gs://test-evalaas-default/' + path.basename(parseLink(file)) + '.gz',
    buffer,
  )
})
step(
  'Upload a file to <uri> with the following contents <table>',
  async function(uri, table) {
    const buffer = tableToFileContents(table)
    fakeUpload(parseCode(uri), buffer)
  },
)
step('Make a GET request to <url>', async function(url) {
  await ensureServerInitialized()
  state.latestResponse = await fetch(replaceUrl(parseCode(url)))
})
step('You should get a response with status code <code>', async function(code) {
  expect(state.latestResponse.status).toEqual(+code)
})
step('You should get the following JSON response: <table>', async function(
  table,
) {
  const expectedJson = parseCode(table.rows[0].cells[0])
  const expected = JSON.parse(expectedJson)
  const actual = await state.latestResponse
    .clone()
    .json()
    .catch(async e => {
      e.message +=
        '\n\nReceived response:\n' + (await state.latestResponse.text())
      throw e
    })
  expect(actual).toEqual(expected)
})
step('You should find these strings in the response: <table>', async function(
  table,
) {
  const actual = await state.latestResponse.text()
  for (const row of table.rows) {
    const expected = parseCode(row.cells[0])
    expect(actual).toContain(expected)
  }
})

async function ensureServerInitialized() {
  if (!state.server) {
    state.server = execa('node', ['server.js'], {
      env: Object.assign({}, state.env, {
        PORT: '3741',
        EVALAAS_FAKE_STORAGE_DIR: 'tmp/fake-storage',
      }),
    })
    state.server.stdout.pipe(fs.createWriteStream('logs/server.log'))
    state.server.stderr.pipe(fs.createWriteStream('logs/server.err'))
    const giveUpTime = Date.now() + 10e3
    let latestError
    for (;;) {
      if (Date.now() > giveUpTime) {
        state.server.kill()
        throw new Error('Failed to start server. Latest error: ' + latestError)
      }
      try {
        await pTimeout(fetch('http://localhost:3741'), 3e3)
        return
      } catch (error) {
        latestError = error
        // retry
      }
    }
  }
}

afterSpec(async () => {
  if (state.server) {
    await state.server.kill()
  }
})
