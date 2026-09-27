// Everything the site does in the browser. It runs once; Astro's ClientRouter
// then swaps pages inside this one document, so:
// - listeners on window/document are attached here, once;
// - per-page setup runs on `astro:page-load` (and right away for the first page);
// - per-page resources (the feed's IntersectionObserver) are released on `astro:before-swap`.
// View transitions: the browser snapshots the old page when the swap starts, so
// shared names on the old page are set inside the navigation loader, and names
// on the new page in `astro:after-swap`, before its snapshot is taken.
import type { TransitionBeforePreparationEvent, TransitionBeforeSwapEvent } from 'astro:transitions/client';
import { BP, isHomePath as isHome } from '../lib/layout';

const root = document.documentElement;
const motion = matchMedia('(prefers-reduced-motion: no-preference)').matches;
const morphs = motion && 'startViewTransition' in document;
const $ = <E extends Element = HTMLElement>(sel: string, scope: ParentNode = document) => scope.querySelector<E>(sel);
const inView = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= innerHeight;
};
const slug = (path: string, kind: 'work' | 'style') => path.match(new RegExp(`/${kind}/([^/]+)/$`))?.[1];
const esc = (s: string) => CSS.escape(s);

// ---------- Temporary view-transition names, cleared when a transition ends ----------
const named = new Set<HTMLElement>();
let tileStyle: HTMLStyleElement | null = null;
const nameEl = (el: HTMLElement | null, name: string) => {
  if (!el) return;
  el.style.viewTransitionName = name;
  named.add(el);
};
const clearNames = () => {
  named.forEach((el) => (el.style.viewTransitionName = ''));
  named.clear();
  delete root.dataset.from;
  delete root.dataset.vt;
  tileStyle?.remove();
  tileStyle = null;
};

// ---------- Theme toggle (the header persists, so one delegated listener) ----------
const syncToggle = () => {
  const b = $('[data-theme-toggle]');
  const dark = root.dataset.theme !== 'light';
  b?.setAttribute('aria-label', (dark ? b.dataset.labelLight : b.dataset.labelDark) ?? '');
};
syncToggle();
document.addEventListener('click', (e) => {
  if (!(e.target as Element).closest?.('[data-theme-toggle]')) return;
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  const apply = () => {
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {}
    syncToggle();
  };
  if (!morphs) return apply();
  root.dataset.vt = 'theme';
  document.startViewTransition(apply).finished.finally(() => delete root.dataset.vt);
});

// ---------- Mobile booking bar: away on scroll down, back on scroll up ----------
let lastY = scrollY;
if (motion) {
  let queued = false;
  addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const bar = $('.book-bar');
        const y = scrollY;
        const edge = y < 40 || innerHeight + y >= root.scrollHeight - 40;
        if (edge || y < lastY - 6) bar?.classList.remove('is-away');
        else if (y > lastY + 6) bar?.classList.add('is-away');
        if (edge || Math.abs(y - lastY) > 6) lastY = y;
      });
    },
    { passive: true },
  );
  // Lets iOS Safari apply :active styles to tiles and buttons.
  addEventListener('touchstart', () => {}, { passive: true });
}

// ---------- Home tiles: fly-out directions for the tile → feed transition ----------
function nameTile(tile: HTMLElement) {
  nameEl($('img', tile), `style-cover-${tile.dataset.style}`);
  nameEl($('.label', tile), 'style-label');
}
/** Each other tile moves 32–48px straight away from `tile`: nearer tiles less, farther ones more. */
function tileDirections(tile: HTMLElement) {
  const mid = (el: Element) => {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  const [ox, oy] = mid(tile);
  const others = [...document.querySelectorAll<HTMLElement>('.tile')]
    .filter((t) => t !== tile)
    .map((t) => {
      const [x, y] = mid(t);
      return { name: t.dataset.style, dx: x - ox, dy: y - oy, d: Math.hypot(x - ox, y - oy) || 1 };
    });
  const lo = Math.min(...others.map((o) => o.d));
  const hi = Math.max(...others.map((o) => o.d));
  return others
    .map(({ name, dx, dy, d }) => {
      const k = (32 + (hi > lo ? (16 * (d - lo)) / (hi - lo) : 16)) / d;
      return `::view-transition-old(tile-${name}),::view-transition-new(tile-${name}){--dx:${(dx * k).toFixed(1)}px;--dy:${(dy * k).toFixed(1)}px}`;
    })
    .join('');
}

// ---------- Slow page changes: a thin bar after 300ms (none with reduced motion) ----------
let progressTimer = 0;
const startProgress = () => {
  if (!motion || progressTimer) return; // a second tap keeps the bar already running
  progressTimer = window.setTimeout(() => {
    const bar = document.body.appendChild(document.createElement('div'));
    bar.className = 'nav-progress';
    bar.setAttribute('aria-hidden', 'true');
  }, 300);
};
const stopProgress = () => {
  clearTimeout(progressTimer);
  progressTimer = 0;
  $('.nav-progress')?.remove();
};
// Back from another site via the back-forward cache.
addEventListener('pageshow', (e) => e.persisted && stopProgress());

// ---------- Navigation ----------
let nav: { from: string; to: string; type: string } | null = null;
let directions = '';
// Where the visitor was on a feed / the home page before opening a piece / a style.
const feedSpot = new Map<string, { piece: string; top: number; shown: number }>();
const homeSpot = new Map<string, { style: string; top: number }>();

/** On the old page, just before it is snapshotted. */
function leave(from: string, to: string) {
  clearNames();
  const piece = slug(to, 'work');
  const style = slug(to, 'style');
  if (piece) {
    // Feed (or the artist page) → piece: the tapped photo morphs into the piece photo.
    const link = $(`a[data-vt-photo="${esc(piece)}"]`);
    const li = link?.closest('li');
    const feed = link?.closest('[data-feed]');
    if (feed && li) {
      const shown = feed.querySelectorAll(':scope > li:not(.is-hidden)').length;
      feedSpot.set(from, { piece, top: li.getBoundingClientRect().top, shown });
      history.replaceState({ ...history.state, shown }, ''); // for browser back
    }
    const img = link ? $('img', link) : null;
    if (morphs && img && inView(img)) nameEl(img, 'piece-photo');
  }
  if (style && isHome(from)) {
    // Home → feed: the tile's photo grows into the feed's cover cell.
    const tile = $(`.tile[data-style="${esc(style)}"]`);
    if (tile) {
      homeSpot.set(from, { style, top: tile.getBoundingClientRect().top });
      if (morphs) {
        nameTile(tile);
        directions = tileDirections(tile);
      }
    }
  }
  // Never fly a photo in from off screen.
  const cover = $<HTMLImageElement>('.is-cover img');
  if (cover && !inView(cover)) nameEl(cover, 'none');
}

/** Warm up the photos a morph lands on, so they aren't blank when the new page is snapshotted. */
function preload(doc: Document, back?: string) {
  const pictures = [...doc.querySelectorAll(`.main-photo picture, .is-cover picture${back ? `, #p-${CSS.escape(back)} picture` : ''}`)];
  const loads = pictures.map((p) => $<HTMLImageElement>('img', document.importNode(p, true) as Element)!.decode().catch(() => {}));
  return Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 250))]);
}

document.addEventListener('astro:before-preparation', (e) => {
  const ev = e as TransitionBeforePreparationEvent;
  const from = ev.from.pathname;
  const to = ev.to.pathname;
  nav = { from, to, type: ev.navigationType };
  startProgress();
  const load = ev.loader;
  ev.loader = async () => {
    await load();
    // Aborted: a newer navigation owns the bar. Prevented: a full page load follows.
    if (ev.defaultPrevented || ev.signal.aborted) return;
    leave(from, to);
    // Back to a feed from a piece: the cell the photo lands in must have its
    // photo, even if it is one that waits to load (Photo.astro).
    const back = slug(from, 'work');
    if (back && slug(to, 'style')) loadPhoto(ev.newDocument.getElementById(`p-${back}`)?.querySelector('.photo[data-wait]') ?? null, false);
    if (morphs) await preload(ev.newDocument, back);
    stopProgress(); // before the old page is snapshotted
  };
});

document.addEventListener('astro:before-swap', (e) => {
  const ev = e as TransitionBeforeSwapEvent;
  const doc = ev.newDocument;
  const html = doc.documentElement;
  const { from, to, type } = nav ?? { from: ev.from.pathname, to: ev.to.pathname, type: ev.navigationType };
  // The router replaces <html>'s attributes: carry the theme and the JS flag over.
  html.dataset.theme = root.dataset.theme;
  html.classList.add('js');
  if (morphs && isHome(from) && slug(to, 'style')) html.dataset.from = 'home';
  if (morphs && slug(from, 'work') && slug(to, 'work')) html.dataset.vt = 'step';
  syncPersisted(doc);
  // Back into a feed: open as many batches as were open, so the page is as tall as before.
  const items = [...doc.querySelectorAll('[data-feed] > li')];
  if (items.length) {
    const back = slug(from, 'work');
    const target = back ? doc.getElementById(`p-${back}`) : null;
    const spot = feedSpot.get(to);
    let open = type === 'traverse' ? history.state?.shown ?? 0 : 0;
    if (target) open = Math.max(open, Math.ceil((items.indexOf(target) + 1) / 12) * 12, spot?.piece === back ? spot.shown : 0);
    items.slice(0, open).forEach((li) => li.classList.remove('is-hidden'));
    if (open && !doc.querySelector('[data-feed] > .is-hidden')) $('.more', doc)?.remove();
  }
  teardown();
  ev.viewTransition?.finished.finally(clearNames);
});

document.addEventListener('astro:after-swap', () => {
  stopProgress();
  if (!nav) return;
  const { from, to, type } = nav;
  nav = null;
  syncToggle();
  const back = slug(from, 'work');
  const target = back && slug(to, 'style') ? document.getElementById(`p-${back}`) : null;
  const fromStyle = slug(from, 'style');
  const tile = fromStyle && isHome(to) ? $(`.tile[data-style="${esc(fromStyle)}"]`) : null;
  // A link back (not the browser's back button, which restores scroll itself)
  // lands where the visitor left, instead of at the top.
  if (type !== 'traverse') {
    const spot = feedSpot.get(to);
    const home = homeSpot.get(to);
    if (target) scrollBy(0, target.getBoundingClientRect().top - (spot?.piece === back ? spot.top : (innerHeight - target.offsetHeight) / 2));
    if (tile && home?.style === fromStyle) scrollBy(0, tile.getBoundingClientRect().top - home.top);
  }
  if (morphs) {
    const img = target ? $('img', target) : null;
    if (img && inView(img)) nameEl(img, 'piece-photo');
    if (tile && inView(tile)) {
      nameTile(tile);
      directions = tileDirections(tile);
    }
    const cover = $<HTMLImageElement>('.is-cover img');
    if (cover && !inView(cover)) nameEl(cover, 'none');
    if (directions) {
      tileStyle = document.head.appendChild(document.createElement('style'));
      tileStyle.textContent = directions;
    }
  }
  directions = '';
  $('.book-bar')?.classList.remove('is-away');
  lastY = scrollY;
});

// ---------- Persisted header and booking bar ----------
/** Bring over what differs on the new page (current nav item, language link, booking link). */
function syncPersisted(doc: Document) {
  for (const id of ['site-header', 'book-bar']) {
    const sel = `[data-astro-transition-persist="${id}"]`;
    const now = $(sel);
    const next = $(sel, doc);
    if (!now || !next) continue;
    // Another language: take the new one as it is.
    if (doc.documentElement.lang !== root.lang) next.removeAttribute('data-astro-transition-persist');
    else morph(now, next);
  }
}
function morph(a: Element, b: Element) {
  for (const { name } of [...a.attributes]) if (!b.hasAttribute(name)) a.removeAttribute(name);
  for (const { name, value } of [...b.attributes]) if (a.getAttribute(name) !== value) a.setAttribute(name, value);
  const ak = [...a.childNodes], bk = [...b.childNodes];
  if (ak.length !== bk.length || ak.some((n, i) => n.nodeName !== bk[i].nodeName)) {
    a.innerHTML = b.innerHTML;
    return;
  }
  ak.forEach((n, i) => {
    if (n.nodeType === Node.ELEMENT_NODE) morph(n as Element, bk[i] as Element);
    else if (n.nodeValue !== bk[i].nodeValue) n.nodeValue = bk[i].nodeValue;
  });
}

// ---------- Per page ----------
let observer: IntersectionObserver | null = null;
let photoObserver: IntersectionObserver | null = null;
const teardown = () => {
  observer?.disconnect();
  observer = null;
  photoObserver?.disconnect();
  photoObserver = null;
};

/** Give a photo that waits (Photo.astro, "wait") its real sources; it fades in as it arrives. */
function loadPhoto(pic: Element | null, fade = motion) {
  if (!pic?.hasAttribute('data-wait')) return;
  pic.removeAttribute('data-wait');
  const img = pic.querySelector('img')!;
  if (fade) {
    img.classList.add('is-pending');
    const show = () => requestAnimationFrame(() => img.classList.remove('is-pending'));
    img.addEventListener('load', () => img.decode().then(show, show), { once: true });
    img.addEventListener('error', show, { once: true });
  }
  pic.querySelectorAll('source').forEach((src) => {
    if (src.dataset.srcset) src.srcset = src.dataset.srcset;
    delete src.dataset.srcset;
  });
  if (img.dataset.srcset) img.srcset = img.dataset.srcset;
  if (img.dataset.src) img.src = img.dataset.src;
  delete img.dataset.srcset;
  delete img.dataset.src;
}

/** Fade each photo in as it arrives; photos already loaded are left alone. */
function fadeInPhotos() {
  if (!motion) return;
  // The feed's cover is where the tile transition lands: never hide it.
  // First-screen photos (eager) show as soon as they arrive: a fade there only
  // delays the largest paint.
  const waiting = [...document.querySelectorAll<HTMLImageElement>('.photo img')].filter(
    (img) => !img.complete && !img.closest('.is-cover') && img.loading !== 'eager',
  );
  // Decide a frame later: after a page swap, photos already in the cache can
  // still report `complete = false` for a moment, and must not fade again.
  requestAnimationFrame(() =>
    waiting.forEach((img) => {
      if (img.complete) return;
      img.classList.add('is-pending');
      const show = () => requestAnimationFrame(() => img.classList.remove('is-pending'));
      img.addEventListener('load', () => img.decode().then(show, show), { once: true });
      img.addEventListener('error', show, { once: true });
    }),
  );
}

// ---------- Feed order ----------
// The markup lists the pieces in phone reading order. On desktop they are put
// in the desktop mosaic's order, row by row, so Tab and screen readers follow
// what is on screen in every browser. (CSS `reading-flow` should do this, but
// Chrome 153 ignores it on this page while lazy photos are in the grid.)
// Every cell has explicit grid lines, so moving the elements changes nothing visually.
const desktop = matchMedia(`(min-width: ${BP.desktop}px)`);
function orderFeed() {
  const list = $('[data-feed]');
  if (!list) return;
  const [row, col] = desktop.matches ? ['--r', '--c'] : ['--mr', '--mc'];
  const at = (li: HTMLElement, v: string) => Number(li.style.getPropertyValue(v));
  const items = [...list.children] as HTMLElement[];
  const sorted = [...items].sort((a, z) => at(a, row) - at(z, row) || at(a, col) - at(z, col));
  if (sorted.every((li, i) => li === items[i])) return;
  const focused = document.activeElement;
  list.append(...sorted);
  if (focused instanceof HTMLElement && list.contains(focused)) focused.focus({ preventScroll: true });
}
desktop.addEventListener('change', orderFeed);

/** Feed: pieces fade up as they scroll in; "Show more" reveals the next 12. */
function feed() {
  const PAGE = 12;
  orderFeed();
  const items = [...document.querySelectorAll<HTMLElement>('[data-feed] > li')];
  if (!items.length) return;
  // Photos below the first screen load a quarter of a screen before they scroll in
  // (the browser's own lazy loading would fetch them all at once).
  const waiting = items.filter((li) => li.querySelector('.photo[data-wait]'));
  if (!('IntersectionObserver' in window)) waiting.forEach((li) => loadPhoto(li.querySelector('.photo[data-wait]')));
  else if (waiting.length) {
    const io = (photoObserver = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          loadPhoto(en.target.querySelector('.photo[data-wait]'));
        }),
      { rootMargin: '25% 0px' },
    ));
    waiting.forEach((li) => io.observe(li));
  }
  if (motion && 'IntersectionObserver' in window) {
    const io = (observer = new IntersectionObserver((entries) => {
      entries
        .filter((en) => en.isIntersecting)
        .sort((a, z) => a.boundingClientRect.top - z.boundingClientRect.top || a.boundingClientRect.left - z.boundingClientRect.left)
        .forEach((en, i) => {
          const el = en.target as HTMLElement;
          io.unobserve(el);
          el.style.transitionDelay = `${Math.min(i, 5) * 40}ms`; // 40ms stagger, at most 6 steps
          el.classList.remove('is-below');
          el.addEventListener('transitionend', () => (el.style.transitionDelay = ''), { once: true });
        });
    }));
  }
  const enter = (el: HTMLElement) => {
    if (!observer) return;
    el.classList.add('is-below');
    observer.observe(el);
  };
  // Anything on screen now is left alone.
  items.forEach((el) => !el.classList.contains('is-hidden') && el.getBoundingClientRect().top >= innerHeight && enter(el));

  const button = $<HTMLButtonElement>('[data-more]');
  button?.addEventListener('click', () => {
    // In the current order (phone or desktop), so batch[0] is the first new piece on screen.
    const batch = [...document.querySelectorAll<HTMLElement>('[data-feed] > li.is-hidden')].slice(0, PAGE);
    batch.forEach((el) => {
      enter(el);
      el.classList.remove('is-hidden');
    });
    if (items.some((el) => el.classList.contains('is-hidden'))) return;
    // Last batch: fade the button out, then drop it and move focus to the new pieces.
    const done = () => {
      button.parentElement?.remove();
      $('a', batch[0])?.focus({ preventScroll: true });
    };
    if (!motion) return done();
    button.classList.add('is-leaving');
    setTimeout(done, 130);
  });
}

const ready = new WeakSet<HTMLElement>();
function initPage() {
  if (ready.has(document.body)) return; // `astro:page-load` also fires once the first page has loaded
  ready.add(document.body);
  fadeInPhotos();
  feed();
}
initPage();
document.addEventListener('astro:page-load', initPage);
