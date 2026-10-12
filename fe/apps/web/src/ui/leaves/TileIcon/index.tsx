import { nivoIconSource, type IconName } from "../Icon";
import { Icon } from "@starci/grammar/common";
import { cn, skeletonVariants } from "@heroui/react";

import { TILE_ICON_CLASS_NAME, TILE_ICON_RESTING_CLASS_NAME, TILE_ICON_SIGNAL_CLASS_NAME, TILE_ICON_SIGNAL_CLASS_NAMES } from "./classNames";

/** Semantic state carried by the corner signal on a console tile. */
export type TileIconSignal = "none" | "active" | "attention";

/** Meaning and state drawn by the console tile mark. */
export type TileIconData = {
  readonly icon: IconName;
  readonly signal?: TileIconSignal;
};

/** Props for the fixed console tile mark. */
export type TileIconProps = {readonly props: TileIconData;readonly isLoading?: boolean;};

const RESTING_CLASSES = skeletonVariants({ animationType: "shimmer" }).base();

/**
 * Draw the persistent 40px console tile icon and its optional state signal.
 *
 * The corner signal is part of the mark's anatomy, so callers name its meaning instead of
 * assembling an absolute-positioned dot beside a generic icon.
 */
export const TileIcon = (props: TileIconProps) => {
  const { props: data, isLoading = false } = props;
  const signal = data.signal ?? "none";
  return (
    <span


      data-signal={signal}
      data-loading={isLoading ? "true" : "false"}
      aria-hidden="true"
      className={cn(TILE_ICON_CLASS_NAME, isLoading ? RESTING_CLASSES : TILE_ICON_RESTING_CLASS_NAME)}>
      
            {isLoading ? null : <Icon source={nivoIconSource(data.icon, "leading")} usage="leading" />}
            <span

        className={cn(TILE_ICON_SIGNAL_CLASS_NAME, TILE_ICON_SIGNAL_CLASS_NAMES[signal])} />
      
        </span>);

};

