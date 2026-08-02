/* 酒場ドラフト戦記 — Service Worker
   オフラインでも遊べるよう、アプリ本体（app shell）を事前キャッシュする。
   ファイルを更新して公開するときは CACHE_VERSION を上げること（古いキャッシュは自動削除される） */
'use strict';

const CACHE_VERSION = 'sakaba-v1.51.0';  // アプリ本体（コード変更で上げる）
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
  './img/map_sample2.webp',   // 盤面背景アトラス（4×4・1088×1448・WebP）。ベストエフォート（失敗してもオンライン時に取得）
  // 地形の小物（盤に散る草花）。data.js の BIOMES[].props と対で増やす
  './img/map/glass1.png', './img/map/glass2.png', './img/map/flower1.png',
  // ドット絵ユニット（全身立ち絵）。定義に img: を足すたびここにも列挙する（現在は味方18体・仮絵）
  './img/units/sword.png', './img/units/guard.png', './img/units/appr.png', './img/units/pedl.png',
  './img/units/prayr.png', './img/units/relic.png', './img/units/knight.png', './img/units/blade.png',
  './img/units/alchm.png', './img/units/clerc.png', './img/units/golem.png', './img/units/carav.png',
  './img/units/genrl.png', './img/units/amage.png', './img/units/proph.png', './img/units/tamer.png',
  './img/units/fortr.png', './img/units/tycon.png',
  // 敵（雑魚5・エース3・ボス魔王）の仮ドット絵
  './img/units/e_gobl.png', './img/units/e_wolf.png', './img/units/e_arch.png', './img/units/e_scor.png',
  './img/units/e_spid.png', './img/units/e_dragon.png', './img/units/e_ogre.png', './img/units/e_darkmage.png',
  './img/units/e_maou.png', './img/units/e_bat.png',
  // 隠しキャラ（盤面に立つ）: 勇者・味方魔王・精霊・守護精霊・闘技場の幽霊
  // ※ シーフ(thief)は引退ユニット。絵は img/units/old/ へ退避し、配布からも外した（絵文字🥷で出る）
  './img/units/hero.png', './img/units/allymaou.png', './img/units/spirit.png',
  './img/units/gspirit.png', './img/units/ghost.png',
  // 募兵カードにだけ出る面々: 珍客4種・疲れた実力者5系統
  // ワンコは絵柄3種（中身は同じ。わんこ喫茶では全種類が並ぶので3枚とも要る）
  './img/units/g_dog.png', './img/units/g_dog2.png', './img/units/g_dog3.png',
  './img/units/g_cat.png', './img/units/g_nurse.png', './img/units/g_akane.png',
  './img/units/vis_war.png', './img/units/vis_tank.png', './img/units/vis_mage.png',
  './img/units/vis_merc.png', './img/units/vis_pact.png',
  // 武器の切り出し絵（攻撃の瞬間だけ振られる）。data.js の WEAPON_ART と対で増やす
  './img/units/wepons/sword.png', './img/units/wepons/guard.png', './img/units/wepons/appr.png',
  './img/units/wepons/relic.png', './img/units/wepons/knight.png', './img/units/wepons/blade.png',
  './img/units/wepons/genrl.png', './img/units/wepons/amage.png', './img/units/wepons/proph.png',
  './img/units/wepons/tamer.png', './img/units/wepons/fortr.png', './img/units/wepons/hero.png',
  './img/units/wepons/allymaou.png', './img/units/wepons/spirit.png', './img/units/wepons/ghost.png',
  './img/units/wepons/e_maou.png',
  // タイトル画面の絵とメニューのボタン（ui.js の showStart / MENU_PLATE が参照）
  // title_lamp1〜3 は「灯った一角だけ」の透過レイヤー（明滅演出。style.css「タイトルの灯り」）
  './img/ui/title_menue.png',
  './img/ui/title_lamp1.png', './img/ui/title_lamp2.png', './img/ui/title_lamp3.png',
  './img/ui/bottan/botan_nomal.png', './img/ui/bottan/botan_endless.png',
  './img/ui/bottan/botan_tyutorial.png', './img/ui/bottan/botan_ranking.png',
  './img/ui/bottan/botan_other.png',
  // ゲーム内アイコン（攻撃力・体力など）。CSS の .gi-* が参照する
  './img/ui/atk.png', './img/ui/hp.png', './img/ui/gold.png', './img/ui/cap.png',
  './img/ui/forge.png', './img/ui/star.png', './img/ui/pet.png', './img/ui/threat.png',
  './img/ui/chest.png',
  // 募兵カードの枠絵（ティア別＋お助け・実力者）。render.js の CARD_FRAMES と対で増やす
  './img/units/frame/frame_T1_1.png', './img/units/frame/frame_T1_2.png',
  './img/units/frame/frame_T2_1.png', './img/units/frame/frame_T2_2.png',
  './img/units/frame/frame_T3_1.png', './img/units/frame/frame_T3_2.png', './img/units/frame/frame_T3_3.png',
  './img/units/frame/frame_T4.png',
  './img/units/frame/frame_helper.png', './img/units/frame/frame_unknown.png',
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

  // アプリのコード(js/css): ネットワーク優先。
  // stale-while-revalidate のままだと、ナビゲーションだけ network-first なので
  // 「index.html は新しいのに game.min.js / style.css は1回前の版」というバージョン混在が起きる。
  // （実際にこれで、新しいCSSが無いまま横向きにされて盤面が潰れる事故が起きた）
  // オフライン時はキャッシュへフォールバックするので、従来どおり圏外でも遊べる。
  if (url.origin === self.location.origin &&
      (url.pathname.includes('/js/') || url.pathname.includes('/css/'))) {
    // cache:'no-cache' が要（素の fetch(req) はリクエスト既定のHTTPキャッシュを使うため、
    // ネットワーク優先にしても古い応答が返ってしまう＝この対策の意味が無くなる）。
    // no-cache は「毎回サーバに確認、変更が無ければ304」なので通信量は増えない
    e.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((res) => {
          if (res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req, { ignoreVary: true }))
    );
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
