const fs = require('fs')
const path = require('path')

const routesPath = path.join(__dirname, 'dist/_routes.json')
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'))

// Remove /consent, /login, /profile from exclude list so they are properly routed
routes.exclude = routes.exclude.filter(p => !['/consent', '/login', '/profile'].includes(p))

fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2))

console.log('Fixed _routes.json for Cloudflare Pages routing')
console.log('Excluded routes:', routes.exclude)
