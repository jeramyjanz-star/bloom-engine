/**
 * BLOOM ENGINE — Run Audit CLI
 * Usage: npm run audit -- --client=fboc
 */

import path from 'path'
import fs from 'fs/promises'
import { loadClientConfig } from '../src/lib/client-loader'
import { AuditAgent } from '../src/lib/audit-agent'

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
    console.error('Usage: npm run audit -- --client=fboc')
    process.exit(1)
  }

  return { clientId }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { clientId } = parseArgs()

  console.log(`\n🌸 BLOOM ENGINE — SEO Audit`)
  console.log(`   Client: ${clientId}`)

  // 1. Load config
  let config: Awaited<ReturnType<typeof loadClientConfig>>
  try {
    config = await loadClientConfig(clientId)
  } catch (err) {
    console.error(`❌ Failed to load client config: ${String(err)}`)
    process.exit(1)
  }

  console.log(`   Site: ${config.url}`)
  console.log(`   ⟳ Starting crawl (max 50 pages, Googlebot UA)...`)

  const agent = new AuditAgent()
  const startTime = Date.now()

  // 2. Run audit
  let audit: Awaited<ReturnType<AuditAgent['crawlSite']>>
  try {
    audit = await agent.crawlSite(clientId, config.url)
  } catch (err) {
    console.error(`❌ Audit crawl failed: ${String(err)}`)
    process.exit(1)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`   ✓ Crawled ${audit.pagesCrawled} pages in ${elapsed}s`)
  console.log(`   Health score: ${audit.healthScore}/100`)
  console.log(`   Critical issues: ${audit.criticalIssues}`)
  console.log(`   High issues: ${audit.highIssues}`)

  // 3. Save to database
  let auditId = '(not saved)'
  try {
    auditId = await agent.saveToDatabase(audit)
    console.log(`   ✓ Saved to database (id: ${auditId})`)
  } catch (err) {
    console.warn(`   ⚠️  Database save failed: ${String(err)}`)
  }

  // 4. Write output files
  const projectRoot = path.resolve(__dirname, '..')
  const auditDir = path.join(projectRoot, 'clients', clientId, 'audit')
  try {
    await fs.mkdir(auditDir, { recursive: true })

    // Full JSON audit
    await fs.writeFile(
      path.join(auditDir, 'audit.json'),
      JSON.stringify(audit, null, 2),
      'utf-8'
    )

    // Markdown report
    const report = agent.generateReport(audit)
    await fs.writeFile(path.join(auditDir, 'report.md'), report, 'utf-8')

    // Fix files
    const fixFiles = agent.generateFixFiles(audit)
    for (const [fileName, content] of Object.entries(fixFiles)) {
      await fs.writeFile(path.join(auditDir, fileName), content, 'utf-8')
    }

    // Sitemap
    const sitemap = agent.generateOptimizedSitemap(audit)
    await fs.writeFile(path.join(auditDir, 'sitemap.xml'), sitemap, 'utf-8')

    // robots.txt
    const robotsTxt = agent.generateOptimizedRobotsTxt(audit)
    await fs.writeFile(path.join(auditDir, 'robots.txt'), robotsTxt, 'utf-8')

    // Meta tags JSON
    const metaTags = agent.generateMetaTagsJson(audit)
    await fs.writeFile(
      path.join(auditDir, 'meta-tags.json'),
      JSON.stringify(metaTags, null, 2),
      'utf-8'
    )

    console.log(`   ✓ Output written to clients/${clientId}/audit/`)
  } catch (err) {
    console.warn(`   ⚠️  Failed to write some output files: ${String(err)}`)
  }

  // 5. Summary
  console.log(`
✅ Audit complete
   Report:    clients/${clientId}/audit/report.md
   Sitemap:   clients/${clientId}/audit/sitemap.xml
   Robots:    clients/${clientId}/audit/robots.txt
   Meta tags: clients/${clientId}/audit/meta-tags.json
   Audit ID:  ${auditId}
`)

  // Print top issues
  if (audit.criticalIssues > 0 || audit.highIssues > 0) {
    const topIssues = audit.issues
      .filter((i) => i.severity === 'critical' || i.severity === 'high')
      .slice(0, 5)

    console.log(`Top issues to fix:`)
    for (const issue of topIssues) {
      console.log(`  [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.description}`)
    }
    console.log()
  }
}

main().catch((err) => {
  console.error(`\n❌ Fatal error: ${String(err)}`)
  process.exit(1)
})
