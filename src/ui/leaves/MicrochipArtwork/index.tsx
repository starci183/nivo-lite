import { cn, skeletonVariants } from "@heroui/react";
import { MICROCHIP_ARTWORK_CLASS_NAME, MICROCHIP_ARTWORK_RESTING_CLASS_NAME, MICROCHIP_ARTWORK_SVG_CLASS_NAME } from "./classNames";

/** The one controlled palette this decorative product artwork can use. */
export type MicrochipArtworkTone = "brand";

/** What the artwork draws without exposing SVG construction to feature callers. */
export type MicrochipArtworkData = {
  readonly tone?: MicrochipArtworkTone;
};

/** Props for {@link MicrochipArtwork}. */
export type MicrochipArtworkProps = {readonly props: MicrochipArtworkData;readonly isLoading?: boolean;};

const RESTING_CLASSES = skeletonVariants({ animationType: "shimmer" }).base();

/**
 * Draw a floating two-layer microchip whose red face sits above its black vector backing.
 * Circuit runs extend the silhouette so the mark reads as product artwork, not an icon on a tile.
 */
export const MicrochipArtwork = (props: MicrochipArtworkProps) => {
  const { props: data, isLoading = false } = props;
  const tone = data.tone ?? "brand";
  return (
    <span


      data-tone={tone}
      data-loading={isLoading ? "true" : "false"}
      aria-hidden="true"
      className={cn(MICROCHIP_ARTWORK_CLASS_NAME, isLoading ? cn(RESTING_CLASSES, MICROCHIP_ARTWORK_RESTING_CLASS_NAME) : undefined)}>
      
            {isLoading ? null :
      <svg viewBox="0 0 160 112" className={MICROCHIP_ARTWORK_SVG_CLASS_NAME} focusable="false">
                    <g data-layer="circuit-back" className="fill-none stroke-foreground" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 29h24l12 12" />
                        <path d="M8 83h22l14-14" />
                        <path d="M116 35l13-12h23" />
                        <path d="M116 75l14 14h22" />
                        <circle cx="8" cy="29" r="4" className="fill-foreground stroke-none" />
                        <circle cx="152" cy="89" r="4" className="fill-foreground stroke-none" />
                    </g>
                    <g data-layer="circuit-front" className="fill-none stroke-accent" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 16h24l10 12" />
                        <path d="M17 96h25l10-13" />
                        <path d="M108 23l10-11h24" />
                        <path d="M108 84l11 12h24" />
                        <circle cx="18" cy="16" r="4" className="fill-accent stroke-none" />
                        <circle cx="142" cy="12" r="4" className="fill-accent stroke-none" />
                    </g>

                    <g data-layer="pins" className="fill-none stroke-foreground" strokeWidth="4" strokeLinecap="round">
                        <path d="M59 24V12M78 24V8M97 24V12" />
                        <path d="M59 88v12M78 88v16M97 88v12" />
                        <path d="M45 42H33M45 58H27M45 74H33" />
                        <path d="M111 42h12M111 58h18M111 74h12" />
                    </g>

                    <rect data-layer="chip-back" x="52" y="30" width="68" height="66" rx="16" className="fill-foreground" />
                    <rect data-layer="chip-face" x="43" y="21" width="68" height="66" rx="16" className="fill-accent stroke-foreground" strokeWidth="3" />
                    <path d="M55 38h44M55 47h29" className="fill-none stroke-foreground" strokeWidth="3" strokeLinecap="round" />
                    <rect x="58" y="54" width="38" height="24" rx="7" className="fill-foreground" />
                    <rect x="66" y="60" width="22" height="12" rx="4" className="fill-accent" />
                    <circle cx="99" cy="69" r="4" className="fill-foreground" />
                </svg>
      }
        </span>);

};

