import { useEffect, useState, type CSSProperties } from 'react'
import type { StorageState, UsagePeriod, Settings } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/types'

// ── 테마 ──────────────────────────────────────────────────
const LIGHT = {
  bg: '#ffffff', cardBg: '#f9fafb', border: '#e5e7eb',
  text: '#111827', textSub: '#6b7280', textMuted: '#9ca3af', barBg: '#f3f4f6',
  settingsBg: '#f9fafb', settingsBorder: '#e5e7eb',
  inputBg: '#ffffff', inputBorder: '#d1d5db',
  toggleActive: '#111827', toggleInactive: '#e5e7eb',
  toggleTextActive: '#ffffff', toggleTextInactive: '#6b7280',
}
const DARK = {
  bg: '#111827', cardBg: '#1f2937', border: '#374151',
  text: '#f9fafb', textSub: '#d1d5db', textMuted: '#9ca3af', barBg: '#374151',
  settingsBg: '#1a2332', settingsBorder: '#374151',
  inputBg: '#1f2937', inputBorder: '#4b5563',
  toggleActive: '#f9fafb', toggleInactive: '#374151',
  toggleTextActive: '#111827', toggleTextInactive: '#9ca3af',
}
type Theme = typeof LIGHT

function useTheme() {
  const [isDark, setIsDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const fn = (e: MediaQueryListEvent) => setIsDark(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return isDark ? DARK : LIGHT
}

// ── 유틸 ──────────────────────────────────────────────────
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

function timeAgo(ts: number | null): string {
  if (!ts) return ''
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  return `${Math.floor(m / 60)}시간 전`
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

// ── 사용량 행 ─────────────────────────────────────────────
function UsageRow({ label, period, t, displayMode }: { label: string; period: UsagePeriod; t: Theme; displayMode: 'battery' | 'gauge' }) {
  const { utilization: pct, resets_at } = period
  const remaining = 100 - pct
  const color = usageColor(pct)
  return (
    <div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{label}</span>
        {displayMode === 'battery' ? (
          <span style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{remaining}%</span>
        ) : (
          <SemicircleGauge pct={pct} t={t} />
        )}
      </div>
      {displayMode === 'battery' && (
        <div style={{ height: 6, background: t.barBg, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${remaining}%`, background: color, borderRadius: 999, transition: 'width 0.5s ease' }} />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: t.textMuted }}>초기화까지</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: t.textSub }}>{timeUntil(resets_at)}</span>
      </div>
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

      <div>
        <span style={labelStyle}>배지 표시</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={toggleBtn(settings.badgeMode === 'seven_day')} onClick={() => onChange({ badgeMode: 'seven_day' })}>주간</button>
          <button style={toggleBtn(settings.badgeMode === 'five_hour')} onClick={() => onChange({ badgeMode: 'five_hour' })}>5시간</button>
        </div>
      </div>

      <div>
        <span style={labelStyle}>알림 기준 (%)</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input style={inputStyle} value={t1} onChange={(e) => setT1(e.target.value)} onBlur={applyThresholds} maxLength={3} />
          <span style={{ fontSize: 12, color: t.textMuted }}>%</span>
          <span style={{ fontSize: 12, color: t.textMuted }}>/</span>
          <input style={inputStyle} value={t2} onChange={(e) => setT2(e.target.value)} onBlur={applyThresholds} maxLength={3} />
          <span style={{ fontSize: 12, color: t.textMuted }}>%</span>
        </div>
      </div>

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

      <div>
        <span style={labelStyle}>미니 대시보드</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: t.textMuted }}>아이콘 클릭 시 사이드패널 열기</span>
          <button style={toggleBtn(settings.sidePanelEnabled)} onClick={() => onChange({ sidePanelEnabled: !settings.sidePanelEnabled })}>
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

export default function SidePanelApp() {
  const t = useTheme()
  const [state, setState] = useState<StorageState>(DEFAULT_STATE)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [saved, setSaved] = useState(false)
  const [, setTick] = useState(0)

  function load() {
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

  useEffect(() => {
    load()

    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      const keys = ['usageData', 'authStatus', 'userInfo', 'usageError', 'lastUpdatedAt']
      if (keys.some((k) => k in changes)) {
        chrome.storage.local.get(null, (s) => {
          setState((prev) => ({
            ...prev,
            authStatus: s.authStatus ?? prev.authStatus,
            userInfo: s.userInfo ?? prev.userInfo,
            usageData: s.usageData ?? prev.usageData,
            usageError: s.usageError ?? prev.usageError,
            lastUpdatedAt: s.lastUpdatedAt ?? prev.lastUpdatedAt,
          }))
        })
      }
    }
    chrome.storage.onChanged.addListener(handler)

    const id = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => {
      chrome.storage.onChanged.removeListener(handler)
      clearInterval(id)
    }
  }, [])

  const { authStatus, userInfo, usageData, lastUpdatedAt, settings } = state
  const isAuth = authStatus === 'authenticated'

  return (
    <div style={{ background: t.bg, minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* 헤더 */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={chrome.runtime.getURL('icons/icon48.png')} style={{ width: 24, height: 24 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>ClaudeBuddy</div>
            {isAuth && userInfo && (
              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 1 }}>{userInfo.email || userInfo.name}</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {!loading && lastUpdatedAt && (
            <span style={{ fontSize: 10, color: t.textMuted }}>{timeAgo(lastUpdatedAt)}</span>
          )}
          {!loading && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: isAuth ? '#ecfdf5' : '#fef2f2', color: isAuth ? '#059669' : '#dc2626' }}>
              {isAuth ? '연결됨' : '미연결'}
            </span>
          )}
          <button
            title="설정"
            onClick={() => setShowSettings((v) => !v)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: showSettings ? t.text : t.textMuted, fontSize: 14, padding: '2px 4px', lineHeight: 1 }}
          >⚙</button>
          <button
            onClick={load}
            disabled={loading}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 16, padding: '2px 4px', lineHeight: 1 }}
          >
            <span style={{ display: 'inline-block', animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>↻</span>
          </button>
        </div>
      </div>

      {/* 콘텐츠 */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 160 }}>
          <div style={{ width: 24, height: 24, border: `3px solid ${t.barBg}`, borderTopColor: '#d97706', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : !isAuth ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 16px' }}>
          <div style={{ fontSize: 13, color: t.textMuted }}>claude.ai에 로그인 후 사용해주세요</div>
          <button
            onClick={() => chrome.tabs.create({ url: 'https://claude.ai/login' })}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#d97706', color: '#ffffff', fontSize: 13, fontWeight: 600 }}
          >
            로그인하기
          </button>
        </div>
      ) : (
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {showSettings && <SettingsPanel settings={settings} t={t} onChange={updateSettings} saved={saved} />}
          {usageData?.five_hour && <UsageRow label="5시간 사용량" period={usageData.five_hour} t={t} displayMode={settings.displayMode} />}
          {usageData?.seven_day && <UsageRow label="주간 사용량 (7일)" period={usageData.seven_day} t={t} displayMode={settings.displayMode} />}
          {usageData?.seven_day_opus && <UsageRow label="주간 Opus" period={usageData.seven_day_opus} t={t} displayMode={settings.displayMode} />}
          {usageData?.seven_day_sonnet && <UsageRow label="주간 Sonnet" period={usageData.seven_day_sonnet} t={t} displayMode={settings.displayMode} />}
        </div>
      )}
    </div>
  )
}
