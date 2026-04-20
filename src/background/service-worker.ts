import { setAuthStatus, getState, saveSnapshot, getSettings, saveSettings } from '../shared/storage'
import type { MessageType, UserInfo, UsageData, UsagePeriod, Settings } from '../shared/types'

// ── org ID ────────────────────────────────────────────────
async function getOrgId(): Promise<string | null> {
  const cookie = await chrome.cookies.get({ url: 'https://claude.ai', name: 'lastActiveOrg' })
  return cookie?.value ?? null
}

// ── 키보드 단축키 처리 ──────────────────────────────────────
chrome.commands.onCommand.addListener(async (command) => {
  switch (command) {
    case 'toggle-popup':
      chrome.action.openPopup()
      break
    case 'toggle-sidepanel':
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tabs[0]?.id) {
        chrome.sidePanel.open({ tabId: tabs[0].id })
      }
      break
    case 'toggle-widget':
      await toggleMiniWidget()
      break
  }
})

// ── 미니 위젯 관리 ──────────────────────────────────────────
let widgetWindowId: number | null = null

async function toggleMiniWidget() {
  const settings = await getSettings()
  
  if (widgetWindowId) {
    // 위젯이 이미 열려있으면 닫기
    try {
      await chrome.windows.remove(widgetWindowId)
      widgetWindowId = null
      await saveSettings({ ...settings, widgetEnabled: false })
    } catch {
      widgetWindowId = null
    }
    return
  }

  // 위젯 창 생성
  const window = await chrome.windows.create({
    url: chrome.runtime.getURL('src/widget/widget.html'),
    type: 'popup',
    width: 280,
    height: 200,
    top: 50,
    left: 50,
    focused: false
  })
  
  if (window.id) {
    widgetWindowId = window.id
    await saveSettings({ ...settings, widgetEnabled: true })
  }
}

// 창이 닫혔을 때 처리
chrome.windows.onRemoved.addListener(async (windowId) => {
  if (windowId === widgetWindowId) {
    widgetWindowId = null
    const settings = await getSettings()
    await saveSettings({ ...settings, widgetEnabled: false })
  }
})

// ── 인증 확인 ─────────────────────────────────────────────
function clearBadge(): void {
  chrome.action.setBadgeText({ text: '' })
}

async function checkAuth(): Promise<void> {
  try {
    const session = await chrome.cookies.get({ url: 'https://claude.ai', name: 'sessionKey' })
    if (!session) { await setAuthStatus('unauthenticated', null); clearBadge(); return }

    const resp = await fetch('https://claude.ai/api/account', { credentials: 'include' })
    if (!resp.ok) { await setAuthStatus('unauthenticated', null); clearBadge(); return }

    const account = await resp.json()
    const userInfo: UserInfo = {
      id: account?.id ?? 'unknown',
      name: account?.full_name ?? account?.name ?? 'Unknown',
      email: account?.email_address ?? account?.email ?? '',
    }
    await setAuthStatus('authenticated', userInfo)
  } catch {
    await setAuthStatus('unknown', null)
  }
}

// ── 배지 ──────────────────────────────────────────────────
function badgeColor(pct: number): string {
  if (pct >= 95) return '#ef4444'
  if (pct >= 80) return '#f97316'
  if (pct >= 50) return '#f59e0b'
  return '#10b981'
}

async function updateBadge(data: UsageData, settings: Settings): Promise<void> {
  const pct = settings.badgeMode === 'five_hour'
    ? (data.five_hour?.utilization ?? 0)
    : (data.seven_day?.utilization ?? 0)
  const remaining = 100 - pct

  chrome.action.setBadgeText({ text: pct > 0 ? String(remaining) : '' })
  chrome.action.setBadgeBackgroundColor({ color: badgeColor(pct) })
}

// ── 알림 ──────────────────────────────────────────────────
function createNotificationContent(label: string, pct: number, threshold: number, style: string) {
  const baseContent = {
    type: 'basic' as const,
    iconUrl: 'icons/icon48.png',
    title: 'ClaudeBuddy',
    priority: threshold >= 95 ? 2 : 1,
  }

  switch (style) {
    case 'minimal':
      return {
        ...baseContent,
        message: `${label} ${threshold}%`
      }
    case 'detailed':
      const emoji = threshold >= 95 ? '🚨' : threshold >= 80 ? '⚠️' : '📊'
      const status = threshold >= 95 ? '위험' : threshold >= 80 ? '주의' : '정상'
      return {
        ...baseContent,
        title: `${emoji} ClaudeBuddy - ${status}`,
        message: `${label} 사용량: ${pct}% / 임계값: ${threshold}%\n${threshold >= 95 ? '사용을 자제해주세요!' : '사용량을 확인해보세요.'}`
      }
    default: // 'default'
      return {
        ...baseContent,
        message: `${label} 사용량이 ${threshold}%에 도달했습니다.`
      }
  }
}

async function checkNotifications(data: UsageData, settings: Settings): Promise<void> {
  if (!settings.notificationEnabled) return

  const s = await chrome.storage.local.get('notifState')
  const state: Record<string, { resetAt: string; notified: number[] }> = s.notifState ?? {}

  const periods: Array<{ key: string; period: UsagePeriod | null; label: string }> = [
    { key: 'fh', period: data.five_hour, label: '5시간' },
    { key: 'sd', period: data.seven_day, label: '주간' },
  ]

  for (const { key, period, label } of periods) {
    if (!period) continue
    const { utilization: pct, resets_at } = period

    const storedResetTime = state[key] ? new Date(state[key].resetAt).getTime() : 0
    if (Date.now() >= storedResetTime) {
      // 저장된 리셋 시각이 지났으면 새 주기 시작
      state[key] = { resetAt: resets_at, notified: [] }
    }

    for (const threshold of settings.notifThresholds) {
      if (pct >= threshold && !state[key].notified.includes(threshold)) {
        const notificationId = `${key}_${threshold}_${Date.now()}`
        const notificationContent = createNotificationContent(label, pct, threshold, settings.notificationStyle)
        
        chrome.notifications.create(notificationId, notificationContent)
        
        // 알림 지속시간 설정
        if (settings.notificationDuration > 0) {
          setTimeout(() => {
            chrome.notifications.clear(notificationId)
          }, settings.notificationDuration * 1000)
        }
        
        state[key].notified.push(threshold)
      }
    }
  }

  await chrome.storage.local.set({ notifState: state })
}

// ── usage 호출 ─────────────────────────────────────────────
async function fetchUsage(): Promise<void> {
  const orgId = await getOrgId()
  if (!orgId) {
    await chrome.storage.local.set({ usageData: null, usageError: 'org_not_found' })
    return
  }

  try {
    const resp = await fetch(
      `https://claude.ai/api/organizations/${orgId}/usage`,
      { credentials: 'include' },
    )
    if (!resp.ok) {
      if (resp.status === 403) {
        await setAuthStatus('unauthenticated', null)
        clearBadge()
        await chrome.storage.local.set({ usageData: null, usageError: null })
      } else {
        await chrome.storage.local.set({ usageData: null, usageError: `http_${resp.status}` })
      }
      return
    }

    const data: UsageData = await resp.json()
    await chrome.storage.local.set({ usageData: data, usageError: null, orgId, lastUpdatedAt: Date.now() })

    const settings = await getSettings()
    await updateBadge(data, settings)
    await checkNotifications(data, settings)
    await saveSnapshot(data)
  } catch (err) {
    await chrome.storage.local.set({ usageData: null, usageError: String(err) })
  }
}

// ── 알람 재설정 ────────────────────────────────────────────
async function resetAlarm(intervalMin: number): Promise<void> {
  await chrome.alarms.clear('refresh')
  chrome.alarms.create('refresh', { periodInMinutes: intervalMin })
}

// ── 메시지 핸들러 ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
  ;(async () => {
    switch (message.type) {
      case 'GET_STATE':
      case 'REFRESH': {
        await Promise.all([checkAuth(), fetchUsage()])
        const state = await getState()
        sendResponse({ type: 'STATE_RESPONSE', payload: state })
        break
      }
      case 'UPDATE_SETTINGS': {
        const updated = await saveSettings(message.payload)
        // 배지 모드 즉시 반영
        const s = await chrome.storage.local.get('usageData')
        if (s.usageData) await updateBadge(s.usageData, updated)
        // 새로고침 주기 변경 시 알람 재설정
        if (message.payload.refreshIntervalMin !== undefined) {
          await resetAlarm(updated.refreshIntervalMin)
        }
        // 사이드패널 동작 변경
        if (message.payload.sidePanelEnabled !== undefined) {
          chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: updated.sidePanelEnabled })
        }
        const state = await getState()
        sendResponse({ type: 'STATE_RESPONSE', payload: state })
        break
      }
    }
  })()
  return true
})

// ── 초기화 ────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings()
  await resetAlarm(settings.refreshIntervalMin)
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: settings.sidePanelEnabled })
  checkAuth()
  fetchUsage()
})

chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings()
  await resetAlarm(settings.refreshIntervalMin)
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: settings.sidePanelEnabled })
  checkAuth()
  fetchUsage()
})

chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
  if (info.status === 'complete' && tab.url?.startsWith('https://claude.ai')) {
    checkAuth()
    fetchUsage()
  }
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refresh') fetchUsage()
})
