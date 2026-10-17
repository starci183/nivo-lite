"use client"

import { useFormatter, useTranslations } from "next-intl"
import { digitsOnly } from "@/hooks/loyalty"
import { errorKeyOf, usePublicLoyalty } from "@/hooks/publicLoyalty"
import { useQueryPublicLoyaltyPageSwr } from "@/hooks/swr"
import { LoyaltyCheckFormBase } from "./component"
import type { LoyaltyCheckResult } from "./component"

/** What the page hands the connected check form. */
interface LoyaltyCheckFormProps {
    readonly slug: string
}

/** The connected public points check: the shop comes from `publicLoyaltyPage`, the code is requested and verified through the anonymous GraphQL client. */
export const LoyaltyCheckForm = (props: LoyaltyCheckFormProps) => {
    const t = useTranslations("loyaltyPublic")
    const format = useFormatter()
    const page = useQueryPublicLoyaltyPageSwr({ slug: props.slug })
    const check = usePublicLoyalty(props.slug)
    const money = (value: number) =>
        format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 })

    let status: "loading" | "missing" | "ready" = "ready"
    if (page.error !== undefined) status = "missing"
    else if (page.data === undefined) status = "loading"

    let result: LoyaltyCheckResult | undefined
    const { points } = check
    if (check.step === "result" && points !== null) {
        const firstAt = points.expiring.firstAt
        result = buildLoyaltyAccountView({ t, points, format, money, firstAt })
    }

    return (
        <LoyaltyCheckFormBase
            props={{
                status,
                step: check.step,
                title: t("title"),
                lead: t("lead", { shop: page.data?.shop ?? "" }),
                unavailable: t("unavailable"),
                loadingText: t("busy"),
                phone: {
                    label: t("phoneLabel"),
                    placeholder: t("phonePlaceholder"),
                    value: check.phone,
                    send: t("sendCode"),
                },
                code: {
                    label: t("codeLabel"),
                    value: check.code,
                    check: t("check"),
                    sentTitle: t("sentTitle"),
                    sentBody: t("sentBody"),
                    resend: t("resend"),
                },
                back: t("back"),
                isBusy: check.isBusy,
                ...(check.failure === null ? {} : { error: t(errorKeyOf(check.failure)) }),
                ...(result === undefined ? {} : { result }),
            }}
            on={{
                setPhone: check.setPhone,
                setCode: (value) => check.setCode(digitsOnly(value, 6)),
                sendCode: () => void check.sendCode(),
                check: () => void check.check(),
                back: check.back,
            }}
        />
    )
}

/** Inputs needed to build the LoyaltyCheckFormContent section. */
interface BuildLoyaltyAccountViewContext {
    readonly t: ReturnType<typeof useTranslations<"loyaltyPublic">>
    readonly points: NonNullable<ReturnType<typeof usePublicLoyalty>["points"]>
    readonly format: ReturnType<typeof useFormatter>
    readonly money: (value: number) => string
    readonly firstAt: string | null
}
/** Builds the LoyaltyCheckFormContent section from the current view. */
const buildLoyaltyAccountView = ({ t, points, format, money, firstAt }: BuildLoyaltyAccountViewContext) =>
    ({
        greeting: t("hello", { name: points.name }),
        tierLabel: t("tier"),
        tierName: points.tierName === "" ? t("noTier") : points.tierName,
        pointsLabel: t("points"),
        points: format.number(points.points),
        ...(points.nextTier === null || points.nextTier === undefined
            ? {}
            : {
                  nextTier: t("nextTier", {
                      amount: money(points.nextTier.missingVnd),
                      tier: points.nextTier.tier.name,
                  }),
              }),
        ...(points.expiring.points > 0 && firstAt !== null && firstAt !== undefined
            ? {
                  expiring: t("expiring", {
                      points: format.number(points.expiring.points),
                      date: format.dateTime(new Date(firstAt), {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                      }),
                  }),
              }
            : {}),
        rewardsTitle: t("rewardsTitle"),
        noRewards: t("noRewards"),
        redeemHint: t("redeemHint"),
        rewards: points.rewards.map((reward) => ({
            id: reward.name,
            name: reward.name,
            detail: [`${format.number(reward.pointsCost)} ${t("pointsUnit")}`, reward.note]
                .filter((part) => part !== "")
                .join(" · "),
            badge: t(reward.canRedeem ? "canRedeem" : "needMore"),
            canRedeem: reward.canRedeem,
        })),
    }) as const
