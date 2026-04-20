import { useEffect, useState, type CSSProperties } from 'react'
import type { StorageState, UsagePeriod, UsageSnapshot, Settings } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/types'

// ── 테마 ──────────────────────────────────────────────────
const LIGHT = {
  bg: '#ffffff', cardBg: '#ffffff', cardBorder: '#e5e7eb',
  text: '#111827', textSub: '#6b7280', textMuted: '#9ca3af',
  barBg: '#f3f4f6', divider: '#f3f4f6',
  settingsBg: '#f9fafb', settingsBorder: '#e5e7eb',
  inputBg: '#ffffff', inputBorder: '#d1d5db',
  warnBg: '#fef2f2', warnBorder: '#fecaca', warnText: '#b91c1c',
  toggleActive: '#111827', toggleInactive: '#e5e7eb',
  toggleTextActive: '#ffffff', toggleTextInactive: '#6b7280',
}
const DARK = {
  bg: '#111827', cardBg: '#1f2937', cardBorder: '#374151',
  text: '#f9fafb', textSub: '#d1d5db', textMuted: '#9ca3af',
  barBg: '#374151', divider: '#374151',
  settingsBg: '#1a2332', settingsBorder: '#374151',
  inputBg: '#1f2937', inputBorder: '#4b5563',
  warnBg: '#2d1515', warnBorder: '#7f1d1d', warnText: '#fca5a5',
  toggleActive: '#f9fafb', toggleInactive: '#374151',
  toggleTextActive: '#111827', toggleTextInactive: '#9ca3af',
}
type Theme = typeof LIGHT

function useTheme(): Theme {
  const [isDark, setIsDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const fn = (e: MediaQueryListEvent) => setIsDark(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return isDark ? DARK : LIGHT
}

// ── 유틸 ──────────────────────────────────────────────────
function timeAgo(ts: number | null): string {
  if (!ts) return ''
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  return `${Math.floor(m / 60)}시간 전`
}

function usageColor(pct: number) {
  if (pct >= 95) return '#ef4444'
  if (pct >= 80) return '#f97316'
  if (pct >= 50) return '#f59e0b'
  return '#10b981'
}

function timeUntil(isoStr: string): string {
  const diff = new Date(isoStr).getTime() - Date.now()
  if (diff <= 0) return '곧 초기화'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h >= 24) { const d = Math.floor(h / 24); return `${d}일 ${h % 24}시간 후` }
  return h > 0 ? `${h}시간 ${m}분 후` : `${m}분 후`
}

function predictLimit(pct: number, resetsAt: string, periodHours: number, history: UsageSnapshot[]): string | null {
  if (pct <= 5 || pct >= 100) return null
  const now = Date.now()
  const periodEnd = new Date(resetsAt).getTime()
  const elapsed = now - (periodEnd - periodHours * 3600000)
  if (elapsed <= 0) return null
  
  // 기본 선형 예측
  const basicMsTo100 = (elapsed / pct) * (100 - pct)
  if (basicMsTo100 >= periodEnd - now) return null
  
  // 패턴 기반 개선된 예측
  const patternAdjustment = analyzeUsagePattern(history, periodHours)
  const adjustedMsTo100 = basicMsTo100 * patternAdjustment
  
  if (adjustedMsTo100 >= periodEnd - now) return null
  
  const h = Math.floor(adjustedMsTo100 / 3600000)
  const m = Math.floor((adjustedMsTo100 % 3600000) / 60000)
  
  return h > 0 
    ? `약 ${h}시간 ${m}분 후 한도 도달 예상`
    : `약 ${m}분 후 한도 도달 예상`
}

// 사용자 패턴 분석 및 예측 정확도 개선
function analyzeUsagePattern(history: UsageSnapshot[], periodHours: number): number {
  if (history.length < 5) return 1 // 데이터 부족 시 기본값
  
  const relevantHistory = history.slice(-20) // 최근 20개 데이터점
  const usageField = periodHours === 5 ? 'fh' : 'sd'
  
  // 사용량 변화율 분석
  const deltas = []
  for (let i = 1; i < relevantHistory.length; i++) {
    const prev = relevantHistory[i - 1][usageField]
    const curr = relevantHistory[i][usageField]
    if (prev !== null && curr !== null && curr > prev) {
      deltas.push(curr - prev)
    }
  }
  
  if (deltas.length < 3) return 1
  
  // 평균 증가율 계산
  const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length
  
  // 시간대별 사용 패턴 (오전/오후)
  const hour = new Date().getHours()
  let timeMultiplier = 1
  if (hour >= 9 && hour <= 18) {
    timeMultiplier = 1.2 // 업무시간 대 증가 경향
  } else if (hour >= 22 || hour <= 6) {
    timeMultiplier = 0.7 // 심야 시간대 감소 경향
  }
  
  // 주말/주중 패턴
  const dayOfWeek = new Date().getDay()
  let dayMultiplier = 1
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    dayMultiplier = 0.8 // 주말 사용량 감소
  }
  
  // 사용량 가속도 분석
  const recentDeltas = deltas.slice(-5)
  const olderDeltas = deltas.slice(0, -5)
  let accelerationFactor = 1
  
  if (recentDeltas.length >= 3 && olderDeltas.length >= 3) {
    const recentAvg = recentDeltas.reduce((a, b) => a + b, 0) / recentDeltas.length
    const olderAvg = olderDeltas.reduce((a, b) => a + b, 0) / olderDeltas.length
    
    if (recentAvg > olderAvg * 1.5) {
      accelerationFactor = 1.3 // 사용량 급증가
    } else if (recentAvg < olderAvg * 0.7) {
      accelerationFactor = 0.8 // 사용량 감소 추세
    }
  }
  
  return Math.max(0.5, Math.min(2.0, timeMultiplier * dayMultiplier * accelerationFactor))
}

// 사용자 패턴 분석 대시보드
function UsagePatternInsights({ history, t }: { history: UsageSnapshot[]; t: Theme }) {
  if (history.length < 10) return null
  
  const recentData = history.slice(-24) // 최근 24시간
  const insights = []
  
  // 피크 시간대 분석
  const hourlyUsage: { [key: number]: number[] } = {}
  recentData.forEach(snapshot => {
    const hour = new Date(snapshot.ts).getHours()
    if (!hourlyUsage[hour]) hourlyUsage[hour] = []
    if (snapshot.sd !== null) hourlyUsage[hour].push(snapshot.sd)
  })
  
  const avgUsageByHour = Object.entries(hourlyUsage)
    .map(([hour, values]) => ({
      hour: parseInt(hour),
      avg: values.reduce((a, b) => a + b, 0) / values.length
    }))
    .filter(item => !isNaN(item.avg))
    .sort((a, b) => b.avg - a.avg)
  
  if (avgUsageByHour.length > 0) {
    const peakHour = avgUsageByHour[0].hour
    const timeStr = peakHour < 12 ? `오전 ${peakHour}시` : `오후 ${peakHour - 12 || 12}시`
    insights.push(`피크 시간대: ${timeStr}`)
  }
  
  // 사용 패턴 분석
  const usageChanges = []
  for (let i = 1; i < recentData.length; i++) {
    if (recentData[i].sd !== null && recentData[i-1].sd !== null) {
      usageChanges.push(recentData[i].sd! - recentData[i-1].sd!)
    }
  }
  
  if (usageChanges.length >= 5) {
    const avgChange = usageChanges.reduce((a, b) => a + b, 0) / usageChanges.length
    const recentChange = usageChanges.slice(-3).reduce((a, b) => a + b, 0) / 3
    
    if (recentChange > avgChange * 1.5) {
      insights.push('사용량 증가 추세 감지')
    } else if (recentChange < avgChange * 0.5) {
      insights.push('사용량 안정화 추세')
    }
  }
  
  if (insights.length === 0) return null
  
  return (
    <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 8, padding: '10px 12px', background: t.cardBg, fontSize: 11 }}>
      <div style={{ fontWeight: 600, color: t.text, marginBottom: 6 }}>패턴 분석</div>
      {insights.map((insight, i) => (
        <div key={i} style={{ color: t.textMuted, marginBottom: 2 }}>• {insight}</div>
      ))}
    </div>
  )
}

// ── 배터리 ────────────────────────────────────────────────
function Battery({ pct, t }: { pct: number; t: Theme }) {
  const color = usageColor(pct)
  const remaining = 100 - pct
  const filled = Math.round((remaining / 100) * 10)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <div style={{ display: 'flex', gap: 2, padding: '3px 4px', border: `2px solid ${color}`, borderRadius: 5 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ width: 7, height: 16, borderRadius: 2, background: i < filled ? color : t.barBg, transition: 'background 0.4s' }} />
        ))}
      </div>
      <div style={{ width: 4, height: 9, borderRadius: '0 2px 2px 0', background: color }} />
    </div>
  )
}

// ── 반원형 게이지 ─────────────────────────────────────────
function SemicircleGauge({ pct, t }: { pct: number; t: Theme }) {
  const color = usageColor(pct)
  const remaining = 100 - pct
  const angle = (remaining / 100) * 180
  const radius = 30
  const strokeWidth = 6

  const circumference = Math.PI * radius
  const strokeDasharray = `${(angle / 180) * circumference} ${circumference}`

  return (
    <div style={{ position: 'relative', width: 70, height: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <svg width="70" height="40" style={{ position: 'absolute', top: 0, left: 0 }}>
        {/* 배경 호 */}
        <path
          d={`M 5 35 A ${radius} ${radius} 0 0 1 65 35`}
          fill="none"
          stroke={t.barBg}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* 진행 호 */}
        <path
          d={`M 5 35 A ${radius} ${radius} 0 0 1 65 35`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={0}
          style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute',
        bottom: 8,
        fontSize: 11,
        fontWeight: 600,
        color: color,
        fontVariantNumeric: 'tabular-nums'
      }}>
        {remaining}%
      </div>
    </div>
  )
}

// ── 스파크라인 ─────────────────────────────────────────────
function Sparkline({ data, color }: { data: Array<number | null>; color: string }) {
  const W = 240, H = 36
  const pts = data
    .map((v, i) => ({ x: (i / (data.length - 1)) * W, y: v !== null ? H - (v / 100) * H : null }))
    .filter((p): p is { x: number; y: number } => p.y !== null)

  if (pts.length < 2) return (
    <div style={{ height: H, display: 'flex', alignItems: 'center', fontSize: 11, color: '#9ca3af' }}>데이터 수집 중...</div>
  )

  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  return (
    <svg width={W} height={H} style={{ overflow: 'visible', display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={3} fill={color} />
    </svg>
  )
}

// ── 사용량 카드 ────────────────────────────────────────────
function UsageCard({ title, subtitle, period, periodHours, t, history, displayMode }: {
  title: string; subtitle: string; period: UsagePeriod; periodHours: number; t: Theme; history: UsageSnapshot[]; displayMode: 'battery' | 'gauge'
}) {
  const { utilization: pct, resets_at } = period
  const remaining = 100 - pct
  const color = usageColor(pct)
  const prediction = predictLimit(pct, resets_at, periodHours, history)
  return (
    <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: '14px 16px', background: t.cardBg, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{title}</div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{subtitle}</div>
        </div>
        {displayMode === 'battery' ? (
          <span style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{remaining}%</span>
        ) : (
          <SemicircleGauge pct={pct} t={t} />
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {displayMode === 'battery' && <Battery pct={pct} t={t} />}
      </div>
      {displayMode === 'battery' && (
        <div style={{ height: 5, background: t.barBg, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${remaining}%`, background: color, borderRadius: 999, transition: 'width 0.5s ease, background 0.4s' }} />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4, borderTop: `1px solid ${t.divider}` }}>
        <span style={{ fontSize: 11, color: t.textMuted }}>초기화까지</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>{timeUntil(resets_at)}</span>
      </div>
      {prediction && (
        <div style={{ background: '#fef2f2', borderRadius: 6, padding: '5px 8px', fontSize: 11, color: '#b91c1c', fontWeight: 500 }}>
          ⚠ {prediction}
        </div>
      )}
    </div>
  )
}

// ── 히스토리 ──────────────────────────────────────────────
function HistorySection({ history, t }: { history: UsageSnapshot[]; t: Theme }) {
  if (history.length < 2) return null
  const recent = history.slice(-24)
  const fhData = recent.map((s) => s.fh)
  const sdData = recent.map((s) => s.sd)
  const latest = history[history.length - 1]
  const prev = history[Math.max(0, history.length - 8)]
  return (
    <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: '14px 16px', background: t.cardBg, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>사용량 추이 <span style={{ fontSize: 11, fontWeight: 400, color: t.textMuted }}>(최근 6시간)</span></div>
      {fhData.some((v) => v !== null) && (
        <div>
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6 }}>5시간</div>
          <Sparkline data={fhData} color={usageColor(latest.fh ?? 0)} />
        </div>
      )}
      {sdData.some((v) => v !== null) && (
        <div>
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6 }}>주간</div>
          <Sparkline data={sdData} color={usageColor(latest.sd ?? 0)} />
        </div>
      )}
      {prev && (
        <div style={{ display: 'flex', gap: 12, paddingTop: 8, borderTop: `1px solid ${t.divider}` }}>
          {latest.fh !== null && prev.fh !== null && (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 2 }}>5시간 변화</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: latest.fh - prev.fh > 0 ? '#ef4444' : '#10b981' }}>
                {latest.fh - prev.fh > 0 ? '-' : '+'}{Math.abs(latest.fh - prev.fh)}%
              </div>
            </div>
          )}
          {latest.sd !== null && prev.sd !== null && (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 2 }}>주간 변화</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: latest.sd - prev.sd > 0 ? '#ef4444' : '#10b981' }}>
                {latest.sd - prev.sd > 0 ? '-' : '+'}{Math.abs(latest.sd - prev.sd)}%
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 설정 패널 ─────────────────────────────────────────────
const REFRESH_OPTIONS: Array<{ label: string; value: number }> = [
  { label: '1분', value: 1 },
  { label: '5분', value: 5 },
  { label: '10분', value: 10 },
  { label: '30분', value: 30 },
]

function SettingsPanel({ settings, t, onChange, saved }: {
  settings: Settings
  t: Theme
  onChange: (s: Partial<Settings>) => void
  saved: boolean
}) {
  const [t1, setT1] = useState(String(settings.notifThresholds[0]))
  const [t2, setT2] = useState(String(settings.notifThresholds[1]))

  function applyThresholds() {
    const v1 = Math.min(100, Math.max(1, parseInt(t1) || 80))
    const v2 = Math.min(100, Math.max(1, parseInt(t2) || 95))
    onChange({ notifThresholds: [Math.min(v1, v2), Math.max(v1, v2)] })
  }

  const inputStyle: CSSProperties = {
    width: 44, padding: '4px 6px', borderRadius: 6, border: `1px solid ${t.inputBorder}`,
    background: t.inputBg, color: t.text, fontSize: 12, textAlign: 'center',
  }
  const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 8, display: 'block' }
  const toggleBtn = (active: boolean) => ({
    padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
    background: active ? t.toggleActive : t.toggleInactive,
    color: active ? t.toggleTextActive : t.toggleTextInactive,
  })

  return (
    <div style={{ border: `1px solid ${t.settingsBorder}`, borderRadius: 12, padding: '14px 16px', background: t.settingsBg, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>설정</div>
        {saved && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 500 }}>✓ 저장됨</span>}
      </div>

      {/* 배지 표시 */}
      <div>
        <span style={labelStyle}>배지 표시</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={toggleBtn(settings.badgeMode === 'seven_day')} onClick={() => onChange({ badgeMode: 'seven_day' })}>주간</button>
          <button style={toggleBtn(settings.badgeMode === 'five_hour')} onClick={() => onChange({ badgeMode: 'five_hour' })}>5시간</button>
        </div>
      </div>

      {/* 알림 설정 */}
      <div>
        <span style={labelStyle}>알림 설정</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: t.textMuted }}>알림 사용</span>
          <button
            style={toggleBtn(settings.notificationEnabled)}
            onClick={() => onChange({ notificationEnabled: !settings.notificationEnabled })}
          >
            {settings.notificationEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        {settings.notificationEnabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input style={inputStyle} value={t1} onChange={(e) => setT1(e.target.value)} onBlur={applyThresholds} maxLength={3} />
            <span style={{ fontSize: 12, color: t.textMuted }}>%</span>
            <span style={{ fontSize: 12, color: t.textMuted }}>/</span>
            <input style={inputStyle} value={t2} onChange={(e) => setT2(e.target.value)} onBlur={applyThresholds} maxLength={3} />
            <span style={{ fontSize: 12, color: t.textMuted }}>%</span>
          </div>
        )}
      </div>

      {/* 새로고침 주기 */}
      <div>
        <span style={labelStyle}>새로고침 주기</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {REFRESH_OPTIONS.map((opt) => (
            <button key={opt.value} style={toggleBtn(settings.refreshIntervalMin === opt.value)} onClick={() => onChange({ refreshIntervalMin: opt.value })}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span style={labelStyle}>표시 방식</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={toggleBtn(settings.displayMode === 'battery')} onClick={() => onChange({ displayMode: 'battery' })}>배터리</button>
          <button style={toggleBtn(settings.displayMode === 'gauge')} onClick={() => onChange({ displayMode: 'gauge' })}>게이지</button>
        </div>
      </div>

      {/* 미니 대시보드 (사이드패널) */}
      <div>
        <span style={labelStyle}>미니 대시보드</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: t.textMuted }}>아이콘 클릭 시 사이드패널 열기</span>
          <button
            style={toggleBtn(settings.sidePanelEnabled)}
            onClick={() => onChange({ sidePanelEnabled: !settings.sidePanelEnabled })}
          >
            {settings.sidePanelEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* 미니 위젯 */}
      <div>
        <span style={labelStyle}>미니 위젯</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: t.textMuted }}>별도 창에서 사용량 표시</span>
          <button
            style={toggleBtn(settings.widgetEnabled)}
            onClick={() => onChange({ widgetEnabled: !settings.widgetEnabled })}
          >
            {settings.widgetEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        <div style={{ fontSize: 10, color: t.textMuted, marginTop: 4 }}>
          키보드 단축키: Ctrl+Shift+W
        </div>
      </div>

      {/* 알림 스타일 */}
      {settings.notificationEnabled && (
        <div>
          <span style={labelStyle}>알림 스타일</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button style={toggleBtn(settings.notificationStyle === 'minimal')} onClick={() => onChange({ notificationStyle: 'minimal' })}>
              간단
            </button>
            <button style={toggleBtn(settings.notificationStyle === 'default')} onClick={() => onChange({ notificationStyle: 'default' })}>
              기본
            </button>
            <button style={toggleBtn(settings.notificationStyle === 'detailed')} onClick={() => onChange({ notificationStyle: 'detailed' })}>
              상세
            </button>
          </div>
          <div style={{ fontSize: 9, color: t.textMuted, marginTop: 4 }}>
            {settings.notificationStyle === 'minimal' && '간결한 경고만 표시'}
            {settings.notificationStyle === 'default' && '기본 정보와 권장사항 포함'}
            {settings.notificationStyle === 'detailed' && '사용 패턴과 예측 정보 포함'}
          </div>
        </div>
      )}

      {/* 키보드 단축키 안내 */}
      <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 6, border: `1px solid ${t.cardBorder}` }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#1f2937', marginBottom: 4 }}>키보드 단축키</div>
        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.4 }}>
          <div>Ctrl+Shift+C : 팝업 열기</div>
          <div>Ctrl+Shift+S : 사이드패널 열기</div>
          <div>Ctrl+Shift+W : 미니 위젯 열기</div>
        </div>
      </div>
    </div>
  )
}

// ── 메인 ──────────────────────────────────────────────────
const DEFAULT_STATE: StorageState = {
  authStatus: 'unknown', userInfo: null, usageData: null,
  usageError: null, orgId: null, history: [], settings: DEFAULT_SETTINGS,
  lastUpdatedAt: null,
}

export default function App() {
  const t = useTheme()
  const [state, setState] = useState<StorageState>(DEFAULT_STATE)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [saved, setSaved] = useState(false)
  const [, setTick] = useState(0)

  async function load() {
    setLoading(true)
    chrome.runtime.sendMessage({ type: 'REFRESH' }, (resp) => {
      if (resp?.payload) setState(resp.payload)
      setLoading(false)
    })
  }

  function updateSettings(partial: Partial<Settings>) {
    chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: partial }, (resp) => {
      if (resp?.payload) {
        setState(resp.payload)
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      }
    })
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const { authStatus, userInfo, usageData, usageError, history, settings, lastUpdatedAt } = state
  const isAuth = authStatus === 'authenticated'

  return (
    <div style={{ width: 300, background: t.bg, color: t.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* 헤더 */}
      <div style={{ padding: '11px 14px', borderBottom: `1px solid ${t.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={chrome.runtime.getURL('icons/icon48.png')} style={{ width: 26, height: 26 }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>ClaudeBuddy</div>
              {!loading && (
                <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 999, whiteSpace: 'nowrap', background: isAuth ? '#ecfdf5' : '#fef2f2', color: isAuth ? '#059669' : '#dc2626' }}>
                  {isAuth ? '연결됨' : '미연결'}
                </span>
              )}
            </div>
            {isAuth && userInfo && (
              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 1, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userInfo.email || userInfo.name}</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {/* claude.ai 바로가기 */}
            <button
              title="claude.ai 열기"
              onClick={() => chrome.tabs.create({ url: 'https://claude.ai' })}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 14, padding: '2px 4px', lineHeight: 1 }}
            >↗</button>
            {/* 설정 */}
            <button
              title="설정"
              onClick={() => setShowSettings((v) => !v)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: showSettings ? t.text : t.textMuted, fontSize: 14, padding: '2px 4px', lineHeight: 1 }}
            >⚙</button>
            {/* 새로고침 */}
            <button onClick={load} disabled={loading} style={{ border: 'none', background: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 15, padding: '2px 4px', lineHeight: 1 }}>
              <span style={{ display: 'inline-block', animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>↻</span>
            </button>
          </div>
          {/* 업데이트 정보 */}
          {isAuth && lastUpdatedAt && (
            <div style={{ fontSize: 9, color: t.textMuted, textAlign: 'right', width: '100%' }}>
              {timeAgo(lastUpdatedAt)} 업데이트
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 120 }}>
          <div style={{ width: 22, height: 22, border: `3px solid ${t.barBg}`, borderTopColor: '#d97706', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* 설정 패널 */}
        {showSettings && <SettingsPanel settings={settings} t={t} onChange={updateSettings} saved={saved} />}

        {/* 에러 (인증된 상태에서만 표시) */}
        {usageError && isAuth && (
          <div style={{ background: t.warnBg, border: `1px solid ${t.warnBorder}`, borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.warnText }}>오류: {usageError}</div>
          </div>
        )}

        {usageData?.five_hour && (
          <UsageCard title="5시간 사용량" subtitle="단기 롤링 윈도우" period={usageData.five_hour} periodHours={5} t={t} history={history} displayMode={settings.displayMode} />
        )}
        {usageData?.seven_day && (
          <UsageCard title="주간 사용량" subtitle="7일 롤링 윈도우" period={usageData.seven_day} periodHours={168} t={t} history={history} displayMode={settings.displayMode} />
        )}
        {usageData?.seven_day_opus && (
          <UsageCard title="주간 Opus" subtitle="" period={usageData.seven_day_opus} periodHours={168} t={t} history={history} displayMode={settings.displayMode} />
        )}
        {usageData?.seven_day_sonnet && (
          <UsageCard title="주간 Sonnet" subtitle="" period={usageData.seven_day_sonnet} periodHours={168} t={t} history={history} displayMode={settings.displayMode} />
        )}
        {usageData?.extra_usage?.is_enabled && (
          <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: '14px 16px', background: t.cardBg, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>추가 크레딧</div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: t.textMuted }}>사용률</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: usageColor(usageData.extra_usage.utilization ?? 0) }}>
                  {usageData.extra_usage.utilization ?? 0}%
                </span>
              </div>
              <div style={{ height: 5, background: t.barBg, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${usageData.extra_usage.utilization ?? 0}%`, background: usageColor(usageData.extra_usage.utilization ?? 0), borderRadius: 999 }} />
              </div>
            </div>
            {usageData.extra_usage.used_credits !== null && usageData.extra_usage.monthly_limit !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingTop: 4, borderTop: `1px solid ${t.divider}` }}>
                <span style={{ color: t.textMuted }}>사용 / 한도</span>
                <span style={{ fontWeight: 600, color: t.textSub }}>{usageData.extra_usage.used_credits} / {usageData.extra_usage.monthly_limit}</span>
              </div>
            )}
          </div>
        )}

        {isAuth && <HistorySection history={history} t={t} />}

        {/* 사용자 패턴 분석 */}
        {isAuth && <UsagePatternInsights history={history} t={t} />}

        {!isAuth && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
            <div style={{ fontSize: 12, color: t.textMuted }}>claude.ai에 로그인 후 사용해주세요</div>
            <button
              onClick={() => chrome.tabs.create({ url: 'https://claude.ai/login' })}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#d97706', color: '#ffffff', fontSize: 13, fontWeight: 600,
              }}
            >
              로그인하기
            </button>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
