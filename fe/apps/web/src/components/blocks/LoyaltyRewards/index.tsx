"use client"

import { EMPTY_LOYALTY_BOARD, findTier } from "@/hooks/loyalty"
import { useQueryLoyaltyBoardSwr } from "@/hooks/swr"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import {
    ANY_TIER,
    REWARD_KINDS,
    REWARD_NOTE_MAX,
    maskRewardField,
    rewardInputOf,
    rewardToggleInputOf,
    rewardValuesOf,
    useLoyaltyRewardActions,
} from "@/hooks/loyaltyRewards"
import { useLoyaltyRewardForm } from "@/hooks/rhf"
import { LoyaltyRewardsBase } from "./component"

/** Which reward the form edits: a reward id, or null for a new one. */
interface Editing {
    readonly id: string | null
}

/** The connected reward catalogue: managers add, edit, pause and remove rewards (outcome toasted); everyone else reads. */
/** The connected Rewards tab: reads the loyalty board itself (SWR shares the one request with the other tabs). */
export const LoyaltyRewards = () => {
    const { data } = useQueryLoyaltyBoardSwr()
    const board = data ?? EMPTY_LOYALTY_BOARD
    const t = useTranslations("loyalty")
    const format = useFormatter()
    const actions = useLoyaltyRewardActions()
    const [editing, setEditing] = useState<Editing | null>(null)
    const target = editing === null ? null : (board.rewards.find((reward) => reward.id === editing.id) ?? null)
    const form = useLoyaltyRewardForm(rewardValuesOf(target))
    const money = (value: number) =>
        format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const kindLabel = (reward: (typeof board.rewards)[number]) =>
        reward.kind === "percent" && reward.percent
            ? `${t("rewardKind_percent")} ${reward.percent}%`
            : t(`rewardKind_${reward.kind}`)
    const costLine = (reward: (typeof board.rewards)[number]) =>
        reward.valueVnd > 0
            ? `${t("points", { n: format.number(reward.pointsCost) })} · ${t("rewardValueShort", { value: money(reward.valueVnd) })}`
            : t("points", { n: format.number(reward.pointsCost) })
    const factsLine = (reward: (typeof board.rewards)[number]) => {
        const tier = reward.minTierKey ? findTier(board.config, reward.minTierKey) : null
        return [
            reward.stock === null ? t("stockUnlimited") : t("stockLeft", { n: reward.stock }),
            reward.perCustomerLimit === null ? t("limitNone") : t("limitPer", { n: reward.perCustomerLimit }),
            tier === null ? t("anyTier") : t("fromTier", { name: tier.name }),
        ].join(" · ")
    }
    const open = (id: string | null) => {
        form.reset(rewardValuesOf(board.rewards.find((reward) => reward.id === id) ?? null))
        setEditing({ id })
    }
    const submit = form.handleSubmit((values) => actions.save(rewardInputOf(values, target), () => setEditing(null)))
    return (
        <LoyaltyRewardsBase
            props={buildLoyaltyRewardsView({
                t,
                board,
                actions,
                kindLabel,
                costLine,
                factsLine,
                editing,
                target,
                form,
            })}
            on={{
                add: () => open(null),
                preset: actions.preset,
                edit: open,
                toggle: (id, active) => {
                    const reward = board.rewards.find((candidate) => candidate.id === id)
                    if (reward === undefined) return
                    actions.save(rewardToggleInputOf(reward, active), () => undefined)
                },
                confirmRemove: (id) => actions.remove(id, () => undefined),
                change: (field, value) =>
                    form.setValue(field, maskRewardField(field, value), { shouldValidate: form.formState.isSubmitted }),
                setActive: (active) => form.setValue("active", active),
                submit: () => void submit(),
                cancelForm: () => setEditing(null),
            }}
        />
    )
}

/** Inputs needed to build the LoyaltyRewardsContent section. */
interface BuildLoyaltyRewardsViewContext {
    readonly t: ReturnType<typeof useTranslations<"loyalty">>
    readonly board: typeof EMPTY_LOYALTY_BOARD
    readonly actions: ReturnType<typeof useLoyaltyRewardActions>
    readonly kindLabel: (reward: (typeof EMPTY_LOYALTY_BOARD)["rewards"][number]) => string
    readonly costLine: (reward: (typeof EMPTY_LOYALTY_BOARD)["rewards"][number]) => string
    readonly factsLine: (reward: (typeof EMPTY_LOYALTY_BOARD)["rewards"][number]) => string
    readonly editing: Editing | null
    readonly target: (typeof EMPTY_LOYALTY_BOARD)["rewards"][number] | null
    readonly form: ReturnType<typeof useLoyaltyRewardForm>
}
/** Builds the LoyaltyRewardsContent section from the current view. */
const buildLoyaltyRewardsView = ({
    t,
    board,
    actions,
    kindLabel,
    costLine,
    factsLine,
    editing,
    target,
    form,
}: BuildLoyaltyRewardsViewContext) =>
    ({
        title: t("rewardsTitle"),
        addLabel: t("rewardAdd"),
        canManage: board.canManage,
        isPending: actions.isPending,
        emptyTitle: t("rewardsEmptyTitle"),
        emptyBody: board.canManage ? t("rewardsEmptyBody") : t("rewardsEmptyBodyStaff"),
        presetLabel: t("presetButton"),
        readOnlyNote: t("readOnlyNote"),
        activeLabel: t("rewardActive"),
        editLabel: t("edit"),
        deleteLabel: t("delete"),
        askLabel: t("deleteAsk"),
        confirmLabel: t("deleteConfirm"),
        cancelLabel: t("cancel"),
        rows: board.rewards.map((reward) => ({
            id: reward.id,
            name: reward.name,
            kindLabel: kindLabel(reward),
            statusLabel: reward.active ? t("rewardOn") : t("rewardOff"),
            active: reward.active,
            cost: costLine(reward),
            facts: factsLine(reward),
            note: reward.note,
        })),
        ...(editing === null
            ? {}
            : {
                  form: {
                      heading: target === null ? t("rewardAdd") : t("rewardEditTitle"),
                      values: form.watch(),
                      isPending: actions.isPending,
                      nameError: form.formState.errors.name?.message,
                      costError: form.formState.errors.cost?.message,
                      kindOptions: REWARD_KINDS.map((kind) => ({ id: kind, label: t(`rewardKind_${kind}`) })),
                      tierOptions: [
                          { id: ANY_TIER, label: t("anyTier") },
                          ...board.config.tiers.map((tier) => ({ id: tier.key, label: tier.name })),
                      ],
                      noteMax: REWARD_NOTE_MAX,
                      nameLabel: t("rewardName"),
                      kindLabel: t("rewardKind"),
                      costLabel: t("rewardCost"),
                      valueLabel: t("rewardValue"),
                      valueHint: t("rewardValueHint"),
                      percentLabel: t("rewardPercent"),
                      stockLabel: t("rewardStock"),
                      stockHint: t("rewardStockHint"),
                      limitLabel: t("rewardLimit"),
                      limitHint: t("rewardLimitHint"),
                      minTierLabel: t("rewardMinTier"),
                      noteLabel: t("rewardNote"),
                      activeLabel: t("rewardActive"),
                      saveLabel: t("save"),
                      cancelLabel: t("cancel"),
                  },
              }),
    }) as const
