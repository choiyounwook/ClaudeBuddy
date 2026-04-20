// claude.ai 페이지에서 실행. fetch를 래핑하여 API 응답의 usage 데이터를 파싱함.

const originalFetch = window.fetch.bind(window)

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const response = await originalFetch(input, init)
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

  // 스트리밍 메시지 응답 (usage 포함)
  if (url.includes('/api/organizations/') && url.includes('/chat_conversations/') && url.includes('/completion')) {
    parseStreamingResponse(response.clone())
  }

  return response
}

async function parseStreamingResponse(response: Response): Promise<void> {
  try {
    const text = await response.text()
    const lines = text.split('\n').filter((l) => l.startsWith('data:'))

    for (const line of lines) {
      const raw = line.slice(5).trim()
      if (!raw || raw === '[DONE]') continue

      try {
        const event = JSON.parse(raw)

        // usage 정보가 담긴 이벤트
        if (event.type === 'message_delta' && event.usage) {
          const { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens } = event.usage

          chrome.runtime.sendMessage({
            type: 'USAGE_UPDATED',
            payload: {
              inputTokens: input_tokens ?? 0,
              outputTokens: output_tokens ?? 0,
              cacheCreationTokens: cache_creation_input_tokens ?? 0,
              cacheReadTokens: cache_read_input_tokens ?? 0,
            },
          })
        }

        // 모델 정보
        if (event.type === 'message_start' && event.message?.model) {
          chrome.runtime.sendMessage({
            type: 'USAGE_UPDATED',
            payload: { model: event.message.model, inputTokens: 0, outputTokens: 0 },
          })
        }
      } catch {
        // JSON 파싱 실패는 무시
      }
    }
  } catch {
    // 응답 읽기 실패는 무시
  }
}
