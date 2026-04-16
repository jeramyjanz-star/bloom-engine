import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { loadClientConfig } from '@/src/lib/client-loader'
import { AuditAgent } from '@/src/lib/audit-agent'

export async function POST(
  _request: NextRequest,
  { params }: { params: { clientId: string } }
): Promise<NextResponse> {
  const { clientId } = params

  // 1. Load client config
  let config: Awaited<ReturnType<typeof loadClientConfig>>
  try {
    config = await loadClientConfig(clientId)
  } catch (err) {
    return NextResponse.json(
      { error: `Client not found: ${String(err)}` },
      { status: 404 }
    )
  }

  // 2. Run the audit
  const agent = new AuditAgent()
  let auditId: string

  let audit: Awaited<ReturnType<AuditAgent['crawlSite']>>
  try {
    audit = await agent.crawlSite(clientId, config.url)
  } catch (err) {
    return NextResponse.json(
      { error: `Audit crawl failed: ${String(err)}` },
      { status: 500 }
    )
  }

  // 3. Save to database
  try {
    auditId = await agent.saveToDatabase(audit)
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to save audit to database: ${String(err)}` },
      { status: 500 }
    )
  }

  // 4. Write report files to /clients/[clientId]/audit/
  const auditDir = path.join(process.cwd(), 'clients', clientId, 'audit')
  try {
    await fs.mkdir(auditDir, { recursive: true })

    // Main markdown report
    const report = agent.generateReport(audit)
    await fs.writeFile(path.join(auditDir, 'report.md'), report, 'utf-8')

    // Full audit JSON
    await fs.writeFile(
      path.join(auditDir, 'audit.json'),
      JSON.stringify(audit, null, 2),
      'utf-8'
    )

    // Fix files for critical/high issues
    const fixFiles = agent.generateFixFiles(audit)
    for (const [fileName, content] of Object.entries(fixFiles)) {
      await fs.writeFile(path.join(auditDir, fileName), content, 'utf-8')
    }

    // Optimized sitemap
    const sitemap = agent.generateOptimizedSitemap(audit)
    await fs.writeFile(path.join(auditDir, 'sitemap.xml'), sitemap, 'utf-8')

    // Optimized robots.txt
    const robotsTxt = agent.generateOptimizedRobotsTxt(audit)
    await fs.writeFile(path.join(auditDir, 'robots.txt'), robotsTxt, 'utf-8')

    // Meta tags JSON
    const metaTags = agent.generateMetaTagsJson(audit)
    await fs.writeFile(
      path.join(auditDir, 'meta-tags.json'),
      JSON.stringify(metaTags, null, 2),
      'utf-8'
    )
  } catch (err) {
    // Non-fatal: log but still return success
    console.warn(`[audit/run] Failed to write some report files for "${clientId}": ${String(err)}`)
  }

  return NextResponse.json(
    {
      auditId,
      healthScore: audit.healthScore,
      criticalIssues: audit.criticalIssues,
      highIssues: audit.highIssues,
      pagesCrawled: audit.pagesCrawled,
      reportPath: `/clients/${clientId}/audit/report.md`,
    },
    { status: 200 }
  )
}
