/**
 * One module's door on the module choice page - minty-payment-request-web's `ModuleButton`,
 * moved here with the page (phase 2): the module's picture in a thick white frame that turns
 * teal on hover and focus, and Minty peeking out from behind its corner on a device that can
 * hover. A link: the module is another app's page (through Minty's /enter).
 */

import Image from "next/image";

const ART = {
  PETTY_CASH: { icon: "/entities/modules/pettycash-icon.webp", scale: "w-[80%] h-[80%]", cat: "/entities/modules/minty-l.webp", corner: "left" },
  PAYMENT_REQUEST: { icon: "/entities/modules/payment-icon.webp", scale: "w-full h-full", cat: "/entities/modules/minty-r.webp", corner: "right" },
} as const;

export function ModuleChoiceButton({
  code,
  label,
  href,
}: {
  code: keyof typeof ART;
  label: string;
  href: string;
}) {
  const art = ART[code];
  const cat =
    art.corner === "left"
      ? "left-0 top-0 h-[90%] w-[70%] -translate-x-[45%] -translate-y-[45%]"
      : "right-0 top-0 h-[95%] w-[78%] translate-x-[48%] -translate-y-[48%]";
  return (
    <div className="group relative aspect-[390/260] w-full max-w-[390px]">
      <div className={`pointer-events-none absolute z-0 ${cat}`} aria-hidden>
        <div className="relative h-full w-full scale-90 opacity-0 transition-all duration-300 ease-out group-hover:scale-100 group-hover:opacity-100">
          <Image
            src={art.cat}
            alt=""
            fill
            sizes="360px"
            className={art.corner === "left" ? "object-contain object-left-top" : "object-contain object-right-top"}
          />
        </div>
      </div>
      <a
        href={href}
        aria-label={label}
        className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-xl border-[6px] border-gray-100 bg-white transition-colors hover:border-secondary hover:bg-gray-50 focus-visible:border-secondary focus-visible:outline-none"
      >
        <span className={`relative ${art.scale}`}>
          <Image src={art.icon} alt="" fill sizes="390px" className="object-contain" />
        </span>
      </a>
    </div>
  );
}
