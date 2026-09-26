const FIELDS = ['endpoint', 'secret', 'bypass', 'hotkey'];

const status = document.getElementById('status');

function say(message) {
  status.textContent = message;
  setTimeout(() => {
    if (status.textContent === message) status.textContent = '';
  }, 4000);
}

chrome.storage.local.get(FIELDS).then((saved) => {
  for (const key of FIELDS) {
    document.getElementById(key).value = saved[key] ?? '';
  }
  if (!saved.hotkey) document.getElementById('hotkey').value = 'Alt+S';
});

document.getElementById('save').addEventListener('click', async () => {
  const values = {};
  for (const key of FIELDS) {
    values[key] = document.getElementById(key).value.trim();
  }
  values.hotkey = values.hotkey || 'Alt+S';

  await chrome.storage.local.set(values);
  say('保存しました');
});

document.getElementById('test').addEventListener('click', async () => {
  say('送信中…');

  const res = await chrome.runtime.sendMessage({
    type: 'capture',
    payload: { phrase: 'extension test', show: 'SUITS' },
  });

  if (!res?.ok) {
    say(res?.error ?? '送信に失敗しました');
  } else {
    say(res.duplicate ? '既に登録済み（疎通OK）' : '送信できました');
  }
});
