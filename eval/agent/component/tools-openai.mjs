import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))

export async function catalogToOpenAiTools() {
  const catalog = JSON.parse(await readFile(path.join(DIR, 'tool-catalog.json'), 'utf8'))
  return catalog.tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))
}
