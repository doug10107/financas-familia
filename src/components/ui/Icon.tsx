'use client';

interface IconProps {
  name: string;
  filled?: boolean;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap: Record<string, string> = {
  xs: 'text-[14px] w-3.5 h-3.5 min-w-[14px]',
  sm: 'text-[16px] w-4 h-4 min-w-[16px]',
  md: 'text-[20px] w-5 h-5 min-w-[20px]',
  lg: 'text-[24px] w-6 h-6 min-w-[24px]',
  xl: 'text-[32px] w-8 h-8 min-w-[32px]'
};

export function Icon({ name, filled = false, className = '', size }: IconProps) {
  let resolvedSizeClass = '';
  if (size) {
    resolvedSizeClass = sizeMap[size] || 'text-[20px] w-5 h-5 min-w-[20px]';
  } else if (!className.includes('text-')) {
    if (className.includes('w-3') || className.includes('w-3.5') || className.includes('w-4')) {
      resolvedSizeClass = 'text-[16px]';
    } else if (className.includes('w-5')) {
      resolvedSizeClass = 'text-[20px]';
    } else if (className.includes('w-6')) {
      resolvedSizeClass = 'text-[24px]';
    } else {
      resolvedSizeClass = 'text-[20px]';
    }
  }

  return (
    <span
      className={`material-symbols-outlined inline-flex items-center justify-center shrink-0 select-none leading-none ${resolvedSizeClass} ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : { fontVariationSettings: "'FILL' 0" }}
    >
      {name}
    </span>
  );
}
