/**
 * content script からの依頼を受けて /api/capture に投げる。
 * シークレットをここに閉じ込めることで、Netflix ページ内の JS から読めへんようにしとる。
 * MV3 の content script からの fetch は Netflix の origin 扱いで CORS に引っかかるが、
 * background からなら host_permissions で素通りする。
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'capture') return false;

  send(message.payload).then(sendResponse);
  return true; // 非同期で返すので true
});

async function send(payload) {
  const { endpoint, secret, bypass } = await chrome.storage.local.get([
    'endpoint',
    'secret',
    'bypass',
  ]);

  if (!endpoint || !secret) {
    return { ok: false, error: '拡張の設定が未入力です' };
  }

  const headers = {
    'Content-Type': 'application/json',
    'x-capture-secret': secret,
  };

  // Vercel の Deployment Protection を通すため。ローカルや保護なしなら空でよい
  if (bypass) {
    headers['x-vercel-protection-bypass'] = bypass;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { ok: false, error: `送信に失敗しました (${res.status})` };
    }

    const data = await res.json();
    return { ok: true, duplicate: !!data.duplicate };
  } catch {
    return { ok: false, error: '送信に失敗しました' };
  }
}
