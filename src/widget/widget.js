let isUpdating = false;

async function loadUsage() {
  if (isUpdating) return;
  isUpdating = true;

  try {
    const data = await chrome.storage.local.get(['claudeUsage', 'settings']);
    const usage = data.claudeUsage || {};
    const settings = data.settings || {};
    
    updateUsageDisplay(usage, settings);
  } catch (error) {
    console.error('Failed to load usage:', error);
    document.getElementById('usage-container').innerHTML = 
      '<div class="usage-item"><span class="usage-label">데이터 로드 오류</span></div>';
  } finally {
    isUpdating = false;
  }
}

function updateUsageDisplay(usage, settings) {
  const container = document.getElementById('usage-container');
  
  if (!usage.models || Object.keys(usage.models).length === 0) {
    container.innerHTML = '<div class="usage-item"><span class="usage-label">사용 데이터 없음</span></div>';
    return;
  }

  const total = usage.total || {};
  const inputTokens = total.inputTokens || 0;
  const outputTokens = total.outputTokens || 0;
  const totalCost = total.cost || 0;
  
  // 진행률 계산 (가정된 월간 한도 기준)
  const MONTHLY_LIMIT = 30; // $30 per month assumption
  const costPercent = Math.min((totalCost / MONTHLY_LIMIT) * 100, 100);
  
  const color = getProgressColor(costPercent);

  container.innerHTML = `
    <div class="usage-item">
      <span class="usage-label">이번 달 비용</span>
      <span class="usage-value">$${totalCost.toFixed(3)}</span>
    </div>
    <div class="usage-bar">
      <div class="usage-progress" style="width: ${costPercent}%; background: ${color}"></div>
    </div>
    
    <div class="usage-item">
      <span class="usage-label">입력 토큰</span>
      <span class="usage-value">${formatNumber(inputTokens)}</span>
    </div>
    
    <div class="usage-item">
      <span class="usage-label">출력 토큰</span>
      <span class="usage-value">${formatNumber(outputTokens)}</span>
    </div>
  `;
}

function getProgressColor(percent) {
  if (percent < 50) return '#10b981';
  if (percent < 80) return '#f59e0b';
  return '#ef4444';
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// 스토리지 변경 감지
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes.claudeUsage || changes.settings)) {
    loadUsage();
  }
});

// 주기적 업데이트
setInterval(loadUsage, 30000); // 30초마다 업데이트

// 초기 로드
document.addEventListener('DOMContentLoaded', loadUsage);

// 키보드 단축키
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.close();
  }
});

// 창 크기 최적화
window.addEventListener('load', () => {
  if (window.resizeTo) {
    window.resizeTo(250, 150);
  }
});