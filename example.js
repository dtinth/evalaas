module.exports = (req, res) => {
  const name = req.env.HELLO_TARGET || 'world'
  res.json({ message: 'hello, ' + name })
}
