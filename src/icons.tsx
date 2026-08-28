interface IconProps {
  size?: number;
  className?: string;
}

function base(size: number | undefined, className?: string) {
  return {
    width: size ?? 18,
    height: size ?? 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };
}

export const IconLogo = ({ size, className }: IconProps) => (
  <svg {...base(size ?? 22, className)}>
    <path d="M19 3l-8.5 8.5" />
    <path d="M14.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0z" />
    <path d="M12 20h9" />
    <path d="M15 20l1.5-3M18 20l1.5-3" />
  </svg>
);

export const IconChip = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="7" y="7" width="10" height="10" rx="1.5" />
    <path d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3" />
  </svg>
);

export const IconGlobe = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z" />
  </svg>
);

export const IconGamepad = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M6 9h4M8 7v4M15 8h.01M17.5 10h.01" />
    <path d="M17.3 5H6.7a4.7 4.7 0 0 0-4.6 5.6l.8 4.5A2.8 2.8 0 0 0 7.9 17l1.6-1.6h5l1.6 1.6a2.8 2.8 0 0 0 5-1.9l.8-4.5A4.7 4.7 0 0 0 17.3 5z" />
  </svg>
);

export const IconChat = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" />
    <path d="M9 11h.01M13 11h.01M17 11h.01" />
  </svg>
);

export const IconCode = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M8 6l-5 6 5 6M16 6l5 6-5 6" />
  </svg>
);

export const IconZap = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
  </svg>
);

export const IconShield = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6l8-3z" />
  </svg>
);

export const IconLock = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export const IconChevron = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IconGear = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
  </svg>
);

export const IconRefresh = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M21 12a9 9 0 1 1-2.6-6.4" />
    <path d="M21 3v6h-6" />
  </svg>
);

export const IconFolder = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </svg>
);

export const IconCheck = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export const IconAlert = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 3l10 18H2L12 3z" />
    <path d="M12 10v4M12 17.5h.01" />
  </svg>
);

export const IconVideo = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="M16 10l5-3v10l-5-3" />
  </svg>
);
