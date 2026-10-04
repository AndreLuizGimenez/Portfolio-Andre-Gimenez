/* Breakpoint compartilhado do palco: decide quando usar composição compacta ou composição larga. */
/** The landscape phone uses the same two-column composition as desktop. */
export const wideStoryQuery = '(min-width: 1024px), (min-width: 640px) and (max-height: 540px)';
export const isCompactStory = () => !window.matchMedia(wideStoryQuery).matches;
