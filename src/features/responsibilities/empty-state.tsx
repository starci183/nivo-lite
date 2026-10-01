"use client";

import { useRouter } from "next/navigation";
import { EmptyNotice } from "@starci/grammar/common";

/** Props for {@link ResponsibilitiesEmpty}. */
export type ResponsibilitiesEmptyProps = {
  message: string;
  description: string;
  actionLabel?: string;
  href?: string;
};

/** Empty notice whose action navigates: with no action given it only explains. */
export const ResponsibilitiesEmpty = (props: ResponsibilitiesEmptyProps) => {
  const router = useRouter();
  const { href } = props;
  return (
    <EmptyNotice
      message={props.message}
      description={props.description}
      actionLabel={href === undefined ? undefined : props.actionLabel}
      actionVariant="secondary"
      onAction={
        href === undefined
          ? undefined
          : () => {
              router.push(href);
            }
      }
    />
  );
};
