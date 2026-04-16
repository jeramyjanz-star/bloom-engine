import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabase'
import { loadClientConfig } from '@/src/lib/client-loader'

interface SchemaRegistryRow {
  schema_type: string
  schema_data: object
  generated_at: string
}

interface ValidationResult {
  schemaType: string
  valid: boolean
  hasContext: boolean
  hasType: boolean
  generatedAt: string
  issues: string[]
}

function validateSchemaRow(row: SchemaRegistryRow): ValidationResult {
  const data = row.schema_data as Record<string, unknown>
  const issues: string[] = []

  const hasContext =
    typeof data['@context'] === 'string' && data['@context'].includes('schema.org')
  const hasType =
    typeof data['@type'] === 'string' ||
    (Array.isArray(data['@type']) && (data['@type'] as unknown[]).length > 0)

  if (!hasContext) {
    issues.push('Missing or invalid @context (expected https://schema.org)')
  }
  if (!hasType) {
    issues.push('Missing or invalid @type')
  }

  return {
    schemaType: row.schema_type,
    valid: issues.length === 0,
    hasContext,
    hasType,
    generatedAt: row.generated_at,
    issues,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { clientId: string } }
): Promise<NextResponse> {
  const { clientId } = params

  // Verify client exists
  try {
    await loadClientConfig(clientId)
  } catch {
    return NextResponse.json(
      { error: `Client "${clientId}" not found` },
      { status: 404 }
    )
  }

  // Fetch all schema rows for this client
  const { data: rows, error } = await supabaseAdmin
    .schema('bloom_engine')
    .from('schema_registry')
    .select('schema_type, schema_data, generated_at')
    .eq('client_id', clientId)
    .order('schema_type', { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: `Database error: ${error.message}` },
      { status: 500 }
    )
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json(
      {
        clientId,
        status: 'no_schemas',
        message: `No schemas found for client "${clientId}". Run POST /api/${clientId}/schema/generate first.`,
        results: [],
      },
      { status: 200 }
    )
  }

  const results: ValidationResult[] = (rows as SchemaRegistryRow[]).map(validateSchemaRow)

  const allValid = results.every((r) => r.valid)
  const totalSchemas = results.length
  const validCount = results.filter((r) => r.valid).length

  return NextResponse.json(
    {
      clientId,
      status: allValid ? 'valid' : 'invalid',
      summary: {
        totalSchemas,
        validCount,
        invalidCount: totalSchemas - validCount,
      },
      results,
    },
    { status: 200 }
  )
}
