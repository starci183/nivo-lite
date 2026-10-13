"use client"

import { Badge } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { promo } from "@/i18n/dict/promo"

export type FoundingBadgeProps = { readonly isFoundingMember: boolean }

/**
 * Small top-bar mark, earned by a real module purchase inside the Founding 50 window. A real earned state, so a
 * Grammar `Badge` with its own leading dot carries it (HIERARCHY-1 case-3) instead of a hand-drawn pill.
 */
export const FoundingBadge = ({ isFoundingMember }: FoundingBadgeProps) => {
    const t = useT(promo)
    return isFoundingMember ? (
        <Badge tone="accent" isDot>
            {t("foundingMember")}
        </Badge>
    ) : null
}
