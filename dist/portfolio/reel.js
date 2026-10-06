// Third section: its clip plays only while the section is on screen.
export function initReel(section, { reducedMotion }) {
  const frame = section.querySelector('.game-frame');
  const markup = frame.querySelector('noscript');
  const toggle = section.querySelector('.video-toggle');
  let video;
  let present = false;
  let held = false;      // paused by the visitor
  let arrival = 0;

  function reflect() {
    const paused = !video || video.paused;
    frame.classList.toggle('is-paused', paused);
    toggle.setAttribute('aria-label', paused ? 'Reproduzir o vídeo' : 'Pausar o vídeo');
  }

  // The clip waits as text inside <noscript>, where it also serves visitors without
  // scripting. Nothing of it, not even its poster, is fetched until one section away.
  function warm() {
    if (video) return;
    markup.insertAdjacentHTML('afterend', markup.textContent);
    video = frame.querySelector('.game-video');
    video.controls = false;
    video.preload = 'metadata';
    video.addEventListener('play', reflect);
    video.addEventListener('pause', reflect);
  }

  function sync() {
    if (present && !held && !document.hidden && !reducedMotion.matches) video.play().catch(() => {});
    else video?.pause();
  }

  toggle.addEventListener('click', () => {
    warm();
    held = !video.paused;
    if (held) video.pause();
    else video.play().catch(() => { video.controls = true; });
  });
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', sync);
  reflect();

  // Pose held below the viewport, so the arrival has somewhere to come from.
  function stage() {
    ++arrival;
    section.classList.remove('is-arriving');
    section.classList.toggle('is-waiting', !reducedMotion.matches);
  }

  // `rising` is false when the section is uncovered from above: it is simply there.
  function show(rising) {
    present = true;
    held = false;
    warm();
    sync();
    if (!section.classList.contains('is-waiting')) return;
    const run = ++arrival;
    if (!rising) { section.classList.remove('is-waiting'); return; }
    section.classList.replace('is-waiting', 'is-arriving');
    const animations = section.getAnimations({ subtree: true }).filter(animation => 'animationName' in animation);
    Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      if (run === arrival) section.classList.remove('is-arriving');
    });
  }

  function hide() {
    present = false;
    sync();
  }

  return { warm, stage, show, hide };
}
