import { refreshAccountContext } from '../src/context/store.js'

const accountDir = process.argv[2] || 'data/accounts/canva'

console.log(`Rebuilding context for ${accountDir}...`)
const context = await refreshAccountContext(accountDir)
console.log('Context rebuilt!')
console.log('Notion pages:', context.notion?.relatedPages?.length || 0)
