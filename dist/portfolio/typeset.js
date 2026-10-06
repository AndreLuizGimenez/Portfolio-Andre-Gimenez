// Sets paragraphs as straight-edged blocks without stretching their word spaces. Lines are
// broken so that all of them, the last included, come out nearly as wide as each other, and
// what little differs is shared among all the characters of a line: a fraction of a pixel
// each, spaces included.
const EVEN = .025;     // em per character that still reads as untouched spacing
const SQUEEZE = .02;   // the most a line may be drawn in
const LOOSE = .085;    // a line that would have to open more than this is left as it falls…
const CLOSE = .06;     // …and so is the last line, sooner
const SHORT = 9;       // what a last line left short costs: the block is meant to be whole
const DIVIDED = { soft: 2.5, curt: 4, hyphen: .3 };   // what ending a line inside a word costs, a short word more
const LADDER = 4;      // …and what a second divided line in a row adds

// Where words may be divided: by syllable, with two letters or more before the hyphen and three after it.
const SYLLABLES = new Map(`apli-ca-ção ar-qui-te-tu-ral ar-ti-fi-cial au-di-tó-rio ca-ma-rim cons-tru-ída cons-tru-ído
  cri-ando cui-dado cu-rio-si-dade de-bug-ging de-sen-vol-vi-mento di-gi-tais en-ge-nha-ria es-tu-dante
  ex-pe-ri-ên-cias game-play gra-va-ção gui-ada im-ple-men-ta-ção in-te-gral-mente in-te-li-gên-cia pá-gina
  per-so-na-gem per-so-na-li-za-ção pla-ne-ja-mento pla-teia prê-mios pro-duto pro-grama re-fi-na-mento
  res-pon-siva ro-la-gem soft-ware téc-nica vi-sual`.split(/\s+/).map(word => [word.replaceAll('-', ''), word]));

// Offsets inside a word after which a line may end, with what each one is.
function divisions(word) {
  const found = [];
  const core = word.match(/\p{L}+/u);
  const syllables = core && SYLLABLES.get(core[0].toLowerCase());
  const kind = core?.[0].length < 9 ? 'curt' : 'soft';
  if (syllables) for (let at = syllables.indexOf('-'), cut = 0; at >= 0; at = syllables.indexOf('-', at + 1), cut += 1) found.push([core.index + at - cut, kind]);
  for (const match of word.matchAll(/\p{L}-(?=\p{L})/gu)) found.push([match.index + 2, 'hyphen']);
  return found.sort((a, b) => a[0] - b[0]);
}

// The paragraph lying on a single line, as the pieces a line may end after: where each starts and ends.
function measure(element, ruler) {
  const range = document.createRange();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, node => ruler.contains(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT);
  const pieces = [];
  let spaced = true;   // white space since the previous piece of text
  let count = 0;       // characters so far, with one space between words
  for (let node; (node = walker.nextNode());) {
    let last = 0;
    for (const match of node.data.matchAll(/\S+/g)) {
      if (match.index > last) spaced = true;
      // Text that runs on across an inline boundary, as in "<strong>MCP</strong>:", cannot part there.
      let gap = spaced ? 'space' : 'join', from = 0;
      for (const [to, next] of [...divisions(match[0]), [match[0].length]]) {
        range.setStart(node, match.index + from);
        range.setEnd(node, match.index + to);
        const { left, right } = range.getBoundingClientRect();
        if (gap === 'space' && pieces.length) count += 1;
        pieces.push({ gap, left, right, from: [node, match.index + from], to: [node, match.index + to], start: count, end: count += to - from });
        gap = next;
        from = to;
      }
      spaced = false;
      last = match.index + match[0].length;
    }
    if (last < node.data.length) spaced = true;
  }
  return pieces;
}

// Line ends, for as many lines as the words take undivided, at the measure that sets them most evenly.
function compose(pieces, room, size, hyphen) {
  const count = pieces.length;
  // Flat copies: the search below reads them tens of thousands of times.
  const left = Float64Array.from(pieces, piece => piece.left), right = Float64Array.from(pieces, piece => piece.right);
  const start = Int32Array.from(pieces, piece => piece.start), end = Int32Array.from(pieces, piece => piece.end);
  // For a line that ends before piece k: whether another may start there, whether the text itself offers
  // that break, whether it leaves a hyphen of ours, and what it costs.
  const opens = new Uint8Array(count + 1), plain = new Uint8Array(count + 1), soft = new Uint8Array(count + 1), toll = new Float64Array(count + 1);
  pieces.forEach(({ gap }, index) => {
    opens[index] = !index || gap !== 'join';
    plain[index] = !index || gap === 'space' || gap === 'hyphen';
    soft[index] = gap === 'soft' || gap === 'curt';
    toll[index] = DIVIDED[gap] || 0;
  });
  plain[count] = 1;
  const width = (from, to) => right[to] - left[from] + soft[to + 1] * hyphen;
  const gaps = (from, to) => Math.max(1, end[to] - start[from] - 1 + soft[to + 1]);
  const spare = (from, to, measure) => (measure - width(from, to)) / gaps(from, to) / size;   // em per character

  // A word wider than the room gets a line anyway.
  for (let from = 0, to = 0; from < count; from = to + 1) {
    for (to = from; !plain[to + 1];) to += 1;
    room = Math.max(room, right[to] - left[from]);
  }
  // fewest[j]: the fewest lines that hold the first j pieces with no word divided: the height the page expects.
  const fewest = new Int16Array(count + 1).fill(count + 1);
  fewest[0] = 0;
  for (let j = 1; j <= count; j += 1) {
    if (!plain[j]) continue;
    for (let i = j - 1; i >= 0 && right[j - 1] - left[i] <= room + 1e-4; i -= 1) if (plain[i] && fewest[i] + 1 < fewest[j]) fewest[j] = fewest[i] + 1;
  }
  const lines = fewest[count];
  if (!count || lines < 2 || lines > count) return null;

  // best[l][j]: least cost of the first j pieces in l lines; back[l][j]: where the last of those starts.
  const best = Array.from({ length: lines }, () => new Float64Array(count + 1));
  const back = Array.from({ length: lines }, () => new Int16Array(count + 1));
  const even = 1 / (EVEN * EVEN);
  const strain = each => each * each * even * (each < 0 ? 2 : 1);   // drawing a line in costs twice what opening it does
  function set(measure) {
    best[0].fill(Infinity);
    best[0][0] = 0;
    for (let l = 1; l < lines; l += 1) {
      const before = best[l - 1], here = best[l].fill(Infinity);
      for (let j = l; j < count; j += 1) {
        if (!opens[j]) continue;
        for (let i = j - 1; i >= l - 1; i -= 1) {
          const each = spare(i, j - 1, measure);
          if (each < -SQUEEZE) break;   // a longer line would only be wider
          if (before[i] === Infinity) continue;
          const total = before[i] + strain(each) + (each > LOOSE ? 40 : 0) + toll[j] + soft[i] * soft[j] * LADDER;
          if (total < here[j]) { here[j] = total; back[l][j] = i; }
        }
      }
    }
    // The last line belongs to the block too. Left short it pays dearly, more so as a stub; it also pays for
    // opening with the rest of a divided word.
    let least = Infinity, from = -1;
    for (let i = count - 1; i >= lines - 1; i -= 1) {
      const each = spare(i, count - 1, measure);
      if (each < -SQUEEZE) break;
      const total = best[lines - 1][i] + (each <= CLOSE ? strain(each) : SHORT + (width(i, count - 1) < measure / 3 ? 2 : 0)) + soft[i] * 1.5;
      if (total < least) { least = total; from = i; }
    }
    if (from < 0) return null;
    const starts = [from];
    for (let l = lines - 1; l > 0; l -= 1) starts.unshift(back[l][starts[0]]);
    return { total: least, measure, starts };
  }

  // Lines come out evenest at a measure near their own widths, usually short of the room, so narrower ones are tried.
  let chosen = null;
  for (let measure = room, least = (right[count - 1] - left[0]) / lines * .93; measure >= least; measure -= 4) {
    const candidate = set(measure);
    if (candidate && (!chosen || candidate.total < chosen.total - 1e-9)) chosen = candidate;
  }
  if (!chosen) return null;
  const rows = chosen.starts.map((from, index) => {
    const to = (chosen.starts[index + 1] ?? count) - 1;
    return { from, to, divided: !!soft[to + 1], flush: spare(from, to, chosen.measure) <= (index < lines - 1 ? LOOSE : CLOSE) };
  });
  // The measure that asks least of the lines it holds: a little off the widest, a little onto the others.
  let pull = 0, hold = 0, floor = 0, widest = 0;
  rows.forEach(({ from, to, flush }) => {
    const wide = width(from, to), each = gaps(from, to) * size, weight = 1 / (each * each);
    widest = Math.max(widest, wide);
    if (!flush) return;
    pull += wide * weight;
    hold += weight;
    floor = Math.max(floor, wide - SQUEEZE * each);
  });
  const measure = hold ? Math.min(room, Math.max(floor, pull / hold)) : widest;
  rows.forEach(row => { row.spacing = row.flush ? (measure - width(row.from, row.to)) / gaps(row.from, row.to) : 0; });
  return { measure, rows };
}

export function initTypeset(paragraphs) {
  const items = paragraphs.map(element => ({ element, source: [...element.childNodes] }));
  const range = document.createRange();
  let drawn = '';
  let frame = 0;

  function pass() {
    frame = 0;
    const state = items.map(({ element }) => `${element.parentElement.clientWidth}/${getComputedStyle(element).fontSize}`).join();
    if (state === drawn) return;
    drawn = state;
    // The text as written, to read the room it is given…
    items.forEach(({ element, source }) => {
      element.classList.remove('is-typeset');
      element.replaceChildren(...source.map(node => node.cloneNode(true)));
    });
    const rooms = items.map(({ element }) => element.getBoundingClientRect().width);
    // …then on a single line, to read where each piece starts and ends. An entrance under way
    // may be scaling the text: a ruler of known length says by how much.
    const rulers = items.map(({ element }) => {
      const ruler = document.createElement('span');
      ruler.innerHTML = '<span>-</span><span style="display:inline-block;width:1000px"></span>';
      element.classList.add('is-typeset');
      element.append(ruler);
      return ruler;
    });
    const set = items.map(({ element }, index) => {
      const style = getComputedStyle(element);
      const [hyphen, length] = [...rulers[index].children].map(child => child.getBoundingClientRect().width);
      const scale = length / 1000 || 1;
      const pieces = measure(element, rulers[index]);
      pieces.forEach(piece => { piece.left /= scale; piece.right /= scale; });
      return { pieces, tracking: parseFloat(style.letterSpacing) || 0, block: compose(pieces, rooms[index] / scale, parseFloat(style.fontSize), hyphen / scale) };
    });
    items.forEach(({ element, source }, index) => {
      const { pieces, tracking, block } = set[index];
      // A single line has nothing to be flush with.
      if (!block) { rulers[index].remove(); element.classList.remove('is-typeset'); return; }
      const lines = block.rows.flatMap(({ from, to, divided, flush, spacing }, at) => {
        const row = document.createElement('span');
        range.setStart(...pieces[from].from);
        range.setEnd(...pieces[to].to);
        row.append(range.cloneContents());
        if (divided) {
          let tail = row;
          while (tail.lastChild) tail = tail.lastChild;
          tail.data += '-';
        }
        // Spacing also follows the last character; taken back, centred lines keep their edges in line.
        if (flush) row.style.cssText = `letter-spacing:${(tracking + spacing).toFixed(3)}px;margin-right:${(-spacing).toFixed(3)}px`;
        // A line that could not be made flush still starts where the block does, centred text or not.
        else row.style.cssText = `display:inline-block;width:${block.measure.toFixed(2)}px;text-align:start`;
        return at ? [document.createElement('br'), row] : [row];
      });
      if (!block.rows.some(row => row.divided)) { element.replaceChildren(...lines); return; }
      // A divided word would be read out in two halves: the text as written stays for whoever listens.
      const spoken = document.createElement('span'), seen = document.createElement('span');
      spoken.className = 'sr-only';
      spoken.append(...source.map(node => node.cloneNode(true)));
      seen.setAttribute('aria-hidden', 'true');
      seen.append(...lines);
      element.replaceChildren(spoken, seen);
    });
  }

  const schedule = () => { frame ||= requestAnimationFrame(pass); };
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(schedule);
    items.forEach(({ element }) => observer.observe(element.parentElement));
  }
  window.addEventListener('resize', schedule, { passive: true });
  pass();
}
