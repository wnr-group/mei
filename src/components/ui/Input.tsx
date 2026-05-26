import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, type = "text", id, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-xs font-inter font-medium uppercase tracking-wider text-[#4a4a4a]"
          >
            {label}
          </label>
        )
      }
        <input
          ref={ref}
          type={type}
          id={id}
          className={`w-full bg-[#faf8f5] border border-[#e8e0d5] px-4 py-3 text-sm font-inter text-[#1a1a1a] placeholder:text-[#9a9a9a] focus:outline-none focus:border-[#c9a465] focus:bg-white transition-all duration-300 ${
            error ? "border-red-500 focus:border-red-500" : ""
          } ${className}`}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-500 font-inter mt-1">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
