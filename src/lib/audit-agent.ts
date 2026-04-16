import { chromium, Browser, Page, Response } from 'playwright'
import path from 'path'
import fs from 'fs/promises'
import { supabaseAdmin } from '@/src/lib/supabase'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface PageAudit {
  url: string
  statusCode: number
  redirectChain: string[]
  title: { text: string; length: number; hasTargetKeyword: boolean }
  metaDescription: { text: string; length: number; hasTargetKeyword: boolean }
  h1: { count: number; texts: string[] }
  h2s: string[]
  imagesWithoutAlt: number
  totalImages: number
  canonicalUrl: string | null
  internalLinks: string[]
  brokenLinks: string[]
  schemaTypesDetected: string[]
  loadTimeMs: number
  hasMobileViewport: boolean
  openGraphTags: Record<string, string>
  issues: AuditIssue[]
}

export interface AuditIssue {
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  recommendation: string
  fixContent?: string
}

export interface SiteAudit {
  clientId: string
  url: string
  crawledAt: string
  healthScore: number
  pagesCrawled: number
  criticalIssues: number
  highIssues: number
  issues: AuditIssue[]
  pages: PageAudit[]
  siteChecks: {
    hasSitemap: boolean
    sitemapValid: boolean
    hasRobotsTxt: boolean
    httpsEverywhere: boolean
    wwwRedirectConsistent: boolean
  }
}

interface PageData {
  title: string
  metaDescription: string
  h1Texts: string[]
  h2Texts: string[]
  imagesWithoutAlt: number
  totalImages: number
  canonicalUrl: string | null
  internalLinks: string[]
  schemaTypes: string[]
  openGraphTags: Record<string, string>
  hasMobileViewport: boolean
}

// ---------------------------------------------------------------------------
// AuditAgent
// ---------------------------------------------------------------------------

export class AuditAgent {
  private readonly maxPages = 50
  private readonly pageTimeoutMs = 10_000
  private readonly googlebotUA =
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async crawlSite(clientId: string, url: string): Promise<SiteAudit> {
    const normalizedUrl = this.normalizeUrl(url)
    const crawledAt = new Date().toISOString()

    let browser: Browser | null = null

    try {
      browser = await chromium.launch({ headless: true })
      const context = await browser.newContext({
        userAgent: this.googlebotUA,
        viewport: { width: 1280, height: 800 },
      })

      // Discover and crawl pages
      const pages = await this.crawlPages(context, normalizedUrl)

      // Site-level checks
      const siteChecks = await this.runSiteChecks(context, normalizedUrl)

      // Aggregate all issues
      const allIssues: AuditIssue[] = []
      for (const page of pages) {
        allIssues.push(...page.issues)
      }

      // Health score calculation
      const healthScore = this.calculateHealthScore(allIssues)

      const criticalIssues = allIssues.filter((i) => i.severity === 'critical').length
      const highIssues = allIssues.filter((i) => i.severity === 'high').length

      await context.close()

      return {
        clientId,
        url: normalizedUrl,
        crawledAt,
        healthScore,
        pagesCrawled: pages.length,
        criticalIssues,
        highIssues,
        issues: allIssues,
        pages,
        siteChecks,
      }
    } finally {
      if (browser) {
        await browser.close()
      }
    }
  }

  async saveToDatabase(audit: SiteAudit): Promise<string> {
    const { data, error } = await supabaseAdmin
      .schema('bloom_engine')
      .from('seo_audits')
      .insert({
        client_id: audit.clientId,
        url: audit.url,
        crawled_at: audit.crawledAt,
        health_score: audit.healthScore,
        pages_crawled: audit.pagesCrawled,
        critical_issues: audit.criticalIssues,
        high_issues: audit.highIssues,
        issues: audit.issues,
        pages: audit.pages,
        site_checks: audit.siteChecks,
      })
      .select('id')
      .single()

    if (error) {
      throw new Error(`Failed to save audit to database: ${error.message}`)
    }

    return (data as { id: string }).id
  }

  generateReport(audit: SiteAudit): string {
    const lines: string[] = []

    lines.push(`# SEO Audit Report — ${audit.url}`)
    lines.push(``)
    lines.push(`**Client:** ${audit.clientId}`)
    lines.push(`**Crawled:** ${audit.crawledAt}`)
    lines.push(`**Pages crawled:** ${audit.pagesCrawled}`)
    lines.push(`**Health score:** ${audit.healthScore}/100`)
    lines.push(`**Critical issues:** ${audit.criticalIssues}`)
    lines.push(`**High issues:** ${audit.highIssues}`)
    lines.push(``)

    // Site checks
    lines.push(`## Site-Level Checks`)
    lines.push(``)
    lines.push(`| Check | Status |`)
    lines.push(`|-------|--------|`)
    lines.push(`| Sitemap found | ${audit.siteChecks.hasSitemap ? '✅' : '❌'} |`)
    lines.push(`| Sitemap valid | ${audit.siteChecks.sitemapValid ? '✅' : '❌'} |`)
    lines.push(`| robots.txt found | ${audit.siteChecks.hasRobotsTxt ? '✅' : '❌'} |`)
    lines.push(`| HTTPS everywhere | ${audit.siteChecks.httpsEverywhere ? '✅' : '❌'} |`)
    lines.push(`| WWW redirect consistent | ${audit.siteChecks.wwwRedirectConsistent ? '✅' : '❌'} |`)
    lines.push(``)

    // Issues summary
    if (audit.issues.length > 0) {
      lines.push(`## Issues Summary`)
      lines.push(``)

      const bySeverity: Record<string, AuditIssue[]> = {
        critical: [],
        high: [],
        medium: [],
        low: [],
      }
      for (const issue of audit.issues) {
        bySeverity[issue.severity].push(issue)
      }

      for (const severity of ['critical', 'high', 'medium', 'low'] as const) {
        const group = bySeverity[severity]
        if (group.length === 0) continue
        lines.push(`### ${severity.charAt(0).toUpperCase() + severity.slice(1)} (${group.length})`)
        lines.push(``)
        for (const issue of group) {
          lines.push(`- **${issue.type}**: ${issue.description}`)
          lines.push(`  - Recommendation: ${issue.recommendation}`)
          if (issue.fixContent) {
            lines.push(`  - Fix: \`${issue.fixContent.slice(0, 120)}\``)
          }
        }
        lines.push(``)
      }
    }

    // Per-page details
    lines.push(`## Page-by-Page Details`)
    lines.push(``)
    for (const page of audit.pages) {
      lines.push(`### ${page.url}`)
      lines.push(``)
      lines.push(`| Property | Value |`)
      lines.push(`|----------|-------|`)
      lines.push(`| Status | ${page.statusCode} |`)
      lines.push(`| Load time | ${page.loadTimeMs}ms |`)
      lines.push(`| Title | ${page.title.text || '_(missing)_'} (${page.title.length} chars) |`)
      lines.push(`| Meta desc | ${page.metaDescription.text ? page.metaDescription.text.slice(0, 60) + '…' : '_(missing)_'} (${page.metaDescription.length} chars) |`)
      lines.push(`| H1 count | ${page.h1.count} |`)
      lines.push(`| Images without alt | ${page.imagesWithoutAlt}/${page.totalImages} |`)
      lines.push(`| Canonical | ${page.canonicalUrl || '_(none)_'} |`)
      lines.push(`| Schema types | ${page.schemaTypesDetected.join(', ') || '_(none)_'} |`)
      lines.push(`| Internal links | ${page.internalLinks.length} |`)
      lines.push(`| Broken links | ${page.brokenLinks.length} |`)

      if (page.issues.length > 0) {
        lines.push(``)
        lines.push(`**Issues (${page.issues.length}):**`)
        for (const issue of page.issues) {
          lines.push(`- [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.description}`)
        }
      }
      lines.push(``)
    }

    return lines.join('\n')
  }

  generateFixFiles(audit: SiteAudit): Record<string, string> {
    const files: Record<string, string> = {}

    const importantIssues = audit.issues.filter(
      (i) => i.severity === 'critical' || i.severity === 'high'
    )

    // Group by type
    const byType = new Map<string, AuditIssue[]>()
    for (const issue of importantIssues) {
      const existing = byType.get(issue.type) ?? []
      existing.push(issue)
      byType.set(issue.type, existing)
    }

    for (const [type, issues] of Array.from(byType.entries())) {
      const fileName = `fix-${type.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.txt`
      const lines: string[] = []
      lines.push(`# Fix: ${type}`)
      lines.push(`Severity: ${issues[0].severity}`)
      lines.push(``)
      lines.push(`## Affected pages (${issues.length}):`)
      for (const issue of issues) {
        lines.push(`- ${issue.description}`)
        if (issue.fixContent) {
          lines.push(`  Fix content: ${issue.fixContent}`)
        }
      }
      lines.push(``)
      lines.push(`## Recommendation:`)
      lines.push(issues[0].recommendation)
      files[fileName] = lines.join('\n')
    }

    return files
  }

  generateOptimizedSitemap(audit: SiteAudit): string {
    const now = new Date().toISOString().split('T')[0]
    const lines: string[] = []
    lines.push(`<?xml version="1.0" encoding="UTF-8"?>`)
    lines.push(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`)

    const seen = new Set<string>()
    for (const page of audit.pages) {
      if (page.statusCode !== 200) continue
      if (seen.has(page.url)) continue
      seen.add(page.url)

      const isHome = page.url === audit.url || page.url === audit.url + '/'
      const priority = isHome ? '1.0' : '0.8'
      const changefreq = isHome ? 'weekly' : 'monthly'

      lines.push(`  <url>`)
      lines.push(`    <loc>${this.escapeXml(page.url)}</loc>`)
      lines.push(`    <lastmod>${now}</lastmod>`)
      lines.push(`    <changefreq>${changefreq}</changefreq>`)
      lines.push(`    <priority>${priority}</priority>`)
      lines.push(`  </url>`)
    }

    lines.push(`</urlset>`)
    return lines.join('\n')
  }

  generateOptimizedRobotsTxt(audit: SiteAudit): string {
    const sitemapUrl = `${audit.url}/sitemap.xml`
    const lines: string[] = []
    lines.push(`# robots.txt — optimized by BLOOM ENGINE`)
    lines.push(`# Generated: ${audit.crawledAt}`)
    lines.push(``)
    lines.push(`User-agent: *`)
    lines.push(`Allow: /`)
    lines.push(``)
    lines.push(`# Block common non-content paths`)
    lines.push(`Disallow: /admin/`)
    lines.push(`Disallow: /wp-admin/`)
    lines.push(`Disallow: /wp-login.php`)
    lines.push(`Disallow: /*.json$`)
    lines.push(`Disallow: /api/`)
    lines.push(`Disallow: /_next/`)
    lines.push(``)
    lines.push(`# Allow Googlebot full access`)
    lines.push(`User-agent: Googlebot`)
    lines.push(`Allow: /`)
    lines.push(``)
    lines.push(`Sitemap: ${sitemapUrl}`)
    return lines.join('\n')
  }

  generateMetaTagsJson(audit: SiteAudit): Record<string, { title: string; description: string }> {
    const result: Record<string, { title: string; description: string }> = {}
    for (const page of audit.pages) {
      result[page.url] = {
        title: page.title.text,
        description: page.metaDescription.text,
      }
    }
    return result
  }

  // -------------------------------------------------------------------------
  // Private — crawl helpers
  // -------------------------------------------------------------------------

  private normalizeUrl(url: string): string {
    let u = url.trim()
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      u = `https://${u}`
    }
    return u.replace(/\/$/, '')
  }

  private async crawlPages(
    context: Awaited<ReturnType<Browser['newContext']>>,
    startUrl: string
  ): Promise<PageAudit[]> {
    const visited = new Set<string>()
    const queue: string[] = [startUrl]
    const results: PageAudit[] = []
    const hostname = new URL(startUrl).hostname

    while (queue.length > 0 && results.length < this.maxPages) {
      const url = queue.shift()!
      if (visited.has(url)) continue
      visited.add(url)

      const pageAudit = await this.auditPage(context, url, startUrl, hostname)
      results.push(pageAudit)

      // Enqueue discovered internal links not yet visited
      for (const link of pageAudit.internalLinks) {
        const normalized = link.replace(/\/$/, '')
        if (!visited.has(normalized) && !queue.includes(normalized)) {
          queue.push(normalized)
        }
      }
    }

    return results
  }

  private async auditPage(
    context: Awaited<ReturnType<Browser['newContext']>>,
    url: string,
    siteRoot: string,
    hostname: string
  ): Promise<PageAudit> {
    const page = await context.newPage()
    const redirectChain: string[] = []
    let statusCode = 0
    const startTime = Date.now()

    try {
      // Track redirects
      page.on('response', (response: Response) => {
        const status = response.status()
        if (status >= 300 && status < 400) {
          redirectChain.push(response.url())
        }
        if (response.url() === url || redirectChain.length === 0) {
          statusCode = status
        }
      })

      const response = await page.goto(url, {
        timeout: this.pageTimeoutMs,
        waitUntil: 'domcontentloaded',
      })

      if (response) {
        statusCode = response.status()
      }

      const loadTimeMs = Date.now() - startTime

      // Extract all SEO data via page.evaluate
      const pageData = await page.evaluate((): PageData => {
        const getText = (sel: string): string =>
          (document.querySelector(sel) as HTMLElement | null)?.textContent?.trim() ?? ''

        const getAttr = (sel: string, attr: string): string =>
          (document.querySelector(sel) as HTMLElement | null)?.getAttribute(attr) ?? ''

        // Title
        const titleText = document.title || getText('title')

        // Meta description
        const metaDesc =
          getAttr('meta[name="description"]', 'content') ||
          getAttr('meta[property="og:description"]', 'content')

        // H1 elements
        const h1Els = Array.from(document.querySelectorAll('h1'))
        const h1Texts = h1Els.map((el) => el.textContent?.trim() ?? '')

        // H2 elements
        const h2Texts = Array.from(document.querySelectorAll('h2')).map(
          (el) => el.textContent?.trim() ?? ''
        )

        // Images
        const allImages = Array.from(document.querySelectorAll('img'))
        const imagesWithoutAlt = allImages.filter(
          (img) => !img.getAttribute('alt') || img.getAttribute('alt')!.trim() === ''
        ).length

        // Canonical
        const canonicalUrl = getAttr('link[rel="canonical"]', 'href') || null

        // Internal links
        const currentHost = window.location.hostname
        const allAnchors = Array.from(document.querySelectorAll('a[href]'))
        const internalLinks: string[] = []
        for (const a of allAnchors) {
          const href = a.getAttribute('href') ?? ''
          try {
            const resolved = new URL(href, window.location.href)
            if (resolved.hostname === currentHost && resolved.protocol.startsWith('http')) {
              const clean = resolved.origin + resolved.pathname
              if (!internalLinks.includes(clean)) {
                internalLinks.push(clean)
              }
            }
          } catch {
            // ignore malformed hrefs
          }
        }

        // Schema types from JSON-LD
        const schemaScripts = Array.from(
          document.querySelectorAll('script[type="application/ld+json"]')
        )
        const schemaTypes: string[] = []
        for (const script of schemaScripts) {
          try {
            const json = JSON.parse(script.textContent ?? '{}') as Record<string, unknown>
            if (json['@type']) {
              const types = Array.isArray(json['@type']) ? json['@type'] : [json['@type']]
              for (const t of types) {
                if (typeof t === 'string' && !schemaTypes.includes(t)) {
                  schemaTypes.push(t)
                }
              }
            }
          } catch {
            // ignore malformed JSON-LD
          }
        }

        // Open Graph tags
        const ogTags: Record<string, string> = {}
        const metaEls = Array.from(document.querySelectorAll('meta[property^="og:"]'))
        for (const meta of metaEls) {
          const prop = meta.getAttribute('property') ?? ''
          const content = meta.getAttribute('content') ?? ''
          if (prop && content) {
            ogTags[prop] = content
          }
        }

        // Mobile viewport
        const viewportMeta = document.querySelector('meta[name="viewport"]')
        const hasMobileViewport = viewportMeta !== null

        return {
          title: titleText,
          metaDescription: metaDesc,
          h1Texts,
          h2Texts,
          imagesWithoutAlt,
          totalImages: allImages.length,
          canonicalUrl,
          internalLinks,
          schemaTypes,
          openGraphTags: ogTags,
          hasMobileViewport,
        }
      })

      // Check for broken links (sample up to 10 internal links)
      const brokenLinks = await this.checkBrokenLinks(
        context,
        pageData.internalLinks.slice(0, 10)
      )

      // Derive target keyword from URL path
      const targetKeyword = this.guessTargetKeyword(url, siteRoot)

      const titleHasKeyword = targetKeyword
        ? pageData.title.toLowerCase().includes(targetKeyword.toLowerCase())
        : false
      const descHasKeyword = targetKeyword
        ? pageData.metaDescription.toLowerCase().includes(targetKeyword.toLowerCase())
        : false

      const pageAudit: PageAudit = {
        url,
        statusCode,
        redirectChain,
        title: {
          text: pageData.title,
          length: pageData.title.length,
          hasTargetKeyword: titleHasKeyword,
        },
        metaDescription: {
          text: pageData.metaDescription,
          length: pageData.metaDescription.length,
          hasTargetKeyword: descHasKeyword,
        },
        h1: { count: pageData.h1Texts.length, texts: pageData.h1Texts },
        h2s: pageData.h2Texts,
        imagesWithoutAlt: pageData.imagesWithoutAlt,
        totalImages: pageData.totalImages,
        canonicalUrl: pageData.canonicalUrl,
        internalLinks: pageData.internalLinks,
        brokenLinks,
        schemaTypesDetected: pageData.schemaTypes,
        loadTimeMs,
        hasMobileViewport: pageData.hasMobileViewport,
        openGraphTags: pageData.openGraphTags,
        issues: [],
      }

      // Run issue checks
      pageAudit.issues = this.detectIssues(pageAudit)

      return pageAudit
    } catch (err) {
      // Return a minimal error page audit
      return {
        url,
        statusCode: statusCode || 0,
        redirectChain,
        title: { text: '', length: 0, hasTargetKeyword: false },
        metaDescription: { text: '', length: 0, hasTargetKeyword: false },
        h1: { count: 0, texts: [] },
        h2s: [],
        imagesWithoutAlt: 0,
        totalImages: 0,
        canonicalUrl: null,
        internalLinks: [],
        brokenLinks: [],
        schemaTypesDetected: [],
        loadTimeMs: Date.now() - startTime,
        hasMobileViewport: false,
        openGraphTags: {},
        issues: [
          {
            type: 'page-load-error',
            severity: 'critical',
            description: `Failed to load page: ${String(err).slice(0, 200)}`,
            recommendation: 'Check that the URL is accessible and returns a valid HTTP response.',
          },
        ],
      }
    } finally {
      await page.close()
    }
  }

  private async checkBrokenLinks(
    context: Awaited<ReturnType<Browser['newContext']>>,
    urls: string[]
  ): Promise<string[]> {
    const broken: string[] = []
    for (const url of urls) {
      try {
        const page = await context.newPage()
        try {
          const response = await page.goto(url, {
            timeout: 5000,
            waitUntil: 'domcontentloaded',
          })
          if (response && response.status() >= 400) {
            broken.push(url)
          }
        } finally {
          await page.close()
        }
      } catch {
        broken.push(url)
      }
    }
    return broken
  }

  private async runSiteChecks(
    context: Awaited<ReturnType<Browser['newContext']>>,
    siteUrl: string
  ): Promise<SiteAudit['siteChecks']> {
    const checks = {
      hasSitemap: false,
      sitemapValid: false,
      hasRobotsTxt: false,
      httpsEverywhere: siteUrl.startsWith('https://'),
      wwwRedirectConsistent: false,
    }

    // Check sitemap.xml
    try {
      const page = await context.newPage()
      const resp = await page.goto(`${siteUrl}/sitemap.xml`, { timeout: 8000, waitUntil: 'load' })
      if (resp && resp.status() === 200) {
        checks.hasSitemap = true
        const content = await page.content()
        checks.sitemapValid = content.includes('<urlset') || content.includes('<sitemapindex')
      }
      await page.close()
    } catch {
      // sitemap not found
    }

    // Check robots.txt
    try {
      const page = await context.newPage()
      const resp = await page.goto(`${siteUrl}/robots.txt`, { timeout: 8000, waitUntil: 'load' })
      if (resp && resp.status() === 200) {
        checks.hasRobotsTxt = true
      }
      await page.close()
    } catch {
      // robots.txt not found
    }

    // Check www redirect consistency
    try {
      const parsed = new URL(siteUrl)
      const hasWww = parsed.hostname.startsWith('www.')
      const altHost = hasWww
        ? siteUrl.replace('www.', '')
        : siteUrl.replace('://', '://www.')

      const page = await context.newPage()
      const resp = await page.goto(altHost, { timeout: 8000, waitUntil: 'domcontentloaded' })
      if (resp) {
        const finalUrl = resp.url()
        const finalHasWww = new URL(finalUrl).hostname.startsWith('www.')
        checks.wwwRedirectConsistent = finalHasWww === hasWww
      }
      await page.close()
    } catch {
      // Cannot determine
    }

    return checks
  }

  // -------------------------------------------------------------------------
  // Private — issue detection
  // -------------------------------------------------------------------------

  private detectIssues(page: PageAudit): AuditIssue[] {
    const issues: AuditIssue[] = []

    // Missing title
    if (!page.title.text) {
      issues.push({
        type: 'missing-title',
        severity: 'critical',
        description: `Page has no <title> tag.`,
        recommendation: 'Add a unique, descriptive title tag (50–60 characters) to every page.',
        fixContent: `<title>Your Page Title | Brand Name</title>`,
      })
    } else if (page.title.length < 30) {
      issues.push({
        type: 'title-too-short',
        severity: 'high',
        description: `Title is only ${page.title.length} characters ("${page.title.text}").`,
        recommendation: 'Expand the title to 50–60 characters to maximise SERP real estate.',
        fixContent: `<title>${page.title.text} | Your Brand</title>`,
      })
    } else if (page.title.length > 60) {
      issues.push({
        type: 'title-too-long',
        severity: 'medium',
        description: `Title is ${page.title.length} characters — will be truncated in SERPs.`,
        recommendation: 'Shorten the title to 50–60 characters.',
      })
    }

    // Missing meta description
    if (!page.metaDescription.text) {
      issues.push({
        type: 'missing-meta-description',
        severity: 'high',
        description: `Page has no meta description.`,
        recommendation: 'Add a compelling meta description (140–160 characters) with target keyword.',
        fixContent: `<meta name="description" content="Your compelling description here (140-160 chars).">`,
      })
    } else if (page.metaDescription.length < 70) {
      issues.push({
        type: 'meta-description-too-short',
        severity: 'medium',
        description: `Meta description is only ${page.metaDescription.length} characters.`,
        recommendation: 'Expand meta description to 140–160 characters for maximum CTR.',
      })
    } else if (page.metaDescription.length > 160) {
      issues.push({
        type: 'meta-description-too-long',
        severity: 'low',
        description: `Meta description is ${page.metaDescription.length} characters — may be truncated.`,
        recommendation: 'Trim meta description to 140–160 characters.',
      })
    }

    // H1 issues
    if (page.h1.count === 0) {
      issues.push({
        type: 'missing-h1',
        severity: 'high',
        description: `Page has no H1 heading.`,
        recommendation: 'Add a single H1 tag containing the primary target keyword for this page.',
        fixContent: `<h1>Your Primary Keyword Here</h1>`,
      })
    } else if (page.h1.count > 1) {
      issues.push({
        type: 'multiple-h1',
        severity: 'medium',
        description: `Page has ${page.h1.count} H1 headings: ${page.h1.texts.join(', ')}.`,
        recommendation: 'Use exactly one H1 per page for clear topical hierarchy.',
      })
    }

    // Images without alt text
    if (page.imagesWithoutAlt > 0) {
      const severity = page.imagesWithoutAlt > 3 ? 'high' : 'medium'
      issues.push({
        type: 'images-missing-alt',
        severity,
        description: `${page.imagesWithoutAlt} of ${page.totalImages} images are missing alt text.`,
        recommendation:
          'Add descriptive alt text to every image for accessibility and image SEO.',
        fixContent: `<img src="..." alt="Descriptive text about the image">`,
      })
    }

    // Missing canonical
    if (!page.canonicalUrl) {
      issues.push({
        type: 'missing-canonical',
        severity: 'medium',
        description: `Page has no canonical URL tag.`,
        recommendation: 'Add a self-referencing canonical tag to prevent duplicate content issues.',
        fixContent: `<link rel="canonical" href="${page.url}">`,
      })
    }

    // Missing mobile viewport
    if (!page.hasMobileViewport) {
      issues.push({
        type: 'missing-mobile-viewport',
        severity: 'critical',
        description: `Page is missing the mobile viewport meta tag.`,
        recommendation: 'Add viewport meta tag for mobile-first indexing compliance.',
        fixContent: `<meta name="viewport" content="width=device-width, initial-scale=1">`,
      })
    }

    // Missing Open Graph
    if (!page.openGraphTags['og:title']) {
      issues.push({
        type: 'missing-og-tags',
        severity: 'low',
        description: `Page is missing Open Graph tags (og:title not found).`,
        recommendation: 'Add og:title, og:description, og:image, and og:url for social sharing.',
        fixContent: `<meta property="og:title" content="${page.title.text}">\n<meta property="og:description" content="${page.metaDescription.text}">\n<meta property="og:url" content="${page.url}">`,
      })
    }

    // No schema markup
    if (page.schemaTypesDetected.length === 0) {
      issues.push({
        type: 'missing-schema-markup',
        severity: 'medium',
        description: `Page has no JSON-LD structured data.`,
        recommendation:
          'Add relevant schema markup (LocalBusiness, Service, FAQPage) to improve rich results eligibility.',
      })
    }

    // Broken links
    if (page.brokenLinks.length > 0) {
      issues.push({
        type: 'broken-internal-links',
        severity: 'high',
        description: `Page has ${page.brokenLinks.length} broken internal link(s): ${page.brokenLinks.slice(0, 3).join(', ')}`,
        recommendation: 'Fix or remove broken links to preserve crawl budget and user experience.',
      })
    }

    // Slow load time
    if (page.loadTimeMs > 3000) {
      const severity = page.loadTimeMs > 6000 ? 'high' : 'medium'
      issues.push({
        type: 'slow-page-load',
        severity,
        description: `Page took ${page.loadTimeMs}ms to load (target: <3000ms).`,
        recommendation:
          'Optimize images, enable caching, use a CDN, and defer non-critical scripts.',
      })
    }

    // HTTP status errors
    if (page.statusCode >= 400) {
      issues.push({
        type: 'page-error-status',
        severity: 'critical',
        description: `Page returned HTTP ${page.statusCode}.`,
        recommendation:
          page.statusCode === 404
            ? 'Fix or redirect this URL. 404 pages waste crawl budget.'
            : 'Investigate and resolve the server error.',
      })
    }

    return issues
  }

  private calculateHealthScore(issues: AuditIssue[]): number {
    let score = 100
    for (const issue of issues) {
      switch (issue.severity) {
        case 'high':
          score -= 10
          break
        case 'medium':
          score -= 5
          break
        case 'low':
          score -= 2
          break
        // critical: flagged but no deduction (per spec)
      }
    }
    return Math.max(0, score)
  }

  private guessTargetKeyword(pageUrl: string, siteRoot: string): string {
    try {
      const path = new URL(pageUrl).pathname
      if (path === '/' || path === '') return ''
      const segments = path.split('/').filter(Boolean)
      const last = segments[segments.length - 1] ?? ''
      return last.replace(/-/g, ' ').replace(/_/g, ' ')
    } catch {
      return ''
    }
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }
}
