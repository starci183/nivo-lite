"use client";

import { useT } from "@/i18n/client";
import { promo } from "@/i18n/dict/promo";
import * as c from "./cardClassNames";

export type FoundingBadgeProps = { readonly isFoundingMember: boolean };

/** Small top-bar pill, earned by a real module purchase inside the Founding 50 window. */
export const FoundingBadge = ({ isFoundingMember }: FoundingBadgeProps) => {
  const t = useT(promo);
  return isFoundingMember ? (
    <span className={c.PILL}>
      <span className={c.DOT} aria-hidden="true" />
      {t("foundingMember")}
    </span>
  ) : null;
};
