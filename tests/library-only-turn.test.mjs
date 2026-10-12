import test from 'node:test'
import assert from 'node:assert/strict'
import {
  beginLibraryOnlyTurn,
  endLibraryOnlyTurn,
  filterToolsForLibraryOnly,
  isLibraryOnlyTurn,
  narrowLibraryOnlyRound,
} from '../packages/agent/dist/library-only-turn.js'

test('library-only turn keeps document retrieval and drops other tools', () => {
  const tools = [
    { function: { name: 'query_data' } },
    { function: { name: 'search_library' } },
    { function: { name: 'web_search' } },
    { function: { name: 'read_document' } },
  ]
  assert.equal(narrowLibraryOnlyRound('s1', ['query_data', 'search_library'], tools), null)
  beginLibraryOnlyTurn('s1')
  try {
    assert.equal(isLibraryOnlyTurn('s1'), true)
    assert.equal(isLibraryOnlyTurn('s2'), false)
    const narrowed = narrowLibraryOnlyRound('s1', ['query_data', 'search_library', 'read_document'], tools)
    assert.deepEqual(narrowed?.activeNames, ['search_library', 'read_document'])
    assert.deepEqual(filterToolsForLibraryOnly(tools).map(tool => tool.function.name), ['search_library', 'read_document'])
  } finally {
    endLibraryOnlyTurn('s1')
  }
  assert.equal(isLibraryOnlyTurn('s1'), false)
})
