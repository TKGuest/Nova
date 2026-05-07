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
}

export function Checkbox({ checked, onClick, className }: CheckboxProps) {
  return (
    <div 
      className={cn(
        "w-4 h-4 rounded-[3px] flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors border",
        checked 
          ? "bg-[#2383e2] border-[#2383e2] text-white" 
          : "bg-transparent border-[#5a5a5a] hover:bg-[#2f2f2f]",
        className
      )}
      onClick={onClick}
    >
      {checked && (
        <svg viewBox="0 0 14 14" fill="none" className="w-[11px] h-[11px] stroke-white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7L5.5 9.5L11.5 4" />
        </svg>
      )}
    </div>
  );
}
