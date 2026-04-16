#!/usr/bin/env ts-node
/**
 * Seed BLOOM ENGINE database with FBOC as first client
 * Run: npx ts-node --project tsconfig.json scripts/seed-db.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

async function runSQL(sql: string): Promise<void> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    },
    body: JSON.stringify({ sql })
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`SQL execution failed: ${text}`)
  }
}

async function createSchema(): Promise<void> {
  console.log('📦 Creating bloom_engine schema and tables...')

  const schemaSQL = fs.readFileSync(
    path.join(process.cwd(), 'scripts', 'create-schema.sql'),
    'utf-8'
  )

  // Execute via Supabase SQL editor API
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'return=representation'
    }
  })

  // Use direct pg connection via service role
  const stmts = schemaSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  for (const stmt of stmts) {
    const { error } = await supabase.rpc('exec', { sql: stmt + ';' }).single()
    if (error && !error.message.includes('already exists')) {
      console.warn(`  ⚠️  ${error.message.substring(0, 80)}`)
    }
  }

  console.log('✅ Schema created')
}

async function seedFBOC(): Promise<void> {
  console.log('🌸 Seeding FBOC as first client...')

  const configPath = path.join(process.cwd(), 'clients', 'fboc', 'config.json')
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

  const { error } = await supabase
    .schema('bloom_engine')
    .from('clients')
    .upsert({
      id: 'fboc',
      name: 'French Blooms OC',
      url: 'https://frenchbloomsoc.com',
      config,
      active: true
    }, { onConflict: 'id' })

  if (error) {
    console.error('❌ Failed to seed FBOC:', error.message)
    throw error
  }

  console.log('✅ FBOC seeded successfully')
}

async function main(): Promise<void> {
  console.log('\n🌿 BLOOM ENGINE — Database Setup\n')

  try {
    await createSchema()
    await seedFBOC()
    console.log('\n✨ Database ready. Run the app: npm run dev\n')
  } catch (err) {
    console.error('\n❌ Setup failed:', err)
    console.log('\n💡 Tip: Run the SQL manually in Supabase SQL editor:')
    console.log('   https://supabase.com/dashboard/project/etzonmhbrmdiwblheesg/sql/new')
    console.log('   Paste contents of: scripts/create-schema.sql')
    process.exit(1)
  }
}

main()
