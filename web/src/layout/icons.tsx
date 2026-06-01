type IconProps = { className?: string };
const base = 'none';

export function HomeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

export function BookIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5.5C10.5 4.3 8.4 3.8 6 4c-.8.1-1.4.7-1.4 1.5v12c0 .9.8 1.6 1.7 1.5 2.1-.2 4.1.3 5.7 1.4" />
      <path d="M12 5.5C13.5 4.3 15.6 3.8 18 4c.8.1 1.4.7 1.4 1.5v12c0 .9-.8 1.6-1.7 1.5-2.1-.2-4.1.3-5.7 1.4" />
      <path d="M12 5.5V20" />
    </svg>
  );
}

export function ChartIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M3 20h18" />
    </svg>
  );
}

export function HeartIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20s-7-4.4-9.3-9C1.3 8.3 2.6 5.2 5.6 5c1.9-.1 3.3 1 4.4 2.4C11.1 6 12.5 4.9 14.4 5c3 .2 4.3 3.3 2.9 6C19 15.6 12 20 12 20Z" />
    </svg>
  );
}

export function GearIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={base} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />
    </svg>
  );
}

export function FlameIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2.5c.4 2.7-1 4.3-2.4 5.7C8 9.7 6.7 11 6.7 13.4a5.3 5.3 0 0 0 10.6.3c0-1.9-.8-3.4-1.7-4.6-.3 1-.9 1.7-1.8 2 .6-2.6-.5-5.6-1.8-7.2-.3-.4-.6-1-.3-1.4Z" />
    </svg>
  );
}
