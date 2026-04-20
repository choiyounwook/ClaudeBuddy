import type { StorageState, AuthStatus, UserInfo, UsageSnapshot, UsageData, Settings } from './types'
import { DEFAULT_SETTINGS } from './types'

export async function getState(): Promise<StorageState> {
  const s = await chrome.storage.local.get(null)
  return {
    authStatus: s.authStatus ?? 'unknown',
    userInfo: s.userInfo ?? null,
    usageData: s.usageData ?? null,
    usageError: s.usageError ?? null,
    orgId: s.orgId ?? null,
    history: s.history ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(s.settings ?? {}) },
    lastUpdatedAt: s.lastUpdatedAt ?? null,
  }
}

export async function getSettings(): Promise<Settings> {
  const s = await chrome.storage.local.get('settings')
  return { ...DEFAULT_SETTINGS, ...(s.settings ?? {}) }
}

export async function saveSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings()
  const updated = { ...current, ...partial }
  await chrome.storage.local.set({ settings: updated })
  return updated
}

export async function setAuthStatus(status: AuthStatus, userInfo: UserInfo | null): Promise<void> {
  await chrome.storage.local.set({ authStatus: status, userInfo })
}

export async function saveSnapshot(data: UsageData): Promise<void> {
  const now = Date.now()
  const s = await chrome.storage.local.get(['history', 'lastSnapshotAt'])
  if (now - (s.lastSnapshotAt ?? 0) < 15 * 60 * 1000) return

  const history: UsageSnapshot[] = s.history ?? []
  const snapshot: UsageSnapshot = {
    ts: now,
    fh: data.five_hour?.utilization ?? null,
    sd: data.seven_day?.utilization ?? null,
  }
  await chrome.storage.local.set({
    history: [...history, snapshot].slice(-200),
    lastSnapshotAt: now,
  })
}
