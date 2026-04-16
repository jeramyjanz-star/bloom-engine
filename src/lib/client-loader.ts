import fs from 'fs/promises'
import path from 'path'

export interface ClientConfig {
  id: string
  name: string
  url: string
  industry: string
  location: {
    city: string
    state: string
    serviceCities: string[]
  }
  brand: {
    colors: {
      primary: string
      secondary: string
      dark: string
    }
    fonts: {
      display: string
      body: string
    }
    voice: string
  }
  services: string[]
  targetKeywords: string[]
  aeoQueries: string[]
  gmb: {
    category: string
    additionalCategories: string[]
    priceRange: string
  }
  owner: {
    name: string
    email: string
  }
}

/**
 * Load the config.json for a single client by ID.
 * Looks in <project-root>/clients/[clientId]/config.json
 */
export async function loadClientConfig(clientId: string): Promise<ClientConfig> {
  const configPath = path.join(process.cwd(), 'clients', clientId, 'config.json')

  let raw: string
  try {
    raw = await fs.readFile(configPath, 'utf-8')
  } catch (err) {
    throw new Error(
      `Client config not found for "${clientId}" at ${configPath}: ${String(err)}`
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(
      `Failed to parse config.json for client "${clientId}": ${String(err)}`
    )
  }

  // Basic runtime validation of required top-level fields
  const config = parsed as ClientConfig
  const required: Array<keyof ClientConfig> = [
    'id',
    'name',
    'url',
    'industry',
    'location',
    'brand',
    'services',
    'targetKeywords',
    'aeoQueries',
    'gmb',
    'owner',
  ]

  for (const key of required) {
    if (config[key] === undefined || config[key] === null) {
      throw new Error(
        `Client config for "${clientId}" is missing required field: "${key}"`
      )
    }
  }

  return config
}

/**
 * List all clients that have a config.json under <project-root>/clients/
 */
export async function listClients(): Promise<ClientConfig[]> {
  const clientsDir = path.join(process.cwd(), 'clients')

  let entries: string[]
  try {
    const dirents = await fs.readdir(clientsDir, { withFileTypes: true })
    entries = dirents
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch (err) {
    throw new Error(`Failed to read clients directory at ${clientsDir}: ${String(err)}`)
  }

  const configs: ClientConfig[] = []

  for (const entry of entries) {
    const configPath = path.join(clientsDir, entry, 'config.json')
    try {
      await fs.access(configPath)
      const config = await loadClientConfig(entry)
      configs.push(config)
    } catch {
      // Skip directories that do not have a config.json
    }
  }

  return configs
}
