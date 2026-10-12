import { Image, MediaFrame } from "@starci/grammar/common";

/** Props for {@link BrowserFrame}. */
export type BrowserFrameProps = {
  readonly src: string;
  readonly alt: string;
  /** Visible caption under the shot; on the landing it always says the data is demo data. */
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly priority?: boolean;
};

/**
 * A real product screenshot framed by Grammar's `MediaFrame` (BOUNDARY-5 case-2, SURFACE-3 case-3), always captioned
 * as demo data. The old hand-drawn browser chrome (dots, tinted label) carried no information and was removed
 * (DISCIPLINE-1).
 */
export const BrowserFrame = ({ src, alt, label, width, height, priority = false }: BrowserFrameProps) => (
  <MediaFrame treatment="framed" aspect="auto" caption={label}>
    <Image src={src} alt={alt} width={width} height={height} aspect="auto" fit="contain" loading={priority ? "eager" : "lazy"} />
  </MediaFrame>
);
