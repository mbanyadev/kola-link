import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateTemplateIdentifier, parseTemplate, serializeTemplate } from '@xo-cash/utils'
import { identityAnchorTemplate } from '../xo/identity-anchor.ts'

const here = dirname(fileURLToPath(import.meta.url))
const parsed = parseTemplate(identityAnchorTemplate as never)
const identifier = generateTemplateIdentifier(parsed)
const serialized = serializeTemplate(parsed)
const out = resolve(here, '../xo/identity-anchor.template.json')
writeFileSync(out, serialized)
console.log('templateIdentifier', identifier)
console.log('wrote', out, `(${serialized.length} bytes)`)
