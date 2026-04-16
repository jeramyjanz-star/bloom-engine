import { loadClientConfig } from '@/src/lib/client-loader'
import { supabaseAdmin } from '@/src/lib/supabase'

export interface SchemaBundle {
  localBusiness: object
  services: object[]
  faqPage: object
  breadcrumbList: object
  website: object
  generatedAt: string
}

interface FAQQAPair {
  question: string
  answer: string
}

export class SchemaEngine {
  /**
   * Generate a complete JSON-LD schema bundle for the given client.
   * If faqQAPairs is provided those are used verbatim for the FAQPage;
   * otherwise the client's aeoQueries are used as questions with empty answers.
   */
  async generateAll(
    clientId: string,
    faqQAPairs?: FAQQAPair[]
  ): Promise<SchemaBundle> {
    const config = await loadClientConfig(clientId)

    const localBusiness = this.generateLocalBusiness(config)
    const services = this.generateServices(config)
    const faqPage = this.generateFAQPage(config, faqQAPairs)
    const breadcrumbList = this.generateBreadcrumbList(config)
    const website = this.generateWebSite(config)

    return {
      localBusiness,
      services,
      faqPage,
      breadcrumbList,
      website,
      generatedAt: new Date().toISOString(),
    }
  }

  // ---------------------------------------------------------------------------
  // Private generators
  // ---------------------------------------------------------------------------

  private generateLocalBusiness(config: ReturnType<typeof Object.create>): object {
    return {
      '@context': 'https://schema.org',
      '@type': ['LocalBusiness', 'Florist'],
      '@id': `${config.url}/#business`,
      name: config.name,
      url: config.url,
      description: `${config.name} is a ${config.brand.voice} florist serving ${config.location.city}, ${config.location.state} and surrounding communities.`,
      priceRange: config.gmb.priceRange,
      address: {
        '@type': 'PostalAddress',
        addressLocality: config.location.city,
        addressRegion: config.location.state,
        addressCountry: 'US',
      },
      geo: {
        '@type': 'GeoCoordinates',
        // Orange County, CA approximate centroid
        latitude: 33.7175,
        longitude: -117.8311,
      },
      areaServed: (config.location.serviceCities as string[]).map((city: string) => ({
        '@type': 'City',
        name: city,
      })),
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '09:00',
          closes: '18:00',
        },
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Saturday'],
          opens: '09:00',
          closes: '16:00',
        },
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Sunday'],
          opens: '10:00',
          closes: '14:00',
        },
      ],
      sameAs: [
        `https://www.google.com/maps/search/${encodeURIComponent(config.name)}`,
      ],
    }
  }

  private generateServices(config: ReturnType<typeof Object.create>): object[] {
    return (config.services as string[]).map((serviceName: string) => ({
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': `${config.url}/#service-${serviceName.toLowerCase().replace(/\s+/g, '-')}`,
      name: serviceName,
      provider: {
        '@type': 'LocalBusiness',
        '@id': `${config.url}/#business`,
        name: config.name,
      },
      areaServed: (config.location.serviceCities as string[]).map((city: string) => ({
        '@type': 'City',
        name: city,
      })),
      url: `${config.url}/services/${serviceName.toLowerCase().replace(/\s+/g, '-')}`,
    }))
  }

  private generateFAQPage(
    config: ReturnType<typeof Object.create>,
    faqQAPairs?: FAQQAPair[]
  ): object {
    let mainEntity: object[]

    if (faqQAPairs && faqQAPairs.length > 0) {
      mainEntity = faqQAPairs.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: answer,
        },
      }))
    } else {
      mainEntity = (config.aeoQueries as string[]).map((query: string) => ({
        '@type': 'Question',
        name: query,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `For information about "${query}", please contact ${config.name} directly at ${config.url}.`,
        },
      }))
    }

    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${config.url}/#faq`,
      mainEntity,
    }
  }

  private generateBreadcrumbList(config: ReturnType<typeof Object.create>): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      '@id': `${config.url}/#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: config.url,
        },
      ],
    }
  }

  private generateWebSite(config: ReturnType<typeof Object.create>): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${config.url}/#website`,
      name: config.name,
      url: config.url,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${config.url}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  /**
   * Save each schema type in the bundle to bloom_engine.schema_registry.
   * Upserts on (client_id, schema_type) so re-running is idempotent.
   */
  async saveToDatabase(clientId: string, bundle: SchemaBundle): Promise<void> {
    const rows = [
      {
        client_id: clientId,
        schema_type: 'LocalBusiness',
        schema_data: bundle.localBusiness,
        generated_at: bundle.generatedAt,
      },
      ...bundle.services.map((svc, idx) => ({
        client_id: clientId,
        schema_type: `Service_${idx}`,
        schema_data: svc,
        generated_at: bundle.generatedAt,
      })),
      {
        client_id: clientId,
        schema_type: 'FAQPage',
        schema_data: bundle.faqPage,
        generated_at: bundle.generatedAt,
      },
      {
        client_id: clientId,
        schema_type: 'BreadcrumbList',
        schema_data: bundle.breadcrumbList,
        generated_at: bundle.generatedAt,
      },
      {
        client_id: clientId,
        schema_type: 'WebSite',
        schema_data: bundle.website,
        generated_at: bundle.generatedAt,
      },
    ]

    const { error } = await supabaseAdmin
      .schema('bloom_engine')
      .from('schema_registry')
      .upsert(rows, { onConflict: 'client_id,schema_type' })

    if (error) {
      throw new Error(
        `Failed to save schema bundle for client "${clientId}" to database: ${error.message}`
      )
    }
  }

  // ---------------------------------------------------------------------------
  // Install guide
  // ---------------------------------------------------------------------------

  /**
   * Generate a markdown guide explaining how to embed the schema bundle
   * into a Next.js 14 app/layout.tsx using next/script or <script> tags.
   */
  generateInstallGuide(clientId: string, bundle: SchemaBundle): string {
    const scriptTag = (label: string, data: object): string =>
      `{/* ${label} */}\n<Script\n  id="schema-${label.toLowerCase().replace(/\s+/g, '-')}"\n  type="application/ld+json"\n  dangerouslySetInnerHTML={{\n    __html: JSON.stringify(${JSON.stringify(data, null, 2)})\n  }}\n/>`

    const serviceScripts = bundle.services
      .map((svc, idx) => scriptTag(`Service ${idx + 1}`, svc))
      .join('\n\n')

    return `# Schema Install Guide — ${clientId}

Generated at: ${bundle.generatedAt}

## Overview

This guide shows how to add the JSON-LD schema bundle to your Next.js 14 project.

## 1. Install dependency (already included in Next.js)

No additional packages required. Use \`next/script\` for inline JSON-LD.

## 2. Add to \`app/layout.tsx\`

\`\`\`tsx
import Script from 'next/script'

// Inside your <head> or at the end of <body> in RootLayout:

${scriptTag('LocalBusiness', bundle.localBusiness)}

${serviceScripts}

${scriptTag('FAQPage', bundle.faqPage)}

${scriptTag('BreadcrumbList', bundle.breadcrumbList)}

${scriptTag('WebSite', bundle.website)}
\`\`\`

## 3. Alternatively, load from the pre-generated bundle file

\`\`\`tsx
import schemaBundle from '@/public/clients/${clientId}/schema-bundle.json'

// Then render each schema type using Script tags as above.
\`\`\`

## 4. Validate

After deploying, validate your structured data at:
- https://search.google.com/test/rich-results
- https://validator.schema.org/

## Schema types included

| Type | Description |
|------|-------------|
| LocalBusiness (Florist) | Core business entity with address, hours, area served |
| Service × ${bundle.services.length} | Individual service offerings |
| FAQPage | AEO-optimised questions and answers |
| BreadcrumbList | Site navigation breadcrumb |
| WebSite | Site-level with SearchAction |
`
  }
}
