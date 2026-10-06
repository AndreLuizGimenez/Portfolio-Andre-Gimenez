// Third section: the copy on its pane of glass and the gameplay clip. The clip plays only while the section is
// on screen, and only once its frame has settled: during the entrance the frame holds still on the clip's
// first frame, so nothing decodes while things move and nothing jumps when it starts.
export function initReel(section, { reducedMotion, onPose } = {}) {
  const frame = section.querySelector('.game-frame');
  const flight = section.querySelector('.game-flight');
  const markup = frame.querySelector('noscript');
  const toggle = section.querySelector('.video-toggle');
  let video;
  let present = false;   // the section is on screen
  let settled = true;    // no entrance under way
  let held = false;      // paused by the visitor
  let arrival = 0;

  function reflect() {
    const paused = !video || video.paused;
    frame.classList.toggle('is-paused', paused);
    toggle.setAttribute('aria-label', paused ? 'Reproduzir o vídeo' : 'Pausar o vídeo');
  }

  // The clip waits as text inside <noscript>, where it also serves visitors without scripting. The picture
  // under it is its poster, so the element takes none of its own, not even for a moment. `preload` is how far
  // its file may load: 'none' makes the element alone.
  function warm(preload = 'metadata') {
    if (!video) {
      markup.insertAdjacentHTML('afterend', markup.textContent.replace(/\sposter="[^"]*"/, ''));
      video = frame.querySelector('.game-video');
      video.controls = false;
      video.addEventListener('play', reflect);
      video.addEventListener('pause', reflect);
    }
    if (preload === 'auto' || video.preload === 'none') video.preload = preload;
    return video;
  }

  function sync() {
    if (present && settled && !held && !document.hidden && !reducedMotion.matches) warm().play().catch(() => {});
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

  // The frame starts over the place its copy will take, on the left. Measured on its stage, where it sits
  // centred: the frame itself is already moved by the pose this sets.
  function aim() {
    const bounds = section.getBoundingClientRect();
    const box = flight.parentElement.getBoundingClientRect();
    const center = box.left + box.width / 2 - bounds.left;
    section.style.setProperty('--enter-x', `${Math.round(Math.min(bounds.width * -.3, bounds.width * .22 - center))}px`);
  }

  // Pose held below the viewport, so the arrival has somewhere to come from.
  function stage() {
    ++arrival;
    settled = true;
    section.classList.remove('is-arriving');
    section.classList.toggle('is-waiting', !reducedMotion.matches);
    onPose?.(reducedMotion.matches ? 'present' : 'staged');
    if (!reducedMotion.matches) aim();
  }

  // `rising` is false when the section is uncovered from above: it is simply there.
  function show(rising) {
    present = true;
    held = false;
    if (!section.classList.contains('is-waiting')) { sync(); return; }
    const run = ++arrival;
    if (!rising) {
      section.classList.remove('is-waiting');
      onPose?.('present');
      sync();
      return;
    }
    settled = false;
    section.classList.replace('is-waiting', 'is-arriving');
    onPose?.('entering');
    // The clip starts once the frame stands still; the rest of the copy may still be settling.
    const turn = frame.getAnimations().find(animation => animation.animationName === 'reel-turn');
    const animations = section.getAnimations({ subtree: true }).filter(animation => 'animationName' in animation);
    (turn?.finished ?? Promise.resolve()).catch(() => {}).then(() => {
      if (run !== arrival) return;
      settled = true;
      sync();
    });
    Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      if (run === arrival) section.classList.remove('is-arriving');
    });
  }

  function hide() {
    present = false;
    sync();
  }

  function resize() {
    if (section.classList.contains('is-waiting')) aim();
  }
  window.addEventListener('resize', resize, { passive: true });

  return { warm, stage, show, hide };
}
