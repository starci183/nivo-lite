import { useLoyaltyCommand, loyaltyReadOf, type LoyaltyPanelActivation } from "@/hooks/loyalty"
import { mutate } from "@/modules/viewer-cache"

import { useLoyaltyCampaignForm, type LoyaltyCampaignValues } from "@/hooks/rhf"
import {
    QUERY_LOYALTY_BOARD_SWR_KEY,
    useMutateDraftLoyaltyCampaignSwr,
    useQueryLoyaltyCampaignSwr,
    useQueryLoyaltySegmentPreviewSwr,
    type LoyaltyBoardType,
} from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useState } from "react"
import {
    CAMPAIGN_BRIEF_MAX,
    CAMPAIGN_NAME_MAX,
    DRAFT_POLL_MS,
    PREVIEW_DELAY_MS,
    inactiveText,
    isDrafting,
    segmentOf,
    spendText,
    type PromoSegment,
} from "./loyaltyPromo.shared"
import { useSegmentLabel } from "./useSegmentLabel"
import { useFeatureReset } from "@/hooks/reuseables"
import type { UseFormReturn } from "react-hook-form"
import type { SWRResponse } from "swr"

/** How many members a segment reaches, and a few of them. */
export interface PromoPreview {
    readonly total: number
    readonly reachable: number
    readonly names: ReadonlyArray<string>
}

/** The status a polled campaign reports. */
interface PolledStatus {
    readonly status: string
}

const LIMITS = { nameMax: CAMPAIGN_NAME_MAX, briefMax: CAMPAIGN_BRIEF_MAX }

/** The view `useLoyaltyPromo` returns. */
export interface LoyaltyPromoViewShape {
    setTiers: (value: ReadonlyArray<string>) => void
    setInactive: (value: string) => void
    setSpend: (value: string) => void
    setBirthday: (value: boolean) => void
    setName: (value: string) => void
    setBrief: (value: string) => void
    form: UseFormReturn<LoyaltyCampaignValues>
    segmentLabel: string
    previewRead: SWRResponse<
        {
            reachable: number
            total: number
            sample: Array<{
                id: string
                name: string
                tierKey: string | null
            }>
        },
        Error
    >
    campaignRead: SWRResponse<
        {
            createdAt: string
            createdBy: string
            draft: string
            draftMs: number | null
            errorCode: string | null
            failed: number
            finishedAt: string | null
            id: string
            messageDraft: string
            name: string
            queued: number
            recipients: number
            sent: number
            skipped: number
            status: string
            workItemId: string | null
            segment: {
                birthdayThisMonth: boolean
                inactiveDays: number
                minSpendVnd: number
                tiers: Array<string>
            }
        },
        Error
    >
    hasCampaign: boolean
    created: {
        createdAt: string
        createdBy: string
        draft: string
        draftMs: number | null
        errorCode: string | null
        failed: number
        finishedAt: string | null
        id: string
        messageDraft: string
        name: string
        queued: number
        recipients: number
        sent: number
        skipped: number
        status: string
        workItemId: string | null
        segment: {
            birthdayThisMonth: boolean
            inactiveDays: number
            minSpendVnd: number
            tiers: Array<string>
        }
    } | null
    isWriting: boolean
    isBusy: boolean
    submit: (e?: React.BaseSyntheticEvent) => Promise<void>
}

/** The promotion builder: the form, the debounced live count of the segment, and the slow message draft that is polled until it leaves `waiting`. */
export const useLoyaltyPromo = (board: LoyaltyBoardType, activation: LoyaltyPanelActivation): LoyaltyPromoViewShape => {
    const t = useTranslations("loyalty")
    const [sessionScope, setSessionScope] = useState<string | null>(null)
    const isSessionReady = activation.isActive && activation.isReady && sessionScope === activation.scope
    const command = useLoyaltyCommand({ ...activation, isReady: isSessionReady })
    const withToast = useGraphQLWithToast()
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
    useFeatureReset({
        ...activation,
        onReset: () => {
            setSessionScope(activation.isActive && activation.isReady ? activation.scope : null)
            form.reset()
            setSettled(segmentOf(form.getValues()))
            setCampaignId(null)
        },
    })

    useEffect(() => {
        if (!isSessionReady) return
        const timer = setTimeout(() => setSettled(segment), PREVIEW_DELAY_MS)
        return () => clearTimeout(timer)
    }, [segment, isSessionReady, activation.scope])

    const count = useQueryLoyaltySegmentPreviewSwr(isSessionReady && board.canManage ? { segment: settled } : null)
    const campaign = useQueryLoyaltyCampaignSwr(!isSessionReady || campaignId === null ? null : { id: campaignId }, {
        refreshInterval: (latest: PolledStatus | undefined) =>
            !isSessionReady || (latest !== undefined && !isDrafting(latest.status)) ? 0 : DRAFT_POLL_MS,
        onSuccess: (data: PolledStatus) => {
            if (!isDrafting(data.status))
                mutate(loyaltyReadOf(activation.workspaceId, [QUERY_LOYALTY_BOARD_SWR_KEY])).catch((error: unknown) =>
                    withToast(() => Promise.reject(error), { showSuccessToast: false }),
                )
        },
    })
    const hasCampaign = isSessionReady && campaignId !== null
    const created = !hasCampaign ? null : (campaign.data ?? null)
    const isWriting = hasCampaign && (created === null || isDrafting(created.status))

    const submit = form.handleSubmit((values) => {
        command.dispatch(async (isCurrent) => {
            if (!activation.isActive) return
            const next = segmentOf(values)
            const name = values.name.trim() === "" ? labelOf(next) : values.name.trim()
            const result = await withToast(() => draftMutation.trigger({ name, segment: next, brief: values.brief }), {
                successMessage: t("drafting"),
            })
            if (result === undefined) return
            if (isCurrent()) {
                setCampaignId(result.campaignId)
                form.setValue("brief", "")
                form.setValue("name", "")
            }
            await mutate(loyaltyReadOf(activation.workspaceId, [QUERY_LOYALTY_BOARD_SWR_KEY]))
        })
    })

    return {
        form,
        segmentLabel: labelOf(segment),
        previewRead: count,
        campaignRead: campaign,
        hasCampaign,
        created,
        isWriting,
        isBusy: !isSessionReady || command.isPending || isWriting,
        submit,
        ...campaignFieldsOf(form),
    }
}

/** What `campaignFieldsOf` returns. */
export interface CampaignFieldsOfResult {
    setTiers: (value: ReadonlyArray<string>) => void
    setInactive: (value: string) => void
    setSpend: (value: string) => void
    setBirthday: (value: boolean) => void
    setName: (value: string) => void
    setBrief: (value: string) => void
}

/** Normalizes only the promotion fields; submission and its remote settlement remain with the command owner. */
const campaignFieldsOf = (form: ReturnType<typeof useLoyaltyCampaignForm>): CampaignFieldsOfResult => ({
    setTiers: (value: ReadonlyArray<string>) => form.setValue("tiers", [...value]),
    setInactive: (value: string) => form.setValue("inactive", inactiveText(value)),
    setSpend: (value: string) => form.setValue("spend", spendText(value)),
    setBirthday: (value: boolean) => form.setValue("birthday", value),
    setName: (value: string) => form.setValue("name", value.slice(0, CAMPAIGN_NAME_MAX)),
    setBrief: (value: string) => form.setValue("brief", value, { shouldValidate: form.formState.isSubmitted }),
})
