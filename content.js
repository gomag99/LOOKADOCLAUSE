// ===== 設定（ここをいじると盛り具合が変わる） =====
const FINGERS_PER_BUTTON = 12;  // 1つのボタンを囲む指の数
const FINGER_GAP = 30;          // ボタンの端から指までの距離(px)
const CONFETTI_COUNT = 150;     // 1回に出す紙吹雪の数
const COLORS = ['#ff0040', '#ffd700', '#00e5ff', '#7cff00', '#ff00d4', '#ff8800'];

// ===== 閉じるボタンの見つけ方 =====
const SELECTORS = [
  '[aria-label*="close" i]',
  '[aria-label*="閉じる"]',
  '[aria-label*="dismiss" i]',
  '[title*="close" i]',
  '[title*="閉じる"]',
  
];
const X_CHARS = ['×', '✕', '✖', '✗', 'X', 'x', '閉じる'];
const MAX_SIZE = 150;
// close / dismiss が「単語として」入ってるかチェック
// OK: ad-close, close-btn, closeBtn, modalClose
// NG: closed, closest, enclose, closet
const CLOSE_WORD = /(?:^|[-_])(?:close|dismiss)(?![a-z])|(?<=[a-z])(?:Close|Dismiss)(?![a-z])/;

function hasCloseName(el) {
  return [...el.classList, el.id].some((name) => CLOSE_WORD.test(name));
}
// ===== 指と紙吹雪を置くレイヤーを1枚だけ作る =====
const layer = document.createElement('div');
layer.id = 'cbh-layer';
document.body.appendChild(layer);

// 光らせ中のボタン → そのボタンを囲む指たち
const tracked = new Map();

function isSmallEnough(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.width <= MAX_SIZE && r.height <= MAX_SIZE;
}

function highlight(el) {
  if (tracked.has(el)) return;
  if (!isSmallEnough(el)) return;
  el.classList.add('cbh-highlight');
  tracked.set(el, createFingers());
  el.addEventListener('click', onCloseClick, true);
}

function createFingers() {
  const fingers = [];
  for (let i = 0; i < FINGERS_PER_BUTTON; i++) {
    const f = document.createElement('div');
    f.className = 'cbh-finger';
    const span = document.createElement('span');
    span.textContent = '👉';
    span.style.animationDelay = `${i * 0.05}s`; // ちょっとずつずらしてウネウネさせる
    f.appendChild(span);
    layer.appendChild(f);
    fingers.push(f);
  }
  return fingers;
}

// ===== 毎フレーム、指をボタンの周りに並べ直す =====
function updatePositions() {
  for (const [el, fingers] of tracked) {
    // ボタンがページから消えたら指も片付ける
    if (!el.isConnected) {
      fingers.forEach((f) => f.remove());
      tracked.delete(el);
      continue;
    }
    const r = el.getBoundingClientRect();
    const visible = r.width > 0 && r.height > 0;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const radius = Math.max(r.width, r.height) / 2 + FINGER_GAP;

    fingers.forEach((f, i) => {
      const angle = (2 * Math.PI * i) / fingers.length;
      f.style.display = visible ? '' : 'none';
      f.style.left = `${cx + Math.cos(angle) * radius}px`;
      f.style.top = `${cy + Math.sin(angle) * radius}px`;
      // 👉は右向きなので、中心の方向（angle + 180°）に回す
      f.style.transform = `translate(-50%, -50%) rotate(${angle + Math.PI}rad)`;
    });
  }
  requestAnimationFrame(updatePositions);
}
requestAnimationFrame(updatePositions);

// ===== 紙吹雪 =====
function burst(x, y, angleDeg = -90, spreadDeg = 360) {
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const p = document.createElement('div');
    p.className = 'cbh-confetti';
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = COLORS[i % COLORS.length];
    layer.appendChild(p);

    const a = ((angleDeg + (Math.random() - 0.5) * spreadDeg) * Math.PI) / 180;
    const speed = 200 + Math.random() * 500;
    const dx = Math.cos(a) * speed;
    const dy = Math.sin(a) * speed;
    const spin = Math.random() * 1440;

    const anim = p.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx * 0.8}px, ${dy * 0.8}px) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${dx}px, ${dy + 600}px) rotate(${spin}deg)`, opacity: 0 }, // 最後は重力で落ちる
      ],
      { duration: 1500 + Math.random() * 1000, easing: 'ease-out' }
    );
    anim.onfinish = () => p.remove();
  }
}

function onCloseClick(e) {
  burst(e.clientX, e.clientY);
  // 広告がiframeの中だと、閉じた瞬間にiframeごと消えて紙吹雪も消える。
  // だから一番外側のページにも「紙吹雪よろしく」と伝える
  if (window !== window.top) {
    window.top.postMessage({ type: 'cbh-confetti' }, '*');
  }
}

// 一番外側のページは、iframeからの合図で左右の下からクラッカー発射🎉
if (window === window.top) {
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'cbh-confetti') {
      burst(0, innerHeight, -60, 40);
      burst(innerWidth, innerHeight, -120, 40);
    }
  });
}

// ===== スキャン =====
function scan(root) {
  root.querySelectorAll(SELECTORS.join(',')).forEach(highlight);

    // クラス名・IDは一旦ゆるく拾ってから、正規表現でちゃんと選別
  root.querySelectorAll('[class*="close" i], [id*="close" i], [class*="dismiss" i]')
    .forEach((el) => { if (hasCloseName(el)) highlight(el); });
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (X_CHARS.includes(node.textContent.trim()) && node.parentElement) {
      highlight(node.parentElement);
    }
  }
}

scan(document.body);

let timer = null;
const observer = new MutationObserver((mutations) => {
  // 自分で出した指や紙吹雪の変化は無視（無視しないと紙吹雪のたびに再スキャンが走る）
  if (mutations.every((m) => m.target === layer)) return;
  clearTimeout(timer);
  timer = setTimeout(() => scan(document.body), 300);
});
observer.observe(document.body, { childList: true, subtree: true });
