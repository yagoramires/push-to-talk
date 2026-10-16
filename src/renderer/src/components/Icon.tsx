// Stroke icons (24×24, currentColor), so buttons don't depend on the system's emoji font.
const PATHS = {
  check: 'M4.5 12.5l5 5 10-11',
  x: 'M6 6l12 12M18 6L6 18',
  speaker: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
  undo: 'M9 14L4.5 9.5 9 5M4.5 9.5H15a5 5 0 0 1 0 10h-3'
} as const

export default function Icon({ name }: { name: keyof typeof PATHS }): React.JSX.Element {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="1.1em"
      height="1.1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
