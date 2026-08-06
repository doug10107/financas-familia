import { InputHTMLAttributes, forwardRef } from 'react';
import { Icon } from '@/components/ui/Icon';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  prefix?: string;
  suffix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, prefix, suffix, className = '', id, ...props }, ref) => {
    const inputId = id || `input-${(label || 'field').replace(/\s+/g, '-').toLowerCase()}`;
    
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefix && (
            <div className="absolute left-3 text-gray-500 dark:text-gray-400 flex items-center justify-center">
              <Icon name={prefix} size="sm" />
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`
              w-full rounded-xl border-[1.5px] bg-white dark:bg-[#1a2332] px-4 py-2.5 text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-all duration-200
              ${error ? 'border-[#ba1a1a] dark:border-[#ffb4ab] focus:border-[#ba1a1a] dark:focus:border-[#ffb4ab]' : 'border-gray-300 dark:border-gray-700 focus:border-[#2170e4] dark:focus:border-[#adc6ff]'}
              focus:outline-none focus:ring-2 focus:ring-opacity-20
              ${error ? 'focus:ring-[#ba1a1a]' : 'focus:ring-[#2170e4]'}
              ${prefix ? 'pl-9' : ''}
              ${suffix ? 'pr-9' : ''}
              ${className}
            `}
            {...props}
          />
          {suffix && (
            <div className="absolute right-3 text-gray-500 dark:text-gray-400 flex items-center justify-center">
              <Icon name={suffix} size="sm" />
            </div>
          )}
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
Input.displayName = 'Input';
