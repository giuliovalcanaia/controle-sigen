export function CowMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      role="img"
      aria-label="SIGEN Campo"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="512" height="512" rx="116" fill="#14532d" />
      <circle cx="256" cy="256" r="196" fill="#166534" />
      <path d="M128 214c-34-10-50-42-36-70 14-27 52-30 76-8l24 22-20 48-44 8Z" fill="#f8f5ec" />
      <path d="M384 214c34-10 50-42 36-70-14-27-52-30-76-8l-24 22 20 48 44 8Z" fill="#f8f5ec" />
      <path d="M196 150c-14-26-4-48 18-52 10-2 20 4 28 16l14 24-24 30-36-18Z" fill="#e7dcc4" />
      <path d="M316 150c14-26 4-48-18-52-10-2-20 4-28 16l-14 24 24 30 36-18Z" fill="#e7dcc4" />
      <path
        d="M256 132c-72 0-124 54-124 126 0 76 56 134 124 134s124-58 124-134c0-72-52-126-124-126Z"
        fill="#f8f5ec"
      />
      <ellipse cx="256" cy="316" rx="94" ry="62" fill="#f7dcc6" />
      <ellipse cx="222" cy="312" rx="12" ry="16" fill="#b45309" />
      <ellipse cx="290" cy="312" rx="12" ry="16" fill="#b45309" />
      <circle cx="204" cy="248" r="14" fill="#14532d" />
      <circle cx="308" cy="248" r="14" fill="#14532d" />
      <circle cx="209" cy="243" r="5" fill="#f8f5ec" />
      <circle cx="313" cy="243" r="5" fill="#f8f5ec" />
      <path
        d="M226 356c10 10 50 10 60 0"
        stroke="#b45309"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M256 176c-18 0-32 12-32 26 0 10 8 18 18 22l14 6 14-6c10-4 18-12 18-22 0-14-14-26-32-26Z"
        fill="#dcfce7"
      />
    </svg>
  );
}
