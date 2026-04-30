/**
 * Test script: verifies team CRUD API endpoints.
 * Run with: doppler run --project anchor-bloom-engine --config prd -- npx ts-node --project tsconfig.json scripts/test-team-crud.ts
 *
 * Requires: NEXT_PUBLIC_APP_URL set to a running dev or production instance.
 */

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const TEST_EMAIL = 'test+crud@example.com'

let passed = 0
let failed = 0
let createdMemberId: string | null = null

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.error(`  ❌ FAIL: ${label}`)
    failed++
  }
}

async function apiCall(method: string, path: string, body?: unknown, userEmail?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (userEmail) headers['x-user-email'] = userEmail

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  let data: unknown
  try { data = await res.json() } catch { data = {} }
  return { status: res.status, data }
}

async function runTests() {
  console.log('\n=== test-team-crud.ts ===\n')
  console.log(`Target: ${BASE_URL}\n`)

  // ----------------------------------------------------------------
  // Test 1: GET /api/team — list team members
  // ----------------------------------------------------------------
  console.log('Test 1: GET /api/team returns member list')
  try {
    const { status, data } = await apiCall('GET', '/api/team')
    assert(status === 200, `Status 200 (got: ${status})`)
    const d = data as { members?: unknown[] }
    assert(Array.isArray(d.members), 'Response has members array')
  } catch (err) {
    console.error('  ❌ Test 1 threw:', err)
    failed++
  }

  // ----------------------------------------------------------------
  // Test 2: POST /api/team/invite — create test member
  // ----------------------------------------------------------------
  console.log('\nTest 2: POST /api/team/invite creates member row')
  try {
    const { status, data } = await apiCall('POST', '/api/team/invite', {
      email: TEST_EMAIL,
      role: 'editor',
      inviterEmail: 'jocelyn@frenchbloomsoc.com',
    })
    assert(status === 201, `Status 201 (got: ${status})`)
    const d = data as { member?: { id?: string; email?: string; role?: string } }
    assert(d.member?.email === TEST_EMAIL, `Member email matches (got: ${d.member?.email})`)
    assert(d.member?.role === 'editor', `Member role is editor (got: ${d.member?.role})`)
    createdMemberId = d.member?.id ?? null
    assert(!!createdMemberId, `Member has ID (got: ${createdMemberId})`)
  } catch (err) {
    console.error('  ❌ Test 2 threw:', err)
    failed++
  }

  // ----------------------------------------------------------------
  // Test 3: POST /api/team/invite — duplicate returns 409
  // ----------------------------------------------------------------
  console.log('\nTest 3: duplicate invite returns 409')
  try {
    const { status } = await apiCall('POST', '/api/team/invite', {
      email: TEST_EMAIL,
      role: 'editor',
    })
    assert(status === 409, `Status 409 for duplicate (got: ${status})`)
  } catch (err) {
    console.error('  ❌ Test 3 threw:', err)
    failed++
  }

  // ----------------------------------------------------------------
  // Test 4: DELETE /api/team/[id] without auth returns 401
  // ----------------------------------------------------------------
  if (createdMemberId) {
    console.log('\nTest 4: DELETE without x-user-email returns 401')
    try {
      const { status } = await apiCall('DELETE', `/api/team/${createdMemberId}`)
      assert(status === 401, `Status 401 (got: ${status})`)
    } catch (err) {
      console.error('  ❌ Test 4 threw:', err)
      failed++
    }

    // ----------------------------------------------------------------
    // Test 5: DELETE with non-admin auth returns 403
    // ----------------------------------------------------------------
    console.log('\nTest 5: DELETE with non-admin returns 403')
    try {
      const { status } = await apiCall('DELETE', `/api/team/${createdMemberId}`, undefined, TEST_EMAIL)
      assert(status === 403, `Status 403 for non-admin (got: ${status})`)
    } catch (err) {
      console.error('  ❌ Test 5 threw:', err)
      failed++
    }

    // ----------------------------------------------------------------
    // Test 6: DELETE with admin auth succeeds
    // ----------------------------------------------------------------
    console.log('\nTest 6: DELETE with admin auth removes member')
    try {
      const { status } = await apiCall('DELETE', `/api/team/${createdMemberId}`, undefined, 'jeramyjanz@gmail.com')
      assert(status === 200, `Status 200 (got: ${status})`)
    } catch (err) {
      console.error('  ❌ Test 6 threw:', err)
      failed++
    }
  }

  // ----------------------------------------------------------------
  // Test 7: Cannot remove owner
  // ----------------------------------------------------------------
  console.log('\nTest 7: Cannot remove owner')
  try {
    // Get the owner member ID
    const { data } = await apiCall('GET', '/api/team')
    const d = data as { members?: Array<{ id: string; role: string; email: string }> }
    const owner = d.members?.find(m => m.role === 'owner')
    if (!owner) {
      console.log('  ⚠️  No owner found in team — skipping owner removal test')
    } else {
      const { status } = await apiCall('DELETE', `/api/team/${owner.id}`, undefined, 'jeramyjanz@gmail.com')
      assert(status === 403, `Status 403 for owner removal (got: ${status})`)
    }
  } catch (err) {
    console.error('  ❌ Test 7 threw:', err)
    failed++
  }

  // ----------------------------------------------------------------
  // Summary
  // ----------------------------------------------------------------
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(err => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
