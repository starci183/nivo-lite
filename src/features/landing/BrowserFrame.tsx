import { cn } from "@heroui/react";
import { FRAME, FRAME_BAR, FRAME_DOT, FRAME_DOTS, FRAME_IMG, FRAME_LABEL } from "./classNames";

/** Props for {@link BrowserFrame}. */
export type BrowserFrameProps = {
  readonly src: string;
  readonly alt: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly priority?: boolean;
  readonly className?: string;
};

/** A real product screenshot in a browser-style frame, always labelled as demo data. */
export const BrowserFrame = ({ src, alt, label, width, height, priority = false, className }: BrowserFrameProps) => (
  <figure className={cn(FRAME, className)}>
    <div className={FRAME_BAR} aria-hidden="true">
      <span className={FRAME_DOTS}>
        <span className={FRAME_DOT} />
        <span className={FRAME_DOT} />
        <span className={FRAME_DOT} />
      </span>
      <span className={FRAME_LABEL}>{label}</span>
    </div>
    <img
      className={FRAME_IMG}
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  </figure>
);
