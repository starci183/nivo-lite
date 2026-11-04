import { useFormatter, useTranslations } from "next-intl"
import { tierTone } from "@/hooks/loyalty"
import type { useQueryLoyaltyMemberSwr, LoyaltyBoardType } from "@/hooks/swr"
import { groupPhone } from "./loyaltyMembers.shared"
import type { BadgeTone } from "@starci/grammar/common"
import type { MemberDetailFormsView, useMemberDetailForms } from "./useMemberDetailForms"
import type { useMemberDetailLists } from "./useMemberDetailLists"

const TIME_ZONE = "Asia/Ho_Chi_Minh"
type MemberDetail = NonNullable<ReturnType<typeof useQueryLoyaltyMemberSwr>["data"]>

interface MemberWords {
    readonly board: LoyaltyBoardType
    readonly forms: ReturnType<typeof useMemberDetailForms>
    readonly lists: ReturnType<typeof useMemberDetailLists>
}

/** The atoms of the member page: identity lines, the two forms' fields and the reward and ledger lists. */
interface MemberAtoms {
    name: string
    closeLabel: string
    tier?: { name: string; tone: BadgeTone }
    points: string
    contact: string
    spentLine: string
    joinedLine: string
    nextTierLine: string
    expiringLine?: string
    editTitle: string
    edit?: NonNullable<MemberDetailFormsView["edit"]>
    readOnly?: NonNullable<MemberDetailFormsView["readOnly"]>
    adjustTitle: string
    adjustBody: string
    adjust: MemberDetailFormsView["adjust"]
    rewards: ReturnType<typeof useMemberDetailLists>["rewards"]
    ledger: ReturnType<typeof useMemberDetailLists>["ledger"]
    asOf: string
}

/** Resolves member atoms; an unresolved record supplies copy and empty values, never a ready slot. */
export const useMemberDetailAtoms = (data: MemberDetail | undefined, words: MemberWords): MemberAtoms => {
    const { board, forms, lists } = words
    const t = useTranslations("loyalty")
    const format = useFormatter()
    const member = data?.member
    const money = (value: number) =>
        format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const points = (value: number) => t("points", { n: format.number(value) })
    const date = (iso: string) =>
        format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TIME_ZONE })
    return {
        name: member?.name ?? "",
        closeLabel: t("close"),
        ...(data === undefined || data.tierName === ""
            ? {}
            : { tier: { name: data.tierName, tone: tierTone(board.config, member?.tierKey ?? null) } }),
        points: points(member?.points ?? 0),
        contact:
            [groupPhone(member?.phone), member?.email ?? ""].filter((part) => part !== "").join(" · ") || t("noPhone"),
        spentLine: `${t("spentTotal", { value: money(member?.lifetimeSpendVnd ?? 0) })} · ${t("visitsCount", { n: member?.visits ?? 0 })}`,
        joinedLine: member === undefined ? "" : t("joinedAt", { date: date(member.joinedAt) }),
        nextTierLine:
            data?.nextTier === undefined || data.nextTier === null
                ? t("topTier")
                : t("nextTier", { name: data.nextTier.tier.name, value: money(data.nextTier.missingVnd) }),
        ...(data !== undefined && data.expiring.points > 0
            ? {
                  expiringLine: t("expiringSoon", {
                      points: points(data.expiring.points),
                      date: data.expiring.firstAt === null ? "" : date(data.expiring.firstAt),
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
}
