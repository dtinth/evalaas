const puppeteer = require('puppeteer')

module.exports = async (req, res) => {
  const browser = await puppeteer.launch()
  try {
    const page = await browser.newPage()
    await page.goto('https://example.com')
    res.json({ title: await page.title() })
  } finally {
    await browser.close()
  }
}
