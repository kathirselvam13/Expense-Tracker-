type UiIconProps = {
  name: string;
  className?: string;
};

export function UiIcon({ name, className = "" }: UiIconProps) {
  return <i aria-hidden="true" className={`ui-icon fi fi-rr-${name} ${className}`.trim()} />;
}
