import { useTranslations } from "next-intl"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useLoyaltyPromo, useLoyaltyPromotionView } from "@/hooks/loyaltyPromo"
import { toast } from "@/modules/toast"
import { EMPTY_LOYALTY_BOARD } from "@/hooks/loyalty"
import type { LoyaltyPanelInput } from "@/hooks/loyalty"
import type { DataSlot, SlotLabels } from "@/modules/types"
import type { BadgeTone } from "@starci/grammar/common"

/** The view `useLoyaltyPromoView` returns. */
export interface LoyaltyPromoView3 {
    props: {
        slot: DataSlot<{
            rows: {
                id: string
                name: string
                statusLabel: string
                statusTone: BadgeTone
                counts: string
                meta: string
                draft: string
            }[]
        }>
        copy: {
            canManage: boolean
            copy: {
                readonly title: string
                readonly body: string
                readonly tiers: string
                readonly tiersHint: string
                readonly inactive: string
                readonly inactiveHint: string
                readonly spend: string
                readonly spendHint: string
                readonly birthday: string
                readonly name: string
                readonly nameHint: string
                readonly brief: string
                readonly briefHint: string
                readonly submit: string
                readonly drafting: string
                readonly failedTitle: string
                readonly draftLabel: string
                readonly managersOnly: string
                readonly managersOnlyBody: string
                readonly campaignsTitle: string
                readonly campaignsEmptyTitle: string
                readonly campaignsEmptyBody: string
            }
            tierOptions: {
                value: string
                label: string
            }[]
            values: {
                readonly tiers: string[]
                readonly inactive: string
                readonly spend: string
                readonly birthday: boolean
                readonly name: string
                readonly brief: string
            }
            briefError: string | undefined
            briefMax: 500
            isBusy: boolean
            isDrafting: boolean
            isSubmitDisabled: boolean
        }
        labels: SlotLabels
        preview: {
            slot: DataSlot<
                {
                    readonly id: string
                    readonly text: string
                    readonly emphasis: boolean
                }[]
            >
            labels: SlotLabels
            loadingLabel: string
            audienceLabel: string
        }
        campaign: {
            slot: DataSlot<{
                result:
                    | {
                          readonly title: string
                          readonly recipients: string
                          readonly time: string
                          readonly draft: string
                      }
                    | undefined
                failure: string | undefined
            }>
            labels: SlotLabels
            hasCampaign: boolean
        }
    }
    on: {
        setTiers: (value: ReadonlyArray<string>) => void
        setInactive: (value: string) => void
        setSpend: (value: string) => void
        setBirthday: (value: boolean) => void
        setName: (value: string) => void
        setBrief: (value: string) => void
        submit: () => void
        retry: () => void
        retryPreview: () => void
        retryCampaign: () => void
    }
}

/** Resolves one active promotion session, its real board read and its separately owned atomic commands. */
export const useLoyaltyPromoView = (input: LoyaltyPanelInput): LoyaltyPromoView3 => {
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
