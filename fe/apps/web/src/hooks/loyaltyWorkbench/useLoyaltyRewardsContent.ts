import { useFormatter, useTranslations } from "next-intl"
import { findTier, type EMPTY_LOYALTY_BOARD } from "@/hooks/loyalty"
import { ANY_TIER, REWARD_KINDS, REWARD_NOTE_MAX, type useLoyaltyRewardActions } from "@/hooks/loyaltyRewards"
import type { useLoyaltyRewardForm } from "@/hooks/rhf"
import type { RewardFormValues } from "@/modules/types"

/** Which reward the form edits: a reward id, or null for a new one. */
export interface LoyaltyRewardEditing {
    readonly id: string | null
}

/** The rows and the section copy of the rewards tab, as the builder draws them. */
export interface LoyaltyRewardsBuilt {
    rows: {
        id: string
        name: string
        kindLabel: string
        statusLabel: string
        active: boolean
        cost: string
        facts: string
        note: string
    }[]
    form?: {
        heading: string
        values: RewardFormValues
        isPending: boolean
        nameError: string | undefined
        costError: string | undefined
        kindOptions: {
            id: string
            label: string
        }[]
        tierOptions: {
            id: string
            label: string
        }[]
        noteMax: number
        nameLabel: string
        kindLabel: string
        costLabel: string
        valueLabel: string
        valueHint: string
        percentLabel: string
        stockLabel: string
        stockHint: string
        limitLabel: string
        limitHint: string
        minTierLabel: string
        noteLabel: string
        activeLabel: string
        saveLabel: string
        cancelLabel: string
    }
    title: string
    addLabel: string
    canManage: boolean
    isPending: boolean
    emptyTitle: string
    emptyBody: string
    presetLabel: string
    readOnlyNote: string
    activeLabel: string
    editLabel: string
    deleteLabel: string
    askLabel: string
    confirmLabel: string
    cancelLabel: string
}

/** Inputs needed to build the LoyaltyRewardsContent section. */
export interface BuildLoyaltyRewardsViewContext {
    readonly board: typeof EMPTY_LOYALTY_BOARD
    readonly actions: ReturnType<typeof useLoyaltyRewardActions>
    readonly editing: LoyaltyRewardEditing | null
    readonly target: (typeof EMPTY_LOYALTY_BOARD)["rewards"][number] | null
    readonly form: ReturnType<typeof useLoyaltyRewardForm>
}

/** Draws the rewards section: the labels, the rows and, while a reward is edited, its form. */
export const useLoyaltyRewardsContent = ({
    board,
    actions,
    editing,
    target,
    form,
}: BuildLoyaltyRewardsViewContext): LoyaltyRewardsBuilt => {
    const t = useTranslations("loyalty")
    const format = useFormatter()
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
    return {
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
    }
}
