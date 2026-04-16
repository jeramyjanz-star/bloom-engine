/**
 * BLOOM ENGINE — Generate Schema CLI
 * Usage: npm run generate-schema -- --client=fboc
 */

import path from 'path'
import fs from 'fs/promises'
import { SchemaEngine } from '../src/lib/schema-engine'

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(): { clientId: string } {
  const args = process.argv.slice(2)
  let clientId = ''

  for (const arg of args) {
    const match = arg.match(/^--client=(.+)$/)
    if (match) {
      clientId = match[1]
    }
  }

  if (!clientId) {
    console.error('❌ Missing required argument: --client')
    console.error('Usage: npm run generate-schema -- --client=fboc')
    process.exit(1)
  }

  return { clientId }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { clientId } = parseArgs()

  console.log(`\n🌸 BLOOM ENGINE — Schema Generation`)
  console.log(`   Client: ${clientId}`)

  const engine = new SchemaEngine()

  // 1. Generate all schemas
  console.log(`   ⟳ Generating JSON-LD schema bundle...`)
  let bundle: Awaited<ReturnType<SchemaEngine['generateAll']>>
  try {
    bundle = await engine.generateAll(clientId)
  } catch (err) {
    console.error(`❌ Schema generation failed: ${String(err)}`)
    process.exit(1)
  }

  const schemaTypes = [
    'LocalBusiness',
    ...bundle.services.map((_, i) => `Service_${i}`),
    'FAQPage',
    'BreadcrumbList',
    'WebSite',
  ]
  console.log(`   ✓ Generated ${schemaTypes.length} schema types: ${schemaTypes.join(', ')}`)

  // 2. Save to database
  try {
    await engine.saveToDatabase(clientId, bundle)
    console.log(`   ✓ Saved to bloom_engine.schema_registry`)
  } catch (err) {
    console.warn(`   ⚠️  Database save failed: ${String(err)}`)
  }

  // 3. Write to public/clients/[id]/schema-bundle.json
  const projectRoot = path.resolve(__dirname, '..')
  const publicDir = path.join(projectRoot, 'public', 'clients', clientId)
  const bundlePath = path.join(publicDir, 'schema-bundle.json')

  try {
    await fs.mkdir(publicDir, { recursive: true })
    await fs.writeFile(bundlePath, JSON.stringify(bundle, null, 2), 'utf-8')
    console.log(`   ✓ Written to public/clients/${clientId}/schema-bundle.json`)
  } catch (err) {
    console.error(`❌ Failed to write schema-bundle.json: ${String(err)}`)
    process.exit(1)
  }

  // 4. Write install guide
  const clientSchemaDir = path.join(projectRoot, 'clients', clientId, 'schema')
  try {
    await fs.mkdir(clientSchemaDir, { recursive: true })
    const guide = engine.generateInstallGuide(clientId, bundle)
    await fs.writeFile(path.join(clientSchemaDir, 'install-guide.md'), guide, 'utf-8')
    console.log(`   ✓ Install guide written to clients/${clientId}/schema/install-guide.md`)
  } catch (err) {
    console.warn(`   ⚠️  Could not write install guide: ${String(err)}`)
  }

  // 5. Done
  console.log(`
✅ Schema generation complete
   Bundle:        public/clients/${clientId}/schema-bundle.json
   Install guide: clients/${clientId}/schema/install-guide.md
   Generated at:  ${bundle.generatedAt}

Validate at:
  https://search.google.com/test/rich-results
  https://validator.schema.org/
`)
}

main().catch((err) => {
  console.error(`\n❌ Fatal error: ${String(err)}`)
  process.exit(1)
})
