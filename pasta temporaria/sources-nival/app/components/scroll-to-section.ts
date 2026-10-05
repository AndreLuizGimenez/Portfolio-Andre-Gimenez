/* Encaminha links internos ao controlador mobile ou à rolagem do documento/painel de especificações.
 * O evento cancelável permite ao controlador assumir a navegação sem dois sistemas disputarem o scroll. */
export const sectionNavigationEvent = 'nival:section-navigation';
export type SectionNavigationDetail = { target: HTMLElement; behavior: ScrollBehavior };

/** Keep document navigation and the specifications area's native scroll independent. */
export function scrollToSection(target: HTMLElement, behavior: ScrollBehavior) {
  if (document.documentElement.classList.contains('scroll-native-mobile')) {
    const navigation = new CustomEvent<SectionNavigationDetail>(sectionNavigationEvent, { detail: { target, behavior }, cancelable: true });
    window.dispatchEvent(navigation);
    if (navigation.defaultPrevented) return;
  }
  const nativeArea = target.closest<HTMLElement>('.specifications-scroll');
  if (nativeArea && document.documentElement.classList.contains('scroll-managed')) {
    const top = nativeArea.getBoundingClientRect().top + window.scrollY;
    const inside = target.getBoundingClientRect().top - nativeArea.getBoundingClientRect().top + nativeArea.scrollTop;
    nativeArea.scrollTo({ top: inside, behavior: Math.abs(window.scrollY - top) < 3 ? behavior : 'instant' });
    window.scrollTo({ top, behavior });
  } else window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY, behavior });
}
