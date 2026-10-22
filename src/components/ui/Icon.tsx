'use client';

interface IconProps {
  name: string;
  filled?: boolean;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap: Record<string, { className: string; px: number }> = {
  xs: { className: 'w-3.5 h-3.5 min-w-[14px]', px: 14 },
  sm: { className: 'w-4 h-4 min-w-[16px]', px: 16 },
  md: { className: 'w-5 h-5 min-w-[20px]', px: 20 },
  lg: { className: 'w-6 h-6 min-w-[24px]', px: 24 },
  xl: { className: 'w-8 h-8 min-w-[32px]', px: 32 }
};

export function Icon({ name, filled = false, className = '', size }: IconProps) {
  let resolvedSizeClass = '';
  let resolvedPx = 20;

  if (size && sizeMap[size]) {
    resolvedSizeClass = sizeMap[size].className;
    resolvedPx = sizeMap[size].px;
  } else {
    if (className.includes('w-2') || className.includes('w-2.5')) {
      resolvedSizeClass = 'w-3 h-3 min-w-[12px]';
      resolvedPx = 12;
    } else if (className.includes('w-3.5')) {
      resolvedSizeClass = 'w-3.5 h-3.5 min-w-[14px]';
      resolvedPx = 14;
    } else if (className.includes('w-3') || className.includes('w-4')) {
      resolvedSizeClass = 'w-4 h-4 min-w-[16px]';
      resolvedPx = 16;
    } else if (className.includes('w-5')) {
      resolvedSizeClass = 'w-5 h-5 min-w-[20px]';
      resolvedPx = 20;
    } else if (className.includes('w-6')) {
      resolvedSizeClass = 'w-6 h-6 min-w-[24px]';
      resolvedPx = 24;
    } else if (className.includes('w-8')) {
      resolvedSizeClass = 'w-8 h-8 min-w-[32px]';
      resolvedPx = 32;
    } else if (className.includes('w-12')) {
      resolvedSizeClass = 'w-12 h-12 min-w-[48px]';
      resolvedPx = 48;
    } else {
      resolvedSizeClass = 'w-5 h-5 min-w-[20px]';
      resolvedPx = 20;
    }
  }

  return (
    <span
      className={`material-symbols-outlined inline-flex items-center justify-center shrink-0 select-none leading-none ${resolvedSizeClass} ${className}`}
      style={{
        fontSize: `${resolvedPx}px`,
        width: `${resolvedPx}px`,
        height: `${resolvedPx}px`,
        fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0"
      }}
    >
      {name}
    </span>
  );
}
