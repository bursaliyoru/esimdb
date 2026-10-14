import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures')

export const fixture = (name: string): string => fs.readFileSync(path.join(FIXTURES, name), 'utf8')
export const fixtureJson = (name: string): unknown => JSON.parse(fixture(name))
