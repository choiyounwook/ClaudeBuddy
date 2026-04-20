export type AuthStatus = 'authenticated' | 'unauthenticated' | 'unknown'

export interface UserInfo {
  id: string
  name: string
  email: string
}

export interface UsagePeriod {
  resets_at: string
  utilization: number // 0-100
}

export interface ExtraUsage {
  is_enabled: boolean
  monthly_limit: number | null
  used_credits: number | null
  utilization: number | null
}

export interface UsageData {
  five_hour: UsagePeriod | null
  seven_day: UsagePeriod | null
  seven_day_opus: UsagePeriod | null
  seven_day_sonnet: UsagePeriod | null
  extra_usage: ExtraUsage | null
  [key: string]: unknown
}

export interface UsageSnapshot {
  ts: number        // timestamp (ms)
  fh: number | null // five_hour utilization
  sd: number | null // seven_day utilization
}

export interface Settings {
  badgeMode: 'five_hour' | 'seven_day'   // 배지 표시 기준
  notifThresholds: [number, number]       // 알림 임계값 (%)
  refreshIntervalMin: number              // 새로고침 주기 (분)
  sidePanelEnabled: boolean              // 사이드패널 사용 여부
  notificationEnabled: boolean           // 알림 ON/OFF
  displayMode: 'battery' | 'gauge'       // 사용량 표시 방식
  widgetEnabled: boolean                 // 미니 위젯 사용 여부
  notificationStyle: 'default' | 'minimal' | 'detailed'  // 알림 스타일
  notificationSound: boolean             // 알림 소리
  notificationDuration: number           // 알림 지속시간 (초)
}

export const DEFAULT_SETTINGS: Settings = {
  badgeMode: 'seven_day',
  notifThresholds: [80, 95],
  refreshIntervalMin: 1,
  sidePanelEnabled: false,
  notificationEnabled: true,
  displayMode: 'battery',
  widgetEnabled: false,
  notificationStyle: 'default',
  notificationSound: true,
  notificationDuration: 5,
}

export interface StorageState {
  authStatus: AuthStatus
  userInfo: UserInfo | null
  usageData: UsageData | null
  usageError: string | null
  orgId: string | null
  history: UsageSnapshot[]
  settings: Settings
  lastUpdatedAt: number | null
}

export type MessageType =
  | { type: 'GET_STATE' }
  | { type: 'REFRESH' }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<Settings> }
  | { type: 'STATE_RESPONSE'; payload: StorageState }
