/* BTA Labs wordmark, traced from assets/BTA_Labs.jpg */
export default function BtaMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 215"
      fill="none"
      stroke="currentColor"
      strokeWidth="14"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* top bar flowing into the A's right leg */}
      <path d="M22 32H288L380 196" />
      {/* A left leg up to the apex */}
      <path d="M214 196L288 32" />
      {/* T stem curving into the A */}
      <path d="M172 32V162Q172 196 206 196H214" />
      {/* B — two stacked loops */}
      <path d="M22 76H112A28 28 0 1 1 112 132H22Z" />
      <path d="M22 142H112A28 28 0 1 1 112 198H22Z" />
    </svg>
  )
}
