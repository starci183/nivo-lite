import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useFormatter, useTranslations } from "next-intl"
import type { LoyaltyBoardType } from "@/hooks/swr"
import type { LoyaltyCampaignValues } from "@/hooks/rhf"
import {
    CAMPAIGN_BRIEF_MAX,
    campaignStatusKey,
    campaignStatusTone,
    promotionPreviewOf,
    promotionResultOf,
    isDrafting,
} from "./loyaltyPromo.shared"
import { useSegmentLabel } from "./useSegmentLabel"
import type { useLoyaltyPromo } from "./useLoyaltyPromo"
import type { BadgeTone } from "@starci/grammar/common"
import type { DataSlot, SlotLabels } from "@/modules/types"
/** Inputs needed to build the LoyaltyPromoContent section. */
interface BuildPromotionCopyContext {
    readonly t: ReturnType<typeof useTranslations<"loyalty">>
}
/** Builds the LoyaltyPromoContent section from the current view. */
const buildPromotionCopy = ({ t }: BuildPromotionCopyContext) =>
    ({
        title: t("promoTitle"),
        body: t("promoBody"),
        tiers: t("segTiers"),
        tiersHint: t("segTiersHint"),
        inactive: t("segInactive"),
        inactiveHint: t("segInactiveHint"),
        spend: t("segSpend"),
        spendHint: t("segSpendHint"),
        birthday: t("segBirthday"),
        name: t("campaignName"),
        nameHint: t("campaignNameHint"),
        brief: t("brief"),
        briefHint: t("briefHint"),
        submit: t("submitCampaign"),
        drafting: t("drafting"),
        failedTitle: t("campaignFailed"),
        draftLabel: t("draftLabel"),
        managersOnly: t("promoManagersOnly"),
        managersOnlyBody: t("promoManagersOnlyBody"),
        campaignsTitle: t("campaignsTitle"),
        campaignsEmptyTitle: t("campaignsEmptyTitle"),
        campaignsEmptyBody: t("campaignsEmptyBody"),
    }) as const

/** Inputs needed to build the LoyaltyPromoContent section. */
interface BuildPromotionViewContext {
    readonly board: LoyaltyBoardType
    readonly t: ReturnType<typeof useTranslations<"loyalty">>
    readonly values: LoyaltyCampaignValues
    readonly promo: ReturnType<typeof useLoyaltyPromo>
    readonly reachNobody: boolean
    readonly format: ReturnType<typeof useFormatter>
    readonly labelOf: ReturnType<typeof useSegmentLabel>
}
/** Builds the LoyaltyPromoContent section from the current view. */
const buildPromotionView = ({ board, t, values, promo, reachNobody, format, labelOf }: BuildPromotionViewContext) =>
    ({
        canManage: board.canManage,
        copy: buildPromotionCopy({ t }),
        tierOptions: board.config.tiers.map((tier) => ({ value: tier.key, label: tier.name })),
        values: {
            tiers: values.tiers,
            inactive: values.inactive,
            spend: values.spend,
            birthday: values.birthday,
            name: values.name,
            brief: values.brief,
        },
        briefError: promo.form.formState.errors.brief?.message,
        briefMax: CAMPAIGN_BRIEF_MAX,
        isBusy: promo.isBusy,
        isDrafting: promo.isWriting,
        isSubmitDisabled: values.brief.trim() === "" || reachNobody,
        rows: board.campaigns.map((campaign) => ({
            id: campaign.id,
            name: campaign.name,
            statusLabel: t(campaignStatusKey(campaign.status)),
            statusTone: campaignStatusTone(campaign.status),
            counts: `${t("campaignRecipients", { n: campaign.recipients })} · ${t("campaignCounts", {
                sent: campaign.sent,
                queued: campaign.queued,
                failed: campaign.failed,
                skipped: campaign.skipped,
            })}`,
            meta: `${t("campaignMeta", {
                who: campaign.createdBy === "" ? "-" : campaign.createdBy,
                date: format.dateTime(new Date(campaign.createdAt), {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                }),
            })} · ${labelOf(campaign.segment)}`,
            draft: campaign.draft,
        })),
    }) as const

/** The view `useLoyaltyPromotionView` returns. */
export interface LoyaltyPromotionView {
    data: {
        readonly canManage: boolean
        readonly copy: {
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
        readonly tierOptions: {
            value: string
            label: string
        }[]
        readonly values: {
            readonly tiers: string[]
            readonly inactive: string
            readonly spend: string
            readonly birthday: boolean
            readonly name: string
            readonly brief: string
        }
        readonly briefError: string | undefined
        readonly briefMax: 500
        readonly isBusy: boolean
        readonly isDrafting: boolean
        readonly isSubmitDisabled: boolean
        readonly rows: {
            id: string
            name: string
            statusLabel: string
            statusTone: BadgeTone
            counts: string
            meta: string
            draft: string
        }[]
    }
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

/** Owns ready promotion atoms and folds each actual preview/campaign read independently. */
export const useLoyaltyPromotionView = (
    board: LoyaltyBoardType,
    promo: ReturnType<typeof useLoyaltyPromo>,
): LoyaltyPromotionView => {
    const t = useTranslations("loyalty")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const labelOf = useSegmentLabel(board.config)
    const values = promo.form.watch()
    const reachNobody = promo.previewRead.data?.total === 0
    const data = buildPromotionView({ board, t, values, promo, reachNobody, format, labelOf })
    return {
        data,
        preview: {
            slot: mapSlot(slotOfSwr(promo.previewRead), (ready) =>
                promotionPreviewOf(
                    {
                        total: ready.total,
                        reachable: ready.reachable,
                        names: ready.sample.map((member) => member.name),
                    },
                    promo.segmentLabel,
                    t,
                    format,
                ),
            ),
            labels: slotLabels(t("previewLoading")),
            loadingLabel: t("previewLoading"),
            audienceLabel: t("previewWho", { who: promo.segmentLabel }),
        },
        campaign: {
            slot: mapSlot(slotOfSwr(promo.campaignRead), (ready) =>
                promotionResultOf(ready, isDrafting(ready.status), t, format),
            ),
            labels: slotLabels(t("campaignsEmptyTitle")),
            hasCampaign: promo.hasCampaign,
        },
    }
}
