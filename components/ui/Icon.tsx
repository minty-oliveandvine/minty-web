/**
 * The handful of icons the skeletal screens need, as inline SVG - no icon font, no CDN
 * (billing-frontend loads material-symbols; this app does not until the design pass decides
 * what it wants). `aria-hidden` by default: an icon beside a label is decoration; pass a
 * `label` to make it the label.
 */

import type { SVGProps } from "react";

export type IconName = "chevron-left" | "chevron-right" | "check" | "close" | "warning" | "info";

const PATHS: Record<IconName, string> = {
  "chevron-left": "M15 6l-6 6 6 6",
  "chevron-right": "M9 6l6 6-6 6",
  check: "M5 12l5 5L20 7",
  close: "M6 6l12 12M18 6L6 18",
  warning: "M12 4l9 16H3L12 4zm0 6v4m0 3v.5",
  info: "M12 8h.01M11 12h1v4h1M12 3a9 9 0 110 18 9 9 0 010-18z",
};

export function Icon({
  name,
  label,
  size = 18,
  ...rest
}: { name: IconName; label?: string; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
