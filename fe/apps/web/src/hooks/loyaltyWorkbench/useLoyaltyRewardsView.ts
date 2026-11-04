import { useFeatureReset } from "@/hooks/reuseables"
import type { LoyaltyPanelInput } from "@/hooks/loyalty"
import { toast } from "@/modules/toast"

import { useLoyaltyPanelBoard } from "@/hooks/loyalty"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    maskRewardField,
    rewardInputOf,
    rewardToggleInputOf,
    rewardValuesOf,
    useLoyaltyRewardActions,
} from "@/hooks/loyaltyRewards"
import { useLoyaltyRewardForm } from "@/hooks/rhf"
import type { RewardTextField, DataSlot, SlotLabels } from "@/modules/types"
import { useLoyaltyRewardsContent, type LoyaltyRewardEditing } from "./useLoyaltyRewardsContent"

/** The reward catalogue section as the builder draws it. */
type RewardsBuilt = ReturnType<typeof useLoyaltyRewardsContent>

/** The view `useLoyaltyRewardsView` returns. */
export interface LoyaltyRewardsViewShape {
    props: {
        slot: DataSlot<{ rows: RewardsBuilt["rows"] }>
        copy: Omit<RewardsBuilt, "rows">
        labels: SlotLabels
    }
    on: {
        add: () => void
        preset: () => void
        edit: (id: string | null) => void
        toggle: (id: string, active: boolean) => void
        confirmRemove: (id: string) => Promise<void>
        change: (field: RewardTextField, value: string) => void
        setActive: (active: boolean) => void
        submit: () => void
        cancelForm: () => void
        retry: () => void
    }
}

/** The connected reward catalogue: managers add, edit, pause and remove rewards (outcome toasted); everyone else reads. */
/** The connected Rewards tab: reads the loyalty board itself (SWR shares the one request with the other tabs). */
export const useLoyaltyRewardsView = (input: LoyaltyPanelInput): LoyaltyRewardsViewShape => {
    const { read, board, slotLabels, retry } = useLoyaltyPanelBoard(input)
    const t = useTranslations("loyalty")
    const actions = useLoyaltyRewardActions(input)
    const [editing, setEditing] = useState<LoyaltyRewardEditing | null>(null)
    const target = editing === null ? null : (board.rewards.find((reward) => reward.id === editing.id) ?? null)
    const form = useLoyaltyRewardForm(rewardValuesOf(target))
    useFeatureReset({
        ...input,
        onReset: () => {
            setEditing(null)
            form.reset(rewardValuesOf(null))
        },
    })
    const open = (id: string | null) => {
        form.reset(rewardValuesOf(board.rewards.find((reward) => reward.id === id) ?? null))
        setEditing({ id })
    }
    const submit = form.handleSubmit((values) => actions.save(rewardInputOf(values, target), () => setEditing(null)))
    // Built from the empty board while the read is on its way, so the placeholder is the same tree.
    const view = useLoyaltyRewardsContent({ board, actions, editing, target, form })
    const { rows, ...copy } = view
    return {
        props: { slot: mapSlot(slotOfSwr(read), () => ({ rows })), copy, labels: slotLabels(t("rewardsEmptyTitle")) },
        on: {
            add: () => open(null),
            preset: actions.preset,
            edit: open,
            toggle: (id: string, active: boolean) => {
                const reward = board.rewards.find((candidate) => candidate.id === id)
                if (reward === undefined) return
                actions.save(rewardToggleInputOf(reward, active), () => undefined)
            },
            confirmRemove: (id: string) => actions.remove(id, () => undefined),
            change: (field: RewardTextField, value: string) =>
                form.setValue(field, maskRewardField(field, value), { shouldValidate: form.formState.isSubmitted }),
            setActive: (active: boolean) => form.setValue("active", active),
            submit: () => {
                submit().catch(() => toast.danger(slotLabels("").error))
            },
            cancelForm: () => setEditing(null),
            retry: retry,
        },
    }
}
