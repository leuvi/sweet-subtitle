import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd())
const corePkgPath = resolve(root, 'packages/core/package.json')
const changelogPath = resolve(root, 'CHANGELOG.md')

const corePkg = JSON.parse(readFileSync(corePkgPath, 'utf8'))
const version = corePkg.version

if (!version) {
  throw new Error('No version found in packages/core/package.json')
}

const changelog = readFileSync(changelogPath, 'utf8')
const updated = changelog.replace(/^## \[[^\]]+\] - /m, `## [${version}] - `)

if (updated !== changelog) {
  writeFileSync(changelogPath, updated, 'utf8')
  console.log(`Synced CHANGELOG version to ${version}`)
} else {
  console.log(`CHANGELOG already synced at ${version}`)
}
