import { isRejectText, searchMatches, universeEntities } from './fixture-data.mjs'

function isConfirmed(args) {
  return args?.confirmed === true || args?.confirmed === 'true'
}

function entityCount(args) {
  return Array.isArray(args?.entities) ? args.entities.length : 0
}

export function initFixtureState(evalCase) {
  const ctx = evalCase?.context ?? {}
  return {
    lastTool: '',
    lastStatus: '',
    scriptIndex: 0,
    datasetSeq: 1,
    lastDatasetId: ctx.datasets?.[0]?.id ?? '',
    lastProposalId: ctx.proposals?.[0]?.id ?? '',
    lastWidgetId: ctx.widgets?.[0]?.id ?? '',
    userConfirm: false,
    calledTools: new Set(),
  }
}

function nextDatasetId(state) {
  const id = `research-ds-eval-${state.datasetSeq}`
  state.datasetSeq += 1
  state.lastDatasetId = id
  return id
}

function stubQueryData(args, state) {
  const count = entityCount(args)
  if (count > 3 && !isConfirmed(args)) {
    state.lastStatus = 'plan_preview'
    return {
      ok: true,
      status: 'plan_preview',
      requires_user_confirm: true,
      query: { entities: args.entities, metric: args.metric, start: args.start, end: args.end },
      hint: '等待用户确认后再取数；须再次调用 query_data 并设置 confirmed 为 true。',
    }
  }
  state.lastStatus = 'dataset'
  return {
    ok: true,
    status: 'ok',
    datasetId: nextDatasetId(state),
    metric: args.metric ?? '',
    entities: count,
    view: { recommended: args.metric === 'kline' ? 'candlestick' : 'grouped_bar' },
  }
}

function confirmReply(label) {
  return { selected_labels: [label], selected_ids: ['confirm'] }
}

function rejectReply(label) {
  return { cancelled: true, selected_labels: [label], selected_ids: ['reject'] }
}

export function takeAskUserScript(evalCase, state) {
  const item = (evalCase.user_script ?? [])[state.scriptIndex]
  if (!item) return rejectReply('')
  state.scriptIndex += 1
  if (isRejectText(item.content)) return rejectReply(item.content)
  return confirmReply(item.content)
}

export function stubTool(call, evalCase, state) {
  const args = call?.args ?? {}
  const name = call?.name
  if (name === 'query_data') return stubQueryData(args, state)
  if (name === 'resolve_industry_universe') {
    const names = universeEntities(args.industry)
    state.lastStatus = 'universe'
    return {
      ok: true,
      industry: args.industry,
      default_n: names.length,
      default_entities: names,
      ask_user_options: names.map((label) => ({ id: label, label })),
      next: 'ask_user',
    }
  }
  if (name === 'ask_user') {
    state.lastStatus = 'ask_user'
    return { ok: true, ...takeAskUserScript(evalCase, state) }
  }
  if (name === 'propose_widget') {
    state.lastProposalId = state.lastProposalId || 'prop-eval-1'
    state.lastStatus = 'propose'
    return { ok: true, proposalId: state.lastProposalId, datasetId: args.datasetId || state.lastDatasetId }
  }
  if (name === 'refine_dataset') {
    const parent = args.datasetId || state.lastDatasetId || 'research-ds-1'
    state.lastDatasetId = `${parent}-r${state.datasetSeq}`
    state.datasetSeq += 1
    state.lastStatus = 'refine'
    return { ok: true, datasetId: state.lastDatasetId, parentDatasetId: parent }
  }
  return stubMutating(name, args, state)
}

function stubMutating(name, args, state) {
  if (name === 'create_widget') {
    state.lastWidgetId = 'w-eval-1'
    return { ok: true, widgetId: state.lastWidgetId }
  }
  if (name === 'update_proposal') return { ok: true, proposalId: args.proposalId || state.lastProposalId }
  if (name === 'update_widget') return { ok: true, widgetId: args.id || state.lastWidgetId }
  if (name === 'get_instrument_quotes') return { ok: true, symbol: args.symbol || args.code || 'quoted' }
  if (name === 'search_instruments') {
    return { ok: true, matches: searchMatches(args.keyword ?? args.query ?? args.symbol) }
  }
  if (name === 'get_instrument_financials' || name === 'get_instrument_snapshot' || name === 'get_instrument_profile') {
    return { ok: true, symbol: args.symbol || args.code || '' }
  }
  if (name === 'web_search' || name === 'create_canvas') {
    return { ok: false, error: '本路径不要使用该工具' }
  }
  return { ok: false, error: `评测夹具未实现 ${name}` }
}
