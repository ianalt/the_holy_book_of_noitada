import type { ReactNode } from "react";
import { Spinner } from "./spinner.atom";

export interface IButtonProps {
  children?: ReactNode;
  variant?: "primary" | "secondary";
  type?: "button" | "submit" | "reset";
  isLoading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

/** General-purpose button atom. Shows a Spinner and is disabled while loading. */
export function Button({
  children,
  variant = "primary",
  type = "button",
  isLoading = false,
  disabled = false,
  onClick,
  className,
}: IButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant}
      className={className}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      onClick={onClick}
    >
      {isLoading ? <Spinner /> : children}
    </button>
  );
}
