"use client"

import { useFormatter, useTranslations } from "next-intl"
import { tierTone } from "@/hooks/loyalty"
import type { LoyaltyBoardType } from "@/modules/api"
import { useQueryLoyaltyMemberSwr } from "@/hooks/swr"
import { groupPhone } from "./loyaltyMembers.shared"
import { useMemberActions } from "./useMemberActions"
import { useMemberDetailForms } from "./useMemberDetailForms"
import { useMemberDetailLists } from "./useMemberDetailLists"

const TIME_ZONE = "Asia/Ho_Chi_Minh"

/** Loads the picked member and answers everything the member panel draws: a loading line, a failure, or the member with its forms, rewards and history. */
export const useMemberDetailView = (board: LoyaltyBoardType, customerId: string | null) => {
    const t = useTranslations("loyalty")
    const format = useFormatter()
    const { data, error } = useQueryLoyaltyMemberSwr(customerId === null ? null : { customerId })
    const actions = useMemberActions(customerId ?? "")
    const forms = useMemberDetailForms({
        memberId: customerId ?? "",
        member: data?.member,
        canManage: board.canManage,
        actions,
    })
    const lists = useMemberDetailLists(data, actions)
    const money = (value: number) =>
        format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const points = (value: number) => t("points", { n: format.number(value) })
    const date = (iso: string) =>
        format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TIME_ZONE })
    const clear = () => {
        actions.clear()
        forms.reset()
    }
    if (data === undefined) {
        const state =
            error === undefined
                ? { loading: { text: t("loading") } }
                : {
                      failed: {
                          title: t("detailFailed"),
                          text: error instanceof Error ? error.message : t("loadFailedBody"),
                      },
                  }
        return { ...state, clear }
    }
    const { member, expiring, nextTier } = data
    const firstExpiry = expiring.firstAt
    const view = {
        name: member.name,
        closeLabel: t("close"),
        ...(data.tierName === ""
            ? {}
            : { tier: { name: data.tierName, tone: tierTone(board.config, member.tierKey ?? null) } }),
        points: points(member.points),
        contact:
            [groupPhone(member.phone), member.email ?? ""].filter((part) => part !== "").join(" · ") || t("noPhone"),
        spentLine: `${t("spentTotal", { value: money(member.lifetimeSpendVnd) })} · ${t("visitsCount", { n: member.visits })}`,
        joinedLine: t("joinedAt", { date: date(member.joinedAt) }),
        nextTierLine:
            nextTier === null || nextTier === undefined
                ? t("topTier")
                : t("nextTier", { name: nextTier.tier.name, value: money(nextTier.missingVnd) }),
        ...(expiring.points > 0
            ? {
                  expiringLine: t("expiringSoon", {
                      points: points(expiring.points),
                      date: firstExpiry === null || firstExpiry === undefined ? "" : date(firstExpiry),
                  }),
              }
            : {}),
        editTitle: t("editTitle"),
        ...(forms.edit === undefined ? {} : { edit: forms.edit }),
        ...(forms.readOnly === undefined ? {} : { readOnly: forms.readOnly }),
        adjustTitle: t("adjustTitle"),
        adjustBody: t("adjustBody"),
        adjust: forms.adjust,
        rewards: lists.rewards,
        ledger: lists.ledger,
        asOf: t("asOf", {
            date: format.dateTime(new Date(board.nowIso), {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: TIME_ZONE,
            }),
        }),
    }
    return { view, clear }
}
