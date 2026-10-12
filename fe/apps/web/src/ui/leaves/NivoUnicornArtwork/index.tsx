import { cn, skeletonVariants } from "@heroui/react";
import { UNICORN_ARTWORK_CLASS_NAME, UNICORN_ARTWORK_IMAGE_CLASS_NAME } from "./classNames";

/** Data owned by the Nivo dashboard mascot artwork. */
export type NivoUnicornArtworkData = {readonly tone?: "brand";};

/** Props for {@link NivoUnicornArtwork}. */
export type NivoUnicornArtworkProps = {readonly props: NivoUnicornArtworkData;readonly isLoading?: boolean;};

const RESTING_CLASSES = skeletonVariants({ animationType: "shimmer" }).base();

/** Draw the single decorative Nivo unicorn band used above the account signals. */
export const NivoUnicornArtwork = (props: NivoUnicornArtworkProps) => {
  const { props: data, isLoading = false } = props;
  const tone = data.tone ?? "brand";
  return (
    <span


      data-tone={tone}
      data-loading={isLoading ? "true" : "false"}
      aria-hidden="true"
      className={cn(UNICORN_ARTWORK_CLASS_NAME, isLoading ? RESTING_CLASSES : undefined)}>
      
            {isLoading ? null :
      <img
        src="/images/nivo-unicorn-overview.png"
        alt=""
        width="180"
        height="120"
        className={UNICORN_ARTWORK_IMAGE_CLASS_NAME} />

      }
        </span>);

};

