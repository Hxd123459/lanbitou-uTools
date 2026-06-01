const strokeIcon = (paths) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`

export const slashMenuIcons = {
  paragraph: strokeIcon('<path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h14"/>'),
  h1: strokeIcon(
    '<path d="M6 4v16"/><path d="M18 4v16"/><path d="M6 12h12"/><path d="M10 8h8"/><path d="M10 16h8"/>',
  ),
  h2: strokeIcon(
    '<path d="M6 4v16"/><path d="M18 4v16"/><path d="M6 12h12"/><path d="M11 8h6"/><path d="M11 16h6"/>',
  ),
  h3: strokeIcon(
    '<path d="M6 4v16"/><path d="M18 4v16"/><path d="M6 12h12"/><path d="M12 8h4"/><path d="M12 16h4"/>',
  ),
  ol: strokeIcon(
    '<path d="M8 6h12"/><path d="M8 12h12"/><path d="M8 18h12"/><path d="M4 6h.01"/><path d="M4 12h.01"/><path d="M4 18h.01"/>',
  ),
  ul: strokeIcon(
    '<circle cx="5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="5" cy="18" r="1.2" fill="currentColor" stroke="none"/><path d="M9 6h10"/><path d="M9 12h10"/><path d="M9 18h10"/>',
  ),
  task: strokeIcon(
    '<rect x="4" y="5" width="14" height="14" rx="2"/><path d="M8 12l2.5 2.5L16 9"/>',
  ),
  quote: strokeIcon(
    '<path d="M7 9h4v4H7z"/><path d="M15 9h4v4h-4z"/><path d="M5 13c0 2 1.5 3.5 3.5 3.5V19C5.5 19 3 16.5 3 13h2zm10 0c0 2 1.5 3.5 3.5 3.5V19C15.5 19 13 16.5 13 13h2z"/>',
  ),
  code: strokeIcon('<path d="M8 8L4 12l4 4"/><path d="M16 8l4 4-4 4"/>'),
}
