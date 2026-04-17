/**
 * GMB Q&A Seeder — seeds Q&A pairs to a client's Google Business Profile.
 *
 * Usage:
 *   npx ts-node scripts/gmb-seed-qa.ts --client=fboc
 */

import { loadClientConfig } from '../src/lib/client-loader'
import { seedQAForClient } from '../src/lib/agents/gmb-qa-seeder'

function parseArgs(): { clientId: string } {
  const args = process.argv.slice(2)
  let clientId = ''

  for (const arg of args) {
    const match = arg.match(/^--client=(.+)$/)
    if (match) {
      clientId = match[1].trim()
    }
  }

  if (!clientId) {
    console.error('Error: --client argument is required.')
    console.error('Usage: npx ts-node scripts/gmb-seed-qa.ts --client=fboc')
    process.exit(1)
  }

  return { clientId }
}

async function main(): Promise<void> {
  const { clientId } = parseArgs()

  console.info(`[gmb-seed-qa] Loading config for client: ${clientId}`)

  let config
  try {
    config = await loadClientConfig(clientId)
  } catch (err) {
    console.error(`[gmb-seed-qa] Failed to load client config: ${String(err)}`)
    process.exit(1)
  }

  console.info(`[gmb-seed-qa] Seeding Q&A for ${config.name} (${config.aeoQueries.length} questions)`)

  let result
  try {
    result = await seedQAForClient(clientId, config)
  } catch (err) {
    console.error(`[gmb-seed-qa] Fatal error during seeding: ${String(err)}`)
    process.exit(1)
  }

  console.info(`[gmb-seed-qa] Completed — seeded: ${result.seeded}, failed: ${result.failed}`)

  if (result.failed > 0) {
    console.warn(`[gmb-seed-qa] ${result.failed} Q&A pair(s) failed to seed. Check logs above for details.`)
    process.exit(1)
  }
}

main().catch((err: unknown) => {
  console.error('[gmb-seed-qa] Unhandled error:', String(err))
  process.exit(1)
})
