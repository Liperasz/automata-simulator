const NS = 'http://www.w3.org/2000/svg'
const WIDTH = 900
const HEIGHT = 660
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 }
const DELAYS = { slow: 1800, normal: 1100, fast: 550 }
const MARKERS = [
  ['base', '--soft'],
  ['trail', '--blue-light'],
  ['hot', '--blue'],
  ['start', '--ink'],
]

const $ = id => document.getElementById(id)

const els = {
  name: $('name'),
  facts: $('facts'),
  fail: $('fail'),
  app: $('app'),
  tape: $('tape'),
  graph: $('graph'),
  counter: $('counter'),
  sentence: $('sentence'),
  reset: $('reset'),
  prev: $('prev'),
  play: $('play'),
  next: $('next'),
  speed: $('speed'),
  result: $('result'),
  words: $('words'),
  form: $('form'),
  custom: $('custom'),
}

const state = {
  def: null,
  shape: null,
  nodes: {},
  edges: {},
  dot: null,
  words: [],
  index: -1,
  run: null,
  step: 0,
  playing: false,
  timer: null,
  frame: null,
  speed: 'normal',
}

function create(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function make(tag, attrs, parent) {
  const node = document.createElementNS(NS, tag)
  for (const key in attrs) node.setAttribute(key, attrs[key])
  if (parent) parent.appendChild(node)
  return node
}

function fmt(value) {
  return value.toFixed(1)
}

async function call(path, options) {
  let res
  try {
    res = await fetch(path, options)
  } catch {
    throw new Error('Não consegui falar com o servidor. Rode "python api.py" e recarregue a página.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'O servidor devolveu um erro.')
  return data
}

function runWord(word) {
  return call('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word }),
  })
}

function showFail(message) {
  stopPlay()
  els.app.hidden = true
  els.fail.hidden = false
  els.fail.textContent = message
}

function orderStates(def) {
  const seen = new Set([def.initial_state])
  const order = [def.initial_state]
  for (let i = 0; i < order.length; i++) {
    const moves = def.transitions[order[i]] || {}
    for (const symbol of def.alphabet) {
      const target = moves[symbol]
      if (target !== undefined && !seen.has(target)) {
        seen.add(target)
        order.push(target)
      }
    }
  }
  for (const name of def.states) {
    if (!seen.has(name)) {
      seen.add(name)
      order.push(name)
    }
  }
  return order
}

function placeStates(order) {
  const count = order.length
  const rx = Math.min(330, 70 + count * 50)
  const ry = Math.min(215, 50 + count * 35)
  const spots = {}
  order.forEach((name, i) => {
    if (count === 1) {
      spots[name] = { x: CENTER.x, y: CENTER.y }
      return
    }
    const angle = Math.PI + (2 * Math.PI * i) / count
    spots[name] = {
      x: CENTER.x + rx * Math.cos(angle),
      y: CENTER.y + ry * Math.sin(angle),
    }
  })
  return spots
}

function groupEdges(def) {
  const map = new Map()
  for (const from of Object.keys(def.transitions)) {
    const moves = def.transitions[from]
    for (const symbol of def.alphabet) {
      const to = moves[symbol]
      if (to === undefined) continue
      const key = `${from}|${to}`
      if (!map.has(key)) map.set(key, { key, from, to, symbols: [] })
      map.get(key).symbols.push(symbol)
    }
  }
  return [...map.values()]
}

function toward(a, b, dist) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  return { x: a.x + (dx / len) * dist, y: a.y + (dy / len) * dist }
}

function outward(spot) {
  const dx = spot.x - CENTER.x
  const dy = spot.y - CENTER.y
  const len = Math.hypot(dx, dy)
  if (len < 1) return { x: 0, y: -1 }
  return { x: dx / len, y: dy / len }
}

function turn(dir, angle) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return { x: dir.x * cos - dir.y * sin, y: dir.x * sin + dir.y * cos }
}

function curve(from, to, radius, paired) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  const nx = -dy / len
  const ny = dx / len
  const bend = paired ? 0.34 : 0.12
  const ctrl = {
    x: (from.x + to.x) / 2 + nx * len * bend,
    y: (from.y + to.y) / 2 + ny * len * bend,
  }
  const start = toward(from, ctrl, radius)
  const end = toward(to, ctrl, radius + 5)
  const mid = {
    x: 0.25 * start.x + 0.5 * ctrl.x + 0.25 * end.x,
    y: 0.25 * start.y + 0.5 * ctrl.y + 0.25 * end.y,
  }
  return {
    d: `M${fmt(start.x)} ${fmt(start.y)} Q${fmt(ctrl.x)} ${fmt(ctrl.y)} ${fmt(end.x)} ${fmt(end.y)}`,
    label: { x: mid.x + nx * 16, y: mid.y + ny * 16 },
  }
}

function loop(spot, radius) {
  const dir = outward(spot)
  const at = (angle, dist) => {
    const d = turn(dir, angle)
    return { x: spot.x + d.x * dist, y: spot.y + d.y * dist }
  }
  const reach = radius + 64
  const start = at(-0.62, radius)
  const end = at(0.62, radius + 5)
  const a = at(-0.5, reach)
  const b = at(0.5, reach)
  const peak = (2 * radius * Math.cos(0.62) + 6 * reach * Math.cos(0.5)) / 8
  return {
    d: `M${fmt(start.x)} ${fmt(start.y)} C${fmt(a.x)} ${fmt(a.y)} ${fmt(b.x)} ${fmt(b.y)} ${fmt(end.x)} ${fmt(end.y)}`,
    label: at(0, peak + 16),
  }
}

function entry(spot, radius, looped) {
  const dir = turn(outward(spot), looped ? 1.5 : 0)
  return {
    x1: spot.x + dir.x * (radius + 56),
    y1: spot.y + dir.y * (radius + 56),
    x2: spot.x + dir.x * (radius + 4),
    y2: spot.y + dir.y * (radius + 4),
  }
}

function buildShape(def) {
  const order = orderStates(def)
  const count = order.length
  const radius = count <= 10 ? 30 : Math.max(18, 30 - (count - 10))
  const spots = placeStates(order)
  const edges = groupEdges(def)
  const keys = new Set(edges.map(edge => edge.key))

  for (const edge of edges) {
    const shape = edge.from === edge.to
      ? loop(spots[edge.from], radius)
      : curve(spots[edge.from], spots[edge.to], radius, keys.has(`${edge.to}|${edge.from}`))
    edge.d = shape.d
    edge.label = shape.label
  }

  const looped = keys.has(`${def.initial_state}|${def.initial_state}`)
  return { spots, radius, edges, entry: entry(spots[def.initial_state], radius, looped) }
}

function drawGraph() {
  const { spots, radius, edges, entry } = state.shape
  els.graph.replaceChildren()
  state.nodes = {}
  state.edges = {}

  const defs = make('defs', {}, els.graph)
  for (const [name, color] of MARKERS) {
    const marker = make('marker', {
      id: `arrow-${name}`,
      viewBox: '0 0 10 10',
      refX: 8,
      refY: 5,
      markerWidth: 14,
      markerHeight: 14,
      markerUnits: 'userSpaceOnUse',
      orient: 'auto',
    }, defs)
    make('path', { d: 'M0 0L10 5L0 10z', style: `fill: var(${color})` }, marker)
  }

  const edgeLayer = make('g', {}, els.graph)
  for (const edge of edges) {
    const group = make('g', { class: 'edge' }, edgeLayer)
    const path = make('path', { d: edge.d, 'marker-end': 'url(#arrow-base)' }, group)
    const label = make('text', { x: fmt(edge.label.x), y: fmt(edge.label.y) }, group)
    label.textContent = edge.symbols.join(',')
    state.edges[edge.key] = { group, path }
  }

  const start = make('g', { class: 'start' }, els.graph)
  make('line', {
    x1: fmt(entry.x1),
    y1: fmt(entry.y1),
    x2: fmt(entry.x2),
    y2: fmt(entry.y2),
    'marker-end': 'url(#arrow-start)',
  }, start)

  const nodeLayer = make('g', {}, els.graph)
  for (const name of state.def.states) {
    const spot = spots[name]
    const group = make('g', {
      class: 'node',
      transform: `translate(${fmt(spot.x)} ${fmt(spot.y)})`,
    }, nodeLayer)
    make('circle', { class: 'ring', r: radius }, group)
    if (state.def.final_states.includes(name)) {
      make('circle', { class: 'inner', r: radius - 6 }, group)
    }
    make('text', {}, group).textContent = name
    state.nodes[name] = group
  }

  state.dot = make('circle', { class: 'dot', r: 8, cx: -50, cy: -50, visibility: 'hidden' }, els.graph)
}

function stopDot() {
  if (state.frame) cancelAnimationFrame(state.frame)
  state.frame = null
  if (state.dot) state.dot.setAttribute('visibility', 'hidden')
}

function runDot(path) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const total = path.getTotalLength()
  const duration = Math.min(700, DELAYS[state.speed] * 0.7)
  const begin = performance.now()
  state.dot.setAttribute('visibility', 'visible')

  const frame = now => {
    const t = Math.min(1, (now - begin) / duration)
    const point = path.getPointAtLength(total * t)
    state.dot.setAttribute('cx', point.x)
    state.dot.setAttribute('cy', point.y)
    if (t < 1) {
      state.frame = requestAnimationFrame(frame)
    } else {
      state.frame = null
      state.dot.setAttribute('visibility', 'hidden')
    }
  }
  state.frame = requestAnimationFrame(frame)
}

function isFinished() {
  return Boolean(state.run) && state.step >= state.run.steps.length
}

function explain(run) {
  const chars = [...run.word]
  const symbol = chars[run.error_position]
  const place = run.error_position + 1
  switch (run.reason) {
    case null:
      return `Leu a palavra inteira e parou em ${run.final_state}, que é um estado final.`
    case 'not_final_state':
      return `Leu a palavra inteira, mas parou em ${run.final_state}, que não é um estado final.`
    case 'invalid_symbol':
      return `O símbolo “${symbol}” (posição ${place}) não pertence ao alfabeto.`
    case 'undefined_transition':
      return `Não existe transição de ${run.final_state} lendo “${symbol}” (posição ${place}).`
    default:
      return run.reason
  }
}

function renderGraph() {
  const run = state.run
  const steps = run ? run.steps : []
  const used = state.step > 0 ? steps[state.step - 1] : null
  const current = used ? used.to : state.def.initial_state
  const hotKey = used ? `${used.from}|${used.to}` : null
  const trail = new Set(steps.slice(0, Math.max(0, state.step - 1)).map(s => `${s.from}|${s.to}`))

  for (const name in state.nodes) {
    let cls = 'node'
    if (name === current) {
      cls += ' current'
      if (isFinished()) cls += run.accepted ? ' ok' : ' bad'
    }
    state.nodes[name].setAttribute('class', cls)
  }

  for (const key in state.edges) {
    const { group, path } = state.edges[key]
    let kind = 'base'
    if (key === hotKey) kind = 'hot'
    else if (trail.has(key)) kind = 'trail'
    group.setAttribute('class', kind === 'base' ? 'edge' : `edge ${kind}`)
    path.setAttribute('marker-end', `url(#arrow-${kind})`)
  }

  return hotKey ? state.edges[hotKey].path : null
}

function renderTape() {
  els.tape.replaceChildren()
  const run = state.run
  if (!run) {
    els.tape.appendChild(create('span', 'empty', 'Escolha uma palavra na lista para começar.'))
    return
  }
  if (run.word.length === 0) {
    els.tape.appendChild(create('span', 'sym wide', 'palavra vazia'))
    return
  }
  const hasError = run.error_position !== null
  const finished = isFinished()
  ;[...run.word].forEach((char, i) => {
    let kind = ''
    if (i < state.step) kind = 'done'
    else if (i === state.step) kind = finished && hasError ? 'bad' : 'now'
    els.tape.appendChild(create('span', `sym ${kind}`.trim(), char === ' ' ? '␣' : char))
  })
}

function renderStatus() {
  const run = state.run
  if (!run) {
    els.counter.textContent = 'Sem palavra'
    els.sentence.textContent = 'Nenhuma palavra selecionada.'
    return
  }
  els.counter.textContent = `Passo ${state.step} de ${run.steps.length}`
  if (state.step > 0) {
    const last = run.steps[state.step - 1]
    els.sentence.textContent = `Leu “${last.symbol}”: ${last.from} → ${last.to}`
    return
  }
  const start = `Começa em ${state.def.initial_state}.`
  const next = [...run.word][0]
  els.sentence.textContent = next !== undefined && !isFinished()
    ? `${start} Próximo símbolo: “${next}”.`
    : start
}

function renderResult() {
  const box = els.result
  const run = state.run
  box.replaceChildren()
  if (!run || !isFinished()) {
    box.className = 'result idle'
    box.textContent = run
      ? 'O resultado aparece quando a leitura terminar.'
      : 'Escolha uma palavra para ver o resultado.'
    return
  }
  box.className = `result ${run.accepted ? 'ok' : 'bad'}`
  box.appendChild(create('h2', '', run.accepted ? 'Aceita' : 'Rejeitada'))
  box.appendChild(create('p', '', explain(run)))
}

function renderControls() {
  const total = state.run ? state.run.steps.length : 0
  els.reset.disabled = !state.run || state.step === 0
  els.prev.disabled = !state.run || state.step === 0
  els.next.disabled = !state.run || state.step >= total
  els.play.disabled = total === 0
  if (state.playing) els.play.textContent = 'Pausar'
  else els.play.textContent = total > 0 && state.step >= total ? 'Repetir' : 'Executar'
}

function render(animate) {
  stopDot()
  const hotPath = renderGraph()
  renderTape()
  renderStatus()
  renderResult()
  renderControls()
  if (animate && hotPath) runDot(hotPath)
}

function renderWords() {
  els.words.replaceChildren()
  state.words.forEach((item, i) => {
    const li = create('li', i === state.index ? 'active' : '')
    const button = create('button')
    button.type = 'button'

    const left = create('span', 'left')
    left.appendChild(create('span', item.text ? 'text' : 'text vazia', item.text || 'palavra vazia'))
    if (item.custom) left.appendChild(create('span', 'own', 'digitada'))

    const ok = item.result.accepted
    button.append(left, create('span', `badge ${ok ? 'ok' : 'bad'}`, ok ? 'Aceita' : 'Rejeitada'))
    button.addEventListener('click', () => choose(i))
    li.appendChild(button)
    els.words.appendChild(li)
  })
  const active = els.words.querySelector('.active')
  if (active) active.scrollIntoView({ block: 'nearest' })
}

function go(step, animate) {
  state.step = step
  render(animate)
}

function stopPlay() {
  clearTimeout(state.timer)
  state.timer = null
  if (state.playing) {
    state.playing = false
    if (state.def) renderControls()
  }
}

function tick() {
  go(state.step + 1, true)
  if (state.step >= state.run.steps.length) {
    stopPlay()
    return
  }
  state.timer = setTimeout(tick, DELAYS[state.speed])
}

function startPlay() {
  if (isFinished()) state.step = 0
  state.playing = true
  render(false)
  state.timer = setTimeout(tick, 450)
}

function choose(index) {
  stopPlay()
  state.index = index
  state.run = state.words[index].result
  state.step = 0
  renderWords()
  render(false)
}

function restart() {
  stopPlay()
  go(0, false)
}

function forward() {
  if (!state.run || isFinished()) return
  stopPlay()
  go(state.step + 1, true)
}

function backward() {
  if (!state.run || state.step === 0) return
  stopPlay()
  go(state.step - 1, false)
}

function togglePlay() {
  if (els.play.disabled) return
  if (state.playing) stopPlay()
  else startPlay()
}

function renderFacts() {
  const { alphabet, states, initial_state, final_states } = state.def
  const items = [
    ['Alfabeto', `{${alphabet.join(', ')}}`],
    ['Estados', String(states.length)],
    ['Inicial', initial_state],
    ['Finais', final_states.length ? final_states.join(', ') : 'nenhum'],
  ]
  els.facts.replaceChildren()
  for (const [label, value] of items) {
    const li = create('li', '', label)
    li.appendChild(create('b', '', value))
    els.facts.appendChild(li)
  }
}

els.reset.addEventListener('click', restart)
els.prev.addEventListener('click', backward)
els.next.addEventListener('click', forward)
els.play.addEventListener('click', togglePlay)

els.speed.addEventListener('click', event => {
  const button = event.target.closest('button')
  if (!button) return
  state.speed = button.dataset.speed
  for (const item of els.speed.children) item.classList.toggle('on', item === button)
})

els.form.addEventListener('submit', async event => {
  event.preventDefault()
  const text = els.custom.value.trim()
  if (!text) return
  const found = state.words.findIndex(item => item.text === text)
  if (found >= 0) {
    els.custom.value = ''
    choose(found)
    return
  }
  try {
    const result = await runWord(text)
    state.words.push({ text, result, custom: true })
    els.custom.value = ''
    choose(state.words.length - 1)
  } catch (err) {
    showFail(err.message)
  }
})

document.addEventListener('keydown', event => {
  if (event.target.tagName === 'INPUT') return
  if (event.key === 'ArrowRight') forward()
  else if (event.key === 'ArrowLeft') backward()
  else if (event.key.toLowerCase() === 'r') restart()
  else if (event.key === ' ' && event.target.tagName !== 'BUTTON') {
    event.preventDefault()
    togglePlay()
  }
})

async function start() {
  try {
    state.def = await call('/api/automaton')
    const list = await call('/api/words')
    state.shape = buildShape(state.def)
    state.words = await Promise.all(
      list.map(async text => ({ text, result: await runWord(text), custom: false })),
    )
  } catch (err) {
    showFail(err.message)
    return
  }

  els.name.textContent = state.def.name || 'Autômato sem nome'
  renderFacts()
  drawGraph()
  els.app.hidden = false
  if (state.words.length) choose(0)
  else {
    renderWords()
    render(false)
  }
}

start()
