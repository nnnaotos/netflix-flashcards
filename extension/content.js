(() => {
  const SUBTITLE_ROOT = '.player-timedtext';
  const SUBTITLE_LINE = '.player-timedtext-text-container';
  const TITLE_SELECTORS = ['[data-uia="video-title"]', '.video-title'];

  // 「今のフレーズええな」と気づいてキーを押すまで1〜2秒かかる。その間に字幕は消える
  const RECENT_MS = 5000;

  const MODIFIER_KEYS = ['alt', 'ctrl', 'control', 'shift'];

  let current = '';
  let recent = '';
  let recentAt = 0;

  let observer = null;
  let observedRoot = null;
  let hotkey = { alt: true, ctrl: false, shift: false, key: 's' };

  // --- 字幕の読み取り ---

  function readSubtitle() {
    const root = document.querySelector(SUBTITLE_ROOT);
    if (!root) return '';

    // 1行につき1つの container が並ぶ。入れ子の span を舐めると重複するのでこっちを見る
    const lines = root.querySelectorAll(SUBTITLE_LINE);
    const parts = lines.length
      ? Array.from(lines).map((el) => el.textContent ?? '')
      : [root.textContent ?? ''];

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  function update() {
    const text = readSubtitle();

    if (text) {
      current = text;
      recent = text;
      recentAt = Date.now();
    } else {
      // 消えた瞬間を起点にせんと、長く映っとった行ほど猶予が短なる
      if (current) recentAt = Date.now();
      current = '';
    }
  }

  function track() {
    const root = document.querySelector(SUBTITLE_ROOT);
    if (!root) return false;

    observer = new MutationObserver(update);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    observedRoot = root;
    update();

    return true;
  }

  /** エピソードを移ると字幕コンテナごと作り直される。見とる先が消えてたら付け直す */
  function reattachIfDetached() {
    if (observedRoot && document.contains(observedRoot)) return;

    if (observer) observer.disconnect();
    observer = null;
    observedRoot = null;
    current = ''; // コンテナごと消えたときは update() が走らへんので、古い字幕が残ったままになる
    track();
  }

  function phraseToSend() {
    if (current) return current;
    if (recent && Date.now() - recentAt < RECENT_MS) return recent;
    return '';
  }

  function readTitle() {
    for (const selector of TITLE_SELECTORS) {
      const el = document.querySelector(selector);
      if (!el) continue;

      // シリーズ名・話数・エピソード名が子要素に分かれとるので、先頭＝シリーズ名を取る
      const head = el.firstElementChild ?? el;
      // シリーズ名の後ろに話数とエピソード名が続く。改行で切ってから畳まんと全部繋がってまう
      const text = (head.textContent ?? '').split('\n')[0].replace(/\s+/g, ' ').trim();
      if (text) return text;
    }
    return '';
  }

  // --- トースト ---

  let toastEl = null;
  let toastTimer = null;

  const TOAST_COLORS = { success: '#1a3a1a', error: '#3a1a1a', info: '#26262e' };

  function toast(message, kind) {
    // Netflix はフルスクリーンで観るので、body に挿すと見えへん
    const host = document.fullscreenElement ?? document.body;

    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText = [
        'position:fixed',
        'top:24px',
        'left:50%',
        'transform:translateX(-50%)',
        'padding:10px 18px',
        'border-radius:10px',
        'z-index:2147483647',
        'font:600 14px/1.4 system-ui,sans-serif',
        'color:#fff',
        'pointer-events:none',
        'max-width:70vw',
        'transition:opacity .3s',
      ].join(';');
    }

    if (toastEl.parentNode !== host) host.appendChild(toastEl);

    toastEl.style.background = TOAST_COLORS[kind] ?? TOAST_COLORS.info;
    toastEl.textContent = message;
    toastEl.style.opacity = '1';

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.style.opacity = '0';
    }, 2500);
  }

  // --- 送信 ---

  async function capture() {
    reattachIfDetached();

    const phrase = phraseToSend();
    if (!phrase) {
      toast('字幕が取得できません', 'error');
      return;
    }

    toast('送信中…', 'info');

    const show = readTitle();
    let res;
    try {
      res = await chrome.runtime.sendMessage({
        type: 'capture',
        payload: show ? { phrase, show } : { phrase },
      });
    } catch {
      // 拡張をリロードすると、開いたままのタブの content script は chrome.* を失う
      toast('拡張を再読み込みしたときは、Netflix のタブも再読み込みしてください', 'error');
      return;
    }

    if (!res?.ok) {
      toast(res?.error ?? '送信に失敗しました', 'error');
    } else if (res.duplicate) {
      toast('既に登録済み', 'info');
    } else {
      toast(`保存しました: ${phrase.slice(0, 40)}`, 'success');
    }
  }

  // --- ホットキー ---

  function parseHotkey(value) {
    const parts = String(value || 'Alt+S')
      .split('+')
      .map((p) => p.trim().toLowerCase());

    const key = parts[parts.length - 1];

    // 修飾キーだけや末尾が空やと、二度と発火せえへんか毎打鍵で発火してまう
    if (!key || MODIFIER_KEYS.includes(key)) {
      return { alt: true, ctrl: false, shift: false, key: 's' };
    }

    return {
      alt: parts.includes('alt'),
      ctrl: parts.includes('ctrl') || parts.includes('control'),
      shift: parts.includes('shift'),
      key,
    };
  }

  function isTyping(target) {
    if (!(target instanceof HTMLElement)) return false;
    return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
  }

  chrome.storage.local.get('hotkey').then(({ hotkey: value }) => {
    hotkey = parseHotkey(value);
  });

  window.addEventListener(
    'keydown',
    (e) => {
      if (!e.isTrusted) return; // ページ側のスクリプトが合成したキーでは発火させへん
      if (isTyping(e.target)) return;
      if (e.key.toLowerCase() !== hotkey.key) return;
      if (e.altKey !== hotkey.alt) return;
      if (e.ctrlKey !== hotkey.ctrl) return;
      if (e.shiftKey !== hotkey.shift) return;

      // Netflix 自身のショートカットに渡さへん
      e.preventDefault();
      e.stopPropagation();

      capture();
    },
    true // capture フェーズで先に拾う
  );

  // --- 起動 ---

  // Netflix は SPA なのでプレイヤーは後から現れる。出てくるまで body を軽く見張る
  if (!track()) {
    const boot = new MutationObserver(() => {
      if (track()) boot.disconnect();
    });
    boot.observe(document.body, { childList: true, subtree: true });
  }
})();
