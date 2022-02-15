let state

beforeSpec(async () => {
  state = {
    endpoint: 'https://test.evalaas.dev',
    env: {
      EVALAAS_STORAGE_BASE: 'gs://test-evalaas-default',
    },
  }
})

const fs = require('fs')
const zlib = require('zlib')
const path = require('path')
const expect = require('expect')
const fetch = require('node-fetch')
const axios = require('axios').default
const { Buffer } = require('buffer')
const FormData = require('form-data')

const parseCode = (text) => text.replace(/^`([^]*)`$/, '$1')
const parseLink = (text) => text.replace(/^\[([^]*)\]\([^]*\)/, '$1')
const replaceUrl = (url) =>
  url
    .replace(state.endpoint, 'http://localhost:3741')
    .replace(/^\//, 'http://localhost:3741/')
const tableToFileContents = (table) => {
  return Buffer.from(
    table.rows.map((row) => parseCode(row.cells[0])).join('\n'),
  )
}
step('Compress and PUT <file> to <pathname>', async function (file, url) {
  const buffer = zlib.gzipSync(fs.readFileSync(`specs/${parseLink(file)}`))
  const form = new FormData()
  form.append('file', buffer, 'file')
  await axios.put(replaceUrl(parseCode(url)), form.getBuffer(), {
    headers: Object.assign({}, form.getHeaders(), {
      Authorization: `Bearer admintoken`,
    }),
  })
})
step('Deploy <file> to evalaas', async function (file) {
  const buffer = zlib.gzipSync(fs.readFileSync(`specs/${parseLink(file)}`))
  const form = new FormData()
  form.append('file', buffer, 'file')
  const url = `${state.endpoint}/admin/endpoints/${path.basename(
    parseLink(file),
    '.js',
  )}`
  await axios.put(replaceUrl(parseCode(url)), form.getBuffer(), {
    headers: Object.assign({}, form.getHeaders(), {
      Authorization: `Bearer admintoken`,
    }),
  })
})
step(
  'PUT to <uri> with the following contents <table>',
  async function (url, table) {
    const buffer = tableToFileContents(table)
    const form = new FormData()
    form.append('file', buffer, 'file')
    await axios.put(replaceUrl(parseCode(url)), form.getBuffer(), {
      headers: Object.assign({}, form.getHeaders(), {
        Authorization: `Bearer admintoken`,
      }),
    })
  },
)
step('Make a GET request to <url>', async function (url) {
  state.latestResponse = await fetch(replaceUrl(parseCode(url)))
})
step(
  'You should get a response with status code <code>',
  async function (code) {
    expect(state.latestResponse.status).toEqual(+code)
  },
)
step(
  'You should get the following JSON response: <table>',
  async function (table) {
    const expectedJson = parseCode(table.rows[0].cells[0])
    const expected = JSON.parse(expectedJson)
    const actual = await state.latestResponse
      .clone()
      .json()
      .catch(async (e) => {
        e.message +=
          '\n\nReceived response:\n' + (await state.latestResponse.text())
        throw e
      })
    expect(actual).toEqual(expected)
  },
)
step(
  'You should find these strings in the response: <table>',
  async function (table) {
    const actual = await state.latestResponse.text()
    for (const row of table.rows) {
      const expected = parseCode(row.cells[0])
      expect(actual).toContain(expected)
    }
  },
)
