import { InputHTMLAttributes, forwardRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  prefix?: string;
  suffix?: string;
  showPasswordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, prefix, suffix, showPasswordToggle, type = 'text', className = '', id, ...props }, ref) => {
    const inputId = id || `input-${(label || 'field').replace(/\s+/g, '-').toLowerCase()}`;
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    
    const inputType = showPasswordToggle ? (isPasswordVisible ? 'text' : 'password') : type;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefix && (
            <div className="absolute left-3 text-gray-500 dark:text-gray-400 flex items-center justify-center pointer-events-none">
              <Icon name={prefix} size="sm" />
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            type={inputType}
            className={`
              w-full rounded-xl border-[1.5px] bg-white dark:bg-[#1a2332] px-4 py-2.5 text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-all duration-200
              ${error ? 'border-[#ba1a1a] dark:border-[#ffb4ab] focus:border-[#ba1a1a] dark:focus:border-[#ffb4ab]' : 'border-gray-300 dark:border-gray-700 focus:border-[#2170e4] dark:focus:border-[#adc6ff]'}
              focus:outline-none focus:ring-2 focus:ring-opacity-20
              ${error ? 'focus:ring-[#ba1a1a]' : 'focus:ring-[#2170e4]'}
              ${prefix ? 'pl-9' : ''}
              ${suffix || showPasswordToggle ? 'pr-10' : ''}
              ${className}
            `}
            {...props}
          />

          {showPasswordToggle ? (
            <button
              type="button"
              onClick={() => setIsPasswordVisible(!isPasswordVisible)}
              className="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center justify-center p-1 rounded-lg transition-colors"
              aria-label={isPasswordVisible ? 'Ocultar senha' : 'Exibir senha'}
            >
              <Icon name={isPasswordVisible ? 'visibility_off' : 'visibility'} size="sm" />
            </button>
          ) : suffix ? (
            <div className="absolute right-3 text-gray-500 dark:text-gray-400 flex items-center justify-center pointer-events-none">
              <Icon name={suffix} size="sm" />
            </div>
          ) : null}
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
