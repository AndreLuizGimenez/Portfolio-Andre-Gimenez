// The loading card. From the page's first paint it covers everything while the page prepares what the visit
// needs: the type, each glass backdrop drawn once, the pictures decoded. Then its bar closes, the card leaves,
// and only then do the entrances begin, with nothing left to fetch or build under them. The page's head shows
// the card only to visits that will run this script.
const LINGER = 380;     // ms the card stays at least, from its first paint: it is seen, not flashed
const PATIENCE = 3500;  // ms into the visit after which what is not essential is no longer waited for
const LIMIT = 9000;     // ms into the visit after which nothing is: the page shows as it stands
const FILL = 360;       // ms the bar takes to reach a new length (its transition in the stylesheet)
const LEAVE = 380;      // ms the card takes to leave (its transitions in the stylesheet)
const HEAD = .3;        // share of the bar it creeps to on its own, before the script counts (in the stylesheet)

const wait = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
const seen = () => document.hidden ? new Promise(resolve => {
  document.addEventListener('visibilitychange', function shown() {
    if (document.hidden) return;
    document.removeEventListener('visibilitychange', shown);
    resolve();
  });
}) : null;

// `track` what the visit needs, then `release` once: `done` settles when the card has left, at once without one.
export function createLoader({ reducedMotion } = {}) {
  const html = document.documentElement;
  const card = document.querySelector('.loader');
  const bar = card?.querySelector('.loader-fill');
  const active = Boolean(bar) && html.classList.contains('is-loading');
  const essential = [], optional = [];
  let total = 0, count = 0, shown = 0, filled = 0, released = false, over = false, finish;
  const done = new Promise(resolve => { finish = resolve; });

  // The opening is this script's from here: the guard in the head stands down. If the script fails before it
  // lets the card go, or something essential never comes, the page shows as it stands, as the head would have.
  function abandon() {
    if (over) return;
    over = true;
    card?.remove();
    html.classList.remove('is-loading', 'hero-motion-ready');
    finish();
  }
  if (active) {
    html.dataset.opening = 'loading';
    window.addEventListener('error', abandon, { once: true });
  } else finish();

  // The bar counts on from the share it crept to on its own, and never back.
  function show(share) {
    if (share <= shown) return;
    shown = share;
    bar.classList.add('is-counting');
    bar.style.setProperty('--progress', (HEAD + (1 - HEAD) * share).toFixed(3));
    filled = performance.now();
  }

  // `task` counts toward the bar once it settles, whichever way, or once `within` ms have passed.
  function track(task, { weight = 1, required = false, within = 0 } = {}) {
    if (!active || released) return;
    total += weight;
    const settled = Promise.resolve(task).catch(() => {});
    (required ? essential : optional).push((within ? Promise.race([settled, wait(within)]) : settled).then(() => {
      count += weight;
      show(count / total);
    }));
  }

  async function release() {
    if (!active || released || over) return done;
    released = true;
    window.removeEventListener('error', abandon);
    const painted = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? performance.now();
    const ready = await Promise.race([
      Promise.all([
        Promise.all(essential),
        Promise.race([Promise.all(optional), wait(PATIENCE - performance.now())]),
        wait(painted + LINGER - performance.now()),
      ]).then(() => true),
      wait(LIMIT - performance.now()).then(() => false),
    ]);
    if (!ready) { abandon(); return done; }
    // A visit opened in a tab out of sight begins when it is looked at.
    await seen();
    // The bar closes before the card goes: what is left of its way, or all of it if it was cut short.
    const still = reducedMotion?.matches;
    show(1);
    if (!still) await wait(filled + FILL - performance.now());
    card.classList.add('is-leaving');
    html.classList.remove('is-loading');
    if (!still) await wait(LEAVE);
    card.remove();
    over = true;
    finish();
    return done;
  }

  return { active, done, track, release };
}
