/* 酒場ドラフト戦記 — Service Worker
   オフラインでも遊べるよう、アプリ本体（app shell）を事前キャッシュする。
   ファイルを更新して公開するときは CACHE_VERSION を上げること（古いキャッシュは自動削除される） */
'use strict';

const CACHE_VERSION = 'sakaba-v1.14.0';  // アプリ本体（コード変更で上げる）
const MEDIA_CACHE = 'sakaba-media-v2';   // BGM（音源を差し替えたときだけ上げる）
const FONT_CACHE = 'sakaba-fonts-v1';

/* BGM（オフライン再生用にプリキャッシュ）。m4a(AAC)＝iOSでも再生可・空白なし名。 */
const MEDIA = [
  './audio/bgm/menu.m4a',
  './audio/bgm/departure.m4a',
  './audio/bgm/battle_grassland.m4a',
  './audio/bgm/battle_mountain.m4a',
  './audio/bgm/battle_snow.m4a',
  './audio/bgm/battle_boss.m4a',
  './audio/bgm/feast.m4a',
  './audio/bgm/win_end.m4a',
  './audio/bgm/lose_end.m4a',
];

/* ユニットのドット絵（js/data.js の定義に img: を足したら、ここにも同じパスを列挙する）。
   ベストエフォート＝ファイルが無くてもインストールは失敗しない。
   ※列挙し忘れてもオンライン時は通常キャッシュで表示される（オフライン初回のみ欠ける） */
const UNIT_ART = [
  // './img/units/sword.png',
];

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/game.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE_VERSION);
    await c.addAll(APP_SHELL);   // アプリ本体は必須（失敗＝インストール失敗）
    // BGM はベストエフォートで別キャッシュへ（1つ失敗してもインストールは続行。
    // 既にキャッシュ済みならスキップ＝アプリ更新のたびに再DLしない）
    const m = await caches.open(MEDIA_CACHE);
    await Promise.allSettled(MEDIA.map((u) =>
      m.match(u).then((hit) => hit || fetch(u).then((res) => {
        if (res.status === 200) return m.put(u, res.clone());
      }))
    ));
    // ユニットのドット絵もベストエフォートで本体キャッシュへ（欠けてもインストール続行）
    await Promise.allSettled(UNIT_ART.map((u) =>
      fetch(u).then((res) => { if (res.status === 200) return c.put(u, res.clone()); })
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION && k !== MEDIA_CACHE && k !== FONT_CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // ページ遷移: ネットワーク優先（最新版を取りに行き、オフライン時はキャッシュ）
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Google Fonts: キャッシュ優先（フォントはほぼ変わらないため）
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONT_CACHE).then((c) =>
        c.match(req).then((hit) => hit || fetch(req).then((res) => {
          if (res.ok || res.type === 'opaque') c.put(req, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  // 音声(BGM): キャッシュ優先。プリキャッシュ済みならオフラインでも鳴る。
  // Range 付きでも保存済みのフル応答(200)を返す（メディア要素は200全体を受理する）。
  if (url.pathname.includes('/audio/')) {
    e.respondWith(
      caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req))
    );
    return;
  }

  // その他の Range リクエスト（部分取得）はキャッシュを介さず素通し。
  // 206 応答は Cache API に保存できず、無理に保存すると再生が壊れるため。
  if (req.headers.has('range')) {
    e.respondWith(fetch(req).catch(() => caches.match(req, { ignoreVary: true })));
    return;
  }

  // 同一オリジンの静的ファイル: キャッシュ即応答＋裏で更新（stale-while-revalidate）
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(CACHE_VERSION).then((c) =>
        c.match(req).then((hit) => {
          const refresh = fetch(req)
            .then((res) => {
              // 完全応答(200)のみ保存。206/opaque 等は保存しない。put 失敗は握りつぶす
              if (res.status === 200) c.put(req, res.clone()).catch(() => {});
              return res;
            })
            .catch(() => hit);
          return hit || refresh;
        })
      )
    );
  }
});
