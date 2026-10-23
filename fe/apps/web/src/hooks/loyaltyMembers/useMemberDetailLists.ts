"use client"

import { useFormatter, useTranslations } from "next-intl"
import type { useQueryLoyaltyMemberSwr } from "@/hooks/swr"
import { blockMessageKey, isLedgerKind, ledgerTone } from "./loyaltyMembers.shared"
import type { useMemberActions } from "./useMemberActions"

/** The member detail as the back end answers it. */
type MemberDetail = NonNullable<ReturnType<typeof useQueryLoyaltyMemberSwr>["data"]>

/** One reward option as the back end answers it. */
type RewardOption = MemberDetail["rewards"][number]

/** The redeemable rewards and the points history of one member, ready for the composites that draw them. */
export const useMemberDetailLists = (
    detail: MemberDetail | undefined,
    actions: ReturnType<typeof useMemberActions>,
) => {
    const t = useTranslations("loyalty")
    const format = useFormatter()
    const money = (value: number) =>
        format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const points = (value: number) => t("points", { n: format.number(value) })
    const blockText = (block: NonNullable<RewardOption["block"]>) =>
        t(
            blockMessageKey(block.code),
            Object.fromEntries(
                block.params.map((param) => [
                    param.key,
                    param.value.trim() !== "" && Number.isFinite(Number(param.value))
                        ? format.number(Number(param.value))
                        : param.value,
                ]),
            ),
        )
    const rewards = {
        title: t("redeemTitle"),
        emptyText: t("redeemEmpty"),
        redeemLabel: t("redeemButton"),
        rows: (detail?.rewards ?? []).map((option) => ({
            id: option.reward.id,
            name: option.reward.name,
            cost:
                option.reward.valueVnd > 0
                    ? `${points(option.reward.pointsCost)} · ${money(option.reward.valueVnd)}`
                    : points(option.reward.pointsCost),
            ...(option.block === null ? {} : { blocked: blockText(option.block) }),
            ...(actions.redeemNote !== null && actions.redeemNote.id === option.reward.id
                ? { note: actions.redeemNote.text }
                : {}),
        })),
        busyId: actions.busyReward,
        onRedeem: actions.redeem,
    }
    const ledger = {
        title: t("ledgerTitle"),
        emptyText: t("ledgerEmpty"),
        rows: (detail?.ledger ?? []).map((row) => ({
            id: row.id,
            kind: isLedgerKind(row.kind) ? t(`kind_${row.kind}`) : row.kind,
            tone: ledgerTone(row.kind),
            points: t("points", { n: format.number(row.points, { signDisplay: "exceptZero" }) }),
            ...(row.amountVnd === null || row.amountVnd === 0 ? {} : { amount: money(row.amountVnd) }),
            dateTime: row.occurredAt,
            timeLabel: `${format.dateTime(new Date(row.occurredAt), {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Ho_Chi_Minh",
            })} · ${t("ledgerBy", { who: row.by === "" ? "-" : row.by })}`,
            ...(row.ref === "" ? {} : { ref: row.ref }),
            ...(row.evidence === null || row.evidence === ""
                ? {}
                : { evidence: t("ledgerEvidence", { text: row.evidence }) }),
        })),
    }
    return { rewards, ledger }
}
