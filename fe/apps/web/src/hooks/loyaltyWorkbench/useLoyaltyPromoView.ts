import { useTranslations } from "next-intl"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useLoyaltyPromo, useLoyaltyPromotionView } from "@/hooks/loyaltyPromo"
import { toast } from "@/modules/toast"
import { EMPTY_LOYALTY_BOARD } from "@/hooks/loyalty"
import type { LoyaltyPanelInput } from "@/hooks/loyalty"

/** Resolves one active promotion session, its real board read and its separately owned atomic commands. */
export const useLoyaltyPromoView = (input: LoyaltyPanelInput) => {
    const t = useTranslations("loyalty")
    const slotLabels = useSlotLabels()
    const promo = useLoyaltyPromo(input.read.data ?? EMPTY_LOYALTY_BOARD, input)
    const projection = useLoyaltyPromotionView(input.read.data ?? EMPTY_LOYALTY_BOARD, promo)
    const { rows, ...copy } = projection.data
    const labels = slotLabels(t("campaignsEmptyTitle"))
    return {
        props: {
            slot: mapSlot(slotOfSwr(input.read), () => ({ rows })),
            copy,
            labels: labels,
            preview: projection.preview,
            campaign: projection.campaign,
        },
        on: {
            setTiers: promo.setTiers,
            setInactive: promo.setInactive,
            setSpend: promo.setSpend,
            setBirthday: promo.setBirthday,
            setName: promo.setName,
            setBrief: promo.setBrief,
            submit: () => {
                promo.submit().catch(() => toast.danger(labels.error))
            },
            retry: () => {
                input.read.mutate().catch(() => toast.danger(labels.error))
            },
            retryPreview: () => {
                promo.previewRead.mutate().catch(() => toast.danger(projection.preview.labels.error))
            },
            retryCampaign: () => {
                promo.campaignRead.mutate().catch(() => toast.danger(projection.campaign.labels.error))
            },
        },
    }
}
