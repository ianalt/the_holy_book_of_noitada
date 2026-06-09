export interface ISpinnerProps {
  label?: string;
  size?: number;
}

/** Indeterminate loading indicator. Pure presentational atom. */
export function Spinner({ label = "Loading…", size = 16 }: ISpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      data-spinner=""
      style={{ display: "inline-block", width: size, height: size }}
    />
  );
}
