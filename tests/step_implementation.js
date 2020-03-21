const fetch = require('node-fetch')
const state = {
  endpoint: '',
  env: {},
}

const execa = require('execa')
const zlib = require('zlib')
const fs = require('fs')
const expect = require('expect')
const pTimeout = require('p-timeout')

const parseCode = text => text.replace(/^`([^]*)`$/, '$1')
const parseLink = text => text.replace(/^\[([^]*)\]\([^]*\)/, '$1')
const replaceUrl = url => url.replace(state.endpoint, 'http://localhost:3741')

step('Set environment variable <name> to <value>', async function(name, value) {
  // Assume that environment has already been set.
  state.env[parseCode(name)] = parseCode(value)
})
step('Deploy evalaas and make it accessible at <endpoint>', async function(
  endpoint,
) {
  // Assume that evalaas is already deployed.
  state.endpoint = parseCode(endpoint)
})
step('Compress and upload <file> to <uri>', async function(file, uri) {
  const buffer = zlib.gzipSync(fs.readFileSync(`specs/${parseLink(file)}`))
  await execa('gsutil', ['cp', '-', parseCode(uri)], {
    input: buffer,
    stdout: 'inherit',
    stderr: 'inherit',
  })
})
step('Make a GET request to <url>', async function(url) {
  await ensureServerInitialized()
  state.latestResponse = await fetch(replaceUrl(parseCode(url)))
})
step('You should get a JSON response <table>', async function(table) {
  const expectedJson = parseCode(table.rows[0].cells[0])
  const expected = JSON.parse(expectedJson)
  const actual = await state.latestResponse.json()
  expect(actual).toEqual(expected)
})

async function ensureServerInitialized() {
  if (!state.server) {
    state.server = execa('node', ['server.js'], {
      env: Object.assign({}, state.env, {
        PORT: 3741,
      }),
      stdout: 'inherit',
      stderr: 'inherit',
    })
    const giveUpTime = Date.now() + 10e3
    let latestError
    for (;;) {
      if (Date.now() > giveUpTime) {
        state.server.kill()
        throw new Error('Failed to start server. Latest error: ' + latestError)
      }
      try {
        await pTimeout(fetch('http://localhost:3741'), 3e3)
        console.log('Server is ready!')
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
