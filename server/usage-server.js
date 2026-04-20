#!/usr/bin/env node
/**
 * ClaudeBuddy local usage server
 * ~/.claude/ 디렉토리의 jsonl 파일을 읽어서 usage 데이터를 HTTP로 제공합니다.
 * Chrome 익스텐션이 http://localhost:27182/usage 를 폴링합니다.
 */

const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')

const PORT = 27182
const CLAUDE_DIR = path.join(os.homedir(), '.claude')
const STATS_FILE = path.join(CLAUDE_DIR, 'stats-cache.json')
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects')

// context window 크기 (tokens) — 모델별
const CONTEXT_WINDOWS = {
  'claude-opus-4-6': 200_000,
  'claude-sonnet-4-6': 200_000,
  'claude-sonnet-4-5': 200_000,
  'claude-haiku-4-5': 200_000,
}
const DEFAULT_CONTEXT_WINDOW = 200_000

// ── 누적 usage 읽기 (stats-cache.json) ────────────────────
function readStatsCache() {
  try {
    const raw = fs.readFileSync(STATS_FILE, 'utf-8')
    const data = JSON.parse(raw)
    return {
      modelUsage: data.modelUsage ?? {},
      dailyActivity: data.dailyActivity ?? [],
      totalSessions: data.totalSessions ?? 0,
      totalMessages: data.totalMessages ?? 0,
      lastComputedDate: data.lastComputedDate ?? null,
    }
  } catch {
    return { modelUsage: {}, dailyActivity: [], totalSessions: 0, totalMessages: 0, lastComputedDate: null }
  }
}

// ── jsonl 파일에서 오늘 usage 집계 ────────────────────────
function readProjectUsage(todayStr) {
  const result = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    model: null,
    sessionTokensTotal: 0, // 현재 세션 context 계산용
  }

  if (!fs.existsSync(PROJECTS_DIR)) return result

  const projectDirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(PROJECTS_DIR, d.name))

  // 가장 최근 수정된 jsonl = 현재 세션
  let latestMtime = 0
  let latestFile = null

  for (const dir of projectDirs) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
    for (const file of files) {
      const full = path.join(dir, file)
      try {
        const { mtimeMs } = fs.statSync(full)
        const lines = fs.readFileSync(full, 'utf-8').split('\n').filter(Boolean)

        for (const line of lines) {
          try {
            const obj = JSON.parse(line)
            if (obj.type !== 'assistant' || !obj.message?.usage) continue

            const ts = obj.timestamp ? new Date(obj.timestamp).toISOString().split('T')[0] : null
            const usage = obj.message.usage
            const model = obj.message.model ?? null

            // 오늘 데이터만 합산
            if (ts === todayStr) {
              result.inputTokens += usage.input_tokens ?? 0
              result.outputTokens += usage.output_tokens ?? 0
              result.cacheCreationTokens += usage.cache_creation_input_tokens ?? 0
              result.cacheReadTokens += usage.cache_read_input_tokens ?? 0
              if (model) result.model = model
            }

            // 현재 세션(가장 최근 파일) 전체 토큰 합산
            if (mtimeMs > latestMtime) {
              latestMtime = mtimeMs
              latestFile = full
            }
          } catch { /* ignore bad json */ }
        }
      } catch { /* ignore unreadable files */ }
    }
  }

  // 현재 세션 context usage: 마지막 assistant 메시지의 input 토큰 기준
  // (input_tokens + cache_creation + cache_read = 현재 context에 로드된 토큰 수)
  if (latestFile) {
    const lines = fs.readFileSync(latestFile, 'utf-8').split('\n').filter(Boolean)
    let lastUsage = null
    let sessionModel = null
    for (const line of lines) {
      try {
        const obj = JSON.parse(line)
        if (obj.type !== 'assistant' || !obj.message?.usage) continue
        lastUsage = obj.message.usage
        if (obj.message.model) sessionModel = obj.message.model
      } catch { }
    }
    if (lastUsage) {
      // 현재 context에 로드된 토큰 = input + cache_creation + cache_read
      result.sessionTokensTotal = (lastUsage.input_tokens ?? 0) +
        (lastUsage.cache_creation_input_tokens ?? 0) +
        (lastUsage.cache_read_input_tokens ?? 0)
    }
    if (sessionModel && !result.model) result.model = sessionModel
  }

  return result
}

// ── 비용 계산 ─────────────────────────────────────────────
const PRICING = {
  'claude-opus-4-6':    { input: 15,   output: 75,   cacheWrite: 18.75, cacheRead: 1.5  },
  'claude-sonnet-4-6':  { input: 3,    output: 15,   cacheWrite: 3.75,  cacheRead: 0.3  },
  'claude-sonnet-4-5':  { input: 3,    output: 15,   cacheWrite: 3.75,  cacheRead: 0.3  },
  'claude-haiku-4-5':   { input: 0.8,  output: 4,    cacheWrite: 1,     cacheRead: 0.08 },
}
const DEFAULT_PRICE = PRICING['claude-sonnet-4-6']

function calcCost(model, input, output, cacheWrite, cacheRead) {
  const p = (model && PRICING[model]) ? PRICING[model] : DEFAULT_PRICE
  const M = 1_000_000
  return (input / M) * p.input + (output / M) * p.output +
    (cacheWrite / M) * p.cacheWrite + (cacheRead / M) * p.cacheRead
}

// ── 메인 데이터 생성 ───────────────────────────────────────
function buildUsageResponse() {
  const today = new Date().toISOString().split('T')[0]
  const stats = readStatsCache()
  const project = readProjectUsage(today)

  const model = project.model
  const ctxWindow = (model && CONTEXT_WINDOWS[model]) ? CONTEXT_WINDOWS[model] : DEFAULT_CONTEXT_WINDOW
  const ctxUsagePct = Math.min(100, Math.round((project.sessionTokensTotal / ctxWindow) * 100))

  const todayCost = calcCost(
    model,
    project.inputTokens,
    project.outputTokens,
    project.cacheCreationTokens,
    project.cacheReadTokens,
  )

  // 전체 누적 비용 계산
  let totalCost = 0
  for (const [m, u] of Object.entries(stats.modelUsage)) {
    totalCost += calcCost(m, u.inputTokens ?? 0, u.outputTokens ?? 0,
      u.cacheCreationInputTokens ?? 0, u.cacheReadInputTokens ?? 0)
  }

  return {
    today: {
      date: today,
      model,
      inputTokens: project.inputTokens,
      outputTokens: project.outputTokens,
      cacheCreationTokens: project.cacheCreationTokens,
      cacheReadTokens: project.cacheReadTokens,
      estimatedCostUsd: todayCost,
    },
    currentSession: {
      totalTokens: project.sessionTokensTotal,
      contextWindow: ctxWindow,
      contextUsagePct: ctxUsagePct,
      model,
    },
    allTime: {
      modelUsage: stats.modelUsage,
      totalSessions: stats.totalSessions,
      totalMessages: stats.totalMessages,
      estimatedCostUsd: totalCost,
      lastComputedDate: stats.lastComputedDate,
    },
  }
}

// ── HTTP 서버 ──────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // CORS — 익스텐션에서 접근 허용
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  if (req.url !== '/usage') { res.writeHead(404); res.end('{"error":"not found"}'); return }

  try {
    const data = buildUsageResponse()
    res.writeHead(200)
    res.end(JSON.stringify(data))
  } catch (err) {
    res.writeHead(500)
    res.end(JSON.stringify({ error: String(err) }))
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ClaudeBuddy usage server running at http://127.0.0.1:${PORT}`)
})
