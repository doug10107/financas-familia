'use client';

interface IconProps {
  name: string;
  filled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl' };

export function Icon({ name, filled = false, className = '', size = 'md' }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${sizeMap[size]} ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : { fontVariationSettings: "'FILL' 0" }}
    >
      {name}
    </span>
  );
}
