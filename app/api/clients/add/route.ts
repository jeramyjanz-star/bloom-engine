import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { supabaseAdmin } from '@/src/lib/supabase'

interface AddClientBody {
  clientId: string
  businessName: string
  websiteUrl: string
  industry: string
  city: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { clientId, businessName, websiteUrl, industry, city } =
    body as AddClientBody

  // Validate required fields
  if (!clientId || !businessName || !websiteUrl || !industry || !city) {
    return NextResponse.json(
      { error: 'All fields are required: clientId, businessName, websiteUrl, industry, city' },
      { status: 400 }
    )
  }

  // Validate clientId is a valid slug
  if (!/^[a-z0-9-]+$/.test(clientId)) {
    return NextResponse.json(
      { error: 'clientId must be lowercase alphanumeric with hyphens only' },
      { status: 400 }
    )
  }

  // Validate URL
  try {
    new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`)
  } catch {
    return NextResponse.json({ error: 'Invalid websiteUrl' }, { status: 400 })
  }

  const normalizedUrl = websiteUrl.startsWith('http')
    ? websiteUrl
    : `https://${websiteUrl}`

  const clientsDir = path.join(process.cwd(), 'clients')
  const clientDir = path.join(clientsDir, clientId)

  // Check if client already exists
  try {
    await fs.access(clientDir)
    return NextResponse.json(
      { error: `Client "${clientId}" already exists` },
      { status: 409 }
    )
  } catch {
    // Directory does not exist — proceed
  }

  // Step 1: Create directory structure
  try {
    await fs.mkdir(clientDir, { recursive: true })
    await fs.mkdir(path.join(clientDir, 'audit'), { recursive: true })
    await fs.mkdir(path.join(clientDir, 'content'), { recursive: true })
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to create client directory: ${String(err)}` },
      { status: 500 }
    )
  }

  // Step 2: Write config.json
  const config = {
    id: clientId,
    name: businessName,
    url: normalizedUrl,
    industry,
    location: {
      city,
      state: '',
      serviceCities: [city],
    },
    brand: {
      colors: { primary: '#000000', secondary: '#FFFFFF', dark: '#111111' },
      fonts: { display: 'Playfair Display', body: 'Inter' },
      voice: 'professional, warm, authoritative',
    },
    services: [],
    targetKeywords: [],
    aeoQueries: [],
    gmb: {
      category: industry,
      additionalCategories: [],
      priceRange: '$$',
    },
    owner: {
      name: businessName,
      email: '',
    },
  }

  try {
    await fs.writeFile(
      path.join(clientDir, 'config.json'),
      JSON.stringify(config, null, 2),
      'utf-8'
    )
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to write config.json: ${String(err)}` },
      { status: 500 }
    )
  }

  // Step 3: Insert into Supabase bloom_engine.clients
  const { error: dbError } = await supabaseAdmin
    .schema('bloom_engine')
    .from('clients')
    .insert({
      id: clientId,
      name: businessName,
      url: normalizedUrl,
      industry,
      city,
    })

  if (dbError) {
    // Non-fatal if table doesn't exist yet — log and continue
    console.warn(`[clients/add] DB insert warning: ${dbError.message}`)
  }

  return NextResponse.json({
    success: true,
    clientId,
    message: `Client "${businessName}" created successfully`,
    configPath: `/clients/${clientId}/config.json`,
  })
}
