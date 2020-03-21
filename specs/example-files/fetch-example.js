module.exports = async (req, res) => {
  const package = await fetch(
    'https://unpkg.com/react@16.13.1/package.json',
  ).then(r => r.json())
  const dependenciesCount = Object.keys(package.dependencies).length
  res.json({ dependenciesCount })
}
