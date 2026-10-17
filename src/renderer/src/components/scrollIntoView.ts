/** Stable ref callback for a panel that appears below the fold on a phone; scrolls to it on mount. */
export const scrollIntoView = (el: HTMLElement | null): void =>
  el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
