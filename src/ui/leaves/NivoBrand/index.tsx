import { cn, skeletonVariants } from "@heroui/react";
import { NIVO_BRAND_ACCENT_CLASS_NAME, NIVO_BRAND_ARTWORK_CLASS_NAME, NIVO_BRAND_INK_CLASS_NAME, NIVO_BRAND_RESTING_CLASS_NAME, NIVO_BRAND_WRAPPER_CLASS_NAMES } from "./classNames";

/** The two protected presentations of the Nivo identity. */
export type NivoBrandVariant = "lockup" | "mark";

/** Fixed artwork extents owned by the brand leaf. */
export type NivoBrandScale = "navbar" | "hero";

/** What the protected brand artwork draws. */
export type NivoBrandData = {
  readonly label: string;
  readonly variant?: NivoBrandVariant;
  readonly scale?: NivoBrandScale;
};

/** Props for {@link NivoBrand}. */
export type NivoBrandProps = {readonly props: NivoBrandData;readonly isLoading?: boolean;};

const RESTING_CLASSES = skeletonVariants({ animationType: "shimmer" }).base();

type OrbitProps = {
  readonly compact?: boolean;
};

const Orbit = ({ compact = false }: OrbitProps) => {
  const offset = compact ? 0 : 202;
  return (
    <g transform={`translate(${offset} 0)`} data-part="orbit">
            <path className={NIVO_BRAND_ACCENT_CLASS_NAME} d="M28.7 25A30 30 0 0 1 67.3 25" />
            <path className={NIVO_BRAND_ACCENT_CLASS_NAME} d="M71 28.7A30 30 0 0 1 71 67.3" />
            <path className={NIVO_BRAND_ACCENT_CLASS_NAME} d="M67.3 71A30 30 0 0 1 28.7 71" />
            <path className={NIVO_BRAND_ACCENT_CLASS_NAME} d="M25 67.3A30 30 0 0 1 25 28.7" />
        </g>);

};

/** Draw the protected Nivo wordmark or its segmented orbit mark. */
export const NivoBrand = (props: NivoBrandProps) => {
  const { props: data, isLoading = false } = props;
  const variant = data.variant ?? "lockup";
  const scale = data.scale ?? "navbar";
  const wrapperClasses = NIVO_BRAND_WRAPPER_CLASS_NAMES[scale];

  return (
    <span


      data-variant={variant}
      data-scale={scale}
      data-loading={isLoading ? "true" : "false"}
      aria-hidden={isLoading ? true : undefined}
      className={cn(wrapperClasses, isLoading ? cn(RESTING_CLASSES, NIVO_BRAND_RESTING_CLASS_NAME) : undefined)}>
      
            {isLoading ? null :
      <svg
        viewBox={variant === "mark" ? "0 0 96 96" : "0 0 298 96"}
        className={NIVO_BRAND_ARTWORK_CLASS_NAME}
        role="img"
        aria-label={data.label}
        focusable="false">
        
                    {variant === "lockup" ?
        <g className={NIVO_BRAND_INK_CLASS_NAME} data-part="wordmark">
                            <path d="M4 84V12h18l34 46V12h18v72H56L22 38v46Z" />
                            <path d="M86 12h18v72H86Z" />
                            <path d="M112 12h20l21 50 21-50h20l-31 72h-20Z" />
                        </g> :
        null}
                    <Orbit compact={variant === "mark"} />
                </svg>
      }
        </span>);

};

