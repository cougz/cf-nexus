import fs from 'node:fs'
import path from 'node:path'

const routesPath = path.join(process.cwd(), 'dist/_routes.json')
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'))

routes.exclude = routes.exclude.filter(p => !['/consent', '/login', '/profile'].includes(p))

fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2))

console.log('Fixed _routes.json for Cloudflare Pages routing')
console.log('Excluded routes:', routes.exclude)
