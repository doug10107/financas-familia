'use client';
import { SelectHTMLAttributes, forwardRef } from 'react';
import { Icon } from './Icon';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: { label: string; value: string | number }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, className = '', id, ...props }, ref) => {
    const selectId = id || (label ? `select-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
    
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={`
              w-full appearance-none rounded-xl border-[1.5px] bg-white dark:bg-[#1a2332] px-4 py-2.5 pr-10 text-base text-gray-900 dark:text-gray-100 transition-all duration-200
              ${error ? 'border-[#ba1a1a] dark:border-[#ffb4ab] focus:border-[#ba1a1a] dark:focus:border-[#ffb4ab]' : 'border-gray-300 dark:border-gray-700 focus:border-[#2170e4] dark:focus:border-[#adc6ff]'}
              focus:outline-none focus:ring-2 focus:ring-opacity-20
              ${error ? 'focus:ring-[#ba1a1a]' : 'focus:ring-[#2170e4]'}
              ${className}
            `}
            {...props}
          >
            <option value="" disabled>Selecione uma opção</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
            <Icon name="expand_more" size="sm" />
          </div>
        </div>
        {(error || helperText) && (
          <p className={`text-xs mt-0.5 ${error ? 'text-[#ba1a1a] dark:text-[#ffb4ab]' : 'text-gray-500 dark:text-gray-400'}`}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';
