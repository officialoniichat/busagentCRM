import type { ActivityType } from '../types';

interface IconProps {
  className?: string;
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
};

export function ActivityIcon({
  type,
  className = 'w-3.5 h-3.5'
}: IconProps & { type: ActivityType | 'meeting' }) {
  switch (type) {
    case 'kontakt_angelegt':
      return (
        <svg className={className} {...base}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    case 'stufenwechsel':
      return (
        <svg className={className} {...base}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    case 'anruf':
      return (
        <svg className={className} {...base}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      );
    case 'email':
      return (
        <svg className={className} {...base}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m2 6 10 7 10-7" />
        </svg>
      );
    case 'notiz':
      return (
        <svg className={className} {...base}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      );
    case 'termin':
      return (
        <svg className={className} {...base}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case 'meeting':
      return (
        <svg className={className} {...base}>
          <rect x="2" y="6" width="14" height="12" rx="2" />
          <path d="m22 8-6 4 6 4V8Z" />
        </svg>
      );
  }
}

export function PlusIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} {...base} strokeWidth={2.5}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function XIcon({ className = 'w-3.5 h-3.5' }: IconProps) {
  return (
    <svg className={className} {...base} strokeWidth={2.5}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function CheckIcon({ className = 'w-3 h-3' }: IconProps) {
  return (
    <svg className={className} {...base} strokeWidth={3}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function PulseDot({ className = 'w-2 h-2' }: IconProps) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-75 animate-ping" />
      <span className="relative inline-flex w-full h-full rounded-full bg-emerald-500" />
    </span>
  );
}
