import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CheckboxProps {
  checked: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  disabled?: boolean;
}

export function Checkbox({ checked, onClick, className, disabled }: CheckboxProps) {
  return (
    <div 
      className={cn(
        "w-4 h-4 rounded-[3px] flex items-center justify-center flex-shrink-0 transition-colors border",
        disabled 
          ? "cursor-not-allowed opacity-40 bg-[#1e1e1e] border-[#333]" 
          : "cursor-pointer",
        !disabled && checked 
          ? "bg-[#2383e2] border-[#2383e2] text-white" 
          : "",
        !disabled && !checked 
          ? "bg-transparent border-[#5a5a5a] hover:bg-[#2f2f2f]" 
          : "",
        disabled && checked 
          ? "bg-[#2383e2]/40 border-[#2383e2]/20 text-white/40" 
          : "",
        className
      )}
      onClick={disabled ? undefined : onClick}
    >
      {checked && (
        <svg viewBox="0 0 14 14" fill="none" className="w-[11px] h-[11px] stroke-white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7L5.5 9.5L11.5 4" />
        </svg>
      )}
    </div>
  );
}
