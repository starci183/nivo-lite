"use client"

import { useLoyaltyCampaignForm } from "@/hooks/rhf"
import {
    QUERY_LOYALTY_BOARD_SWR_KEY,
    useMutateDraftLoyaltyCampaignSwr,
    useQueryLoyaltyCampaignSwr,
    useQueryLoyaltySegmentPreviewSwr,
} from "@/hooks/swr"
import type { LoyaltyBoardType } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { matchesSwrKey } from "@/modules/utils"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useState } from "react"
import { useSWRConfig } from "swr"
import {
    CAMPAIGN_BRIEF_MAX,
    CAMPAIGN_NAME_MAX,
    DRAFT_POLL_MS,
    PREVIEW_DELAY_MS,
    inactiveText,
    isDrafting,
    segmentOf,
    spendText,
} from "./loyaltyPromo.shared"
import type { PromoSegment } from "./loyaltyPromo.shared"
import { useSegmentLabel } from "./useSegmentLabel"

/** How many members a segment reaches, and a few of them. */
export interface PromoPreview {
    readonly total: number
    readonly reachable: number
    readonly names: ReadonlyArray<string>
}

/** The live count: still counting, answered, or failed. */
export type PreviewState =
    | { readonly kind: "loading" }
    | { readonly kind: "ready"; readonly preview: PromoPreview }
    | { readonly kind: "failed" }

/** The status a polled campaign reports. */
interface PolledStatus {
    readonly status: string
}

const LIMITS = { nameMax: CAMPAIGN_NAME_MAX, briefMax: CAMPAIGN_BRIEF_MAX }

/** The promotion builder: the form, the debounced live count of the segment, and the slow message draft that is polled until it leaves `waiting`. */
export const useLoyaltyPromo = (board: LoyaltyBoardType) => {
    const t = useTranslations("loyalty")
    const withToast = useGraphQLWithToast()
    const { mutate } = useSWRConfig()
    const labelOf = useSegmentLabel(board.config)
    const form = useLoyaltyCampaignForm(LIMITS)
    const draftMutation = useMutateDraftLoyaltyCampaignSwr()
    const [tiers, inactive, spend, birthday] = form.watch(["tiers", "inactive", "spend", "birthday"])
    const tiersKey = tiers.join(",")
    const segment = useMemo(
        () => segmentOf({ tiers: tiersKey === "" ? [] : tiersKey.split(","), inactive, spend, birthday }),
        [tiersKey, inactive, spend, birthday],
    )
    const [settled, setSettled] = useState<PromoSegment>(segment)
    const [campaignId, setCampaignId] = useState<string | null>(null)

    useEffect(() => {
        const timer = setTimeout(() => setSettled(segment), PREVIEW_DELAY_MS)
        return () => clearTimeout(timer)
    }, [segment])

    const count = useQueryLoyaltySegmentPreviewSwr(board.canManage ? { segment: settled } : null)
    let preview: PreviewState = { kind: "loading" }
    if (count.data !== undefined)
        preview = {
            kind: "ready",
            preview: {
                total: count.data.total,
                reachable: count.data.reachable,
                names: count.data.sample.map((member) => member.name),
            },
        }
    else if (count.error !== undefined) preview = { kind: "failed" }

    const campaign = useQueryLoyaltyCampaignSwr(campaignId === null ? null : { id: campaignId }, {
        refreshInterval: (latest: PolledStatus | undefined) =>
            latest !== undefined && !isDrafting(latest.status) ? 0 : DRAFT_POLL_MS,
        onSuccess: (data: PolledStatus) => {
            if (!isDrafting(data.status)) void mutate(matchesSwrKey(QUERY_LOYALTY_BOARD_SWR_KEY))
        },
    })
    const created = campaignId === null ? null : (campaign.data ?? null)
    const isWriting = campaignId !== null && (created === null || isDrafting(created.status))

    const submit = form.handleSubmit(async (values) => {
        const next = segmentOf(values)
        const name = values.name.trim() === "" ? labelOf(next) : values.name.trim()
        const result = await withToast(() => draftMutation.trigger({ name, segment: next, brief: values.brief }), {
            successMessage: t("drafting"),
        })
        if (result === undefined) return
        setCampaignId(result.campaignId)
        form.setValue("brief", "")
        form.setValue("name", "")
        void mutate(matchesSwrKey(QUERY_LOYALTY_BOARD_SWR_KEY))
    })

    return {
        form,
        segmentLabel: labelOf(segment),
        preview,
        created,
        isWriting,
        isBusy: draftMutation.isMutating || isWriting,
        submit,
        setTiers: (value: ReadonlyArray<string>) => form.setValue("tiers", [...value]),
        setInactive: (value: string) => form.setValue("inactive", inactiveText(value)),
        setSpend: (value: string) => form.setValue("spend", spendText(value)),
        setBirthday: (value: boolean) => form.setValue("birthday", value),
        setName: (value: string) => form.setValue("name", value.slice(0, CAMPAIGN_NAME_MAX)),
        setBrief: (value: string) => form.setValue("brief", value, { shouldValidate: form.formState.isSubmitted }),
    }
}
