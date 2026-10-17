"use client"

import { EMPTY_LOYALTY_BOARD } from "@/hooks/loyalty"
import { useQueryLoyaltyBoardSwr } from "@/hooks/swr"
import { useFormatter, useTranslations } from "next-intl"
import {
    CAMPAIGN_BRIEF_MAX,
    campaignStatusKey,
    campaignStatusTone,
    reasonKey,
    useLoyaltyPromo,
    useSegmentLabel,
} from "@/hooks/loyaltyPromo"
import { LoyaltyPromoBase } from "./component"
import type { LoyaltyPromoBaseProps, LoyaltyPromoPreviewLine, LoyaltyPromoResult } from "./component"

/** The connected promotion tab: build a segment with a live count, send the offer in (the back end drafts the message slowly, so the campaign is polled) and list the offers prepared so far. */
/** The connected Promo tab: reads the loyalty board itself (SWR shares the one request with the other tabs). */
export const LoyaltyPromo = () => {
    const { data } = useQueryLoyaltyBoardSwr()
    const board = data ?? EMPTY_LOYALTY_BOARD
    const t = useTranslations("loyalty")
    const format = useFormatter()
    const promo = useLoyaltyPromo(board)
    const labelOf = useSegmentLabel(board.config)
    const values = promo.form.watch()
    const { preview, created } = promo

    const previewLines: Array<LoyaltyPromoPreviewLine> = []
    if (preview.kind === "failed") previewLines.push({ id: "failed", text: t("previewFailed"), emphasis: false })
    if (preview.kind === "loading") previewLines.push({ id: "loading", text: t("previewLoading"), emphasis: false })
    if (preview.kind === "ready") {
        const shown = preview.preview
        previewLines.push({
            id: "count",
            text: t("previewCount", { total: format.number(shown.total), reachable: format.number(shown.reachable) }),
            emphasis: true,
        })
        previewLines.push({ id: "who", text: t("previewWho", { who: promo.segmentLabel }), emphasis: false })
        if (shown.names.length > 0)
            previewLines.push({
                id: "sample",
                text: t("previewSample", { names: format.list([...shown.names], { type: "unit" }) }),
                emphasis: false,
            })
    }

    let result: LoyaltyPromoResult | undefined
    let failure: string | undefined
    if (created !== null && !promo.isWriting) {
        if (created.status === "failed") failure = t(reasonKey(created.errorCode))
        else {
            const seconds = created.draftMs === null || created.draftMs === undefined ? null : created.draftMs / 1000
            result = {
                title:
                    seconds === null
                        ? t("createdWaitingTemplate")
                        : t("createdWaiting", { s: Math.max(1, Math.round(seconds)) }),
                recipients: t("createdRecipients", { n: created.recipients }),
                time:
                    seconds === null ? "" : t("draftTime", { s: format.number(seconds, { maximumFractionDigits: 1 }) }),
                draft: created.draft,
            }
        }
    }

    const reachNobody = preview.kind === "ready" && preview.preview.total === 0

    return (
        <LoyaltyPromoBase
            props={buildPromotionView({
                board,
                t,
                values,
                promo,
                previewLines,
                reachNobody,
                result,
                failure,
                format,
                labelOf,
            })}
            on={{
                setTiers: promo.setTiers,
                setInactive: promo.setInactive,
                setSpend: promo.setSpend,
                setBirthday: promo.setBirthday,
                setName: promo.setName,
                setBrief: promo.setBrief,
                submit: () => void promo.submit(),
            }}
        />
    )
}

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
    readonly board: typeof EMPTY_LOYALTY_BOARD
    readonly t: ReturnType<typeof useTranslations<"loyalty">>
    readonly values: LoyaltyPromoBaseProps["props"]["values"]
    readonly promo: ReturnType<typeof useLoyaltyPromo>
    readonly previewLines: LoyaltyPromoPreviewLine[]
    readonly reachNobody: boolean
    readonly result: LoyaltyPromoResult | undefined
    readonly failure: string | undefined
    readonly format: ReturnType<typeof useFormatter>
    readonly labelOf: ReturnType<typeof useSegmentLabel>
}
/** Builds the LoyaltyPromoContent section from the current view. */
const buildPromotionView = ({
    board,
    t,
    values,
    promo,
    previewLines,
    reachNobody,
    result,
    failure,
    format,
    labelOf,
}: BuildPromotionViewContext) =>
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
        previewLines,
        briefMax: CAMPAIGN_BRIEF_MAX,
        isBusy: promo.isBusy,
        isDrafting: promo.isWriting,
        isSubmitDisabled: values.brief.trim() === "" || reachNobody,
        ...(result === undefined ? {} : { result }),
        ...(failure === undefined ? {} : { failure }),
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
