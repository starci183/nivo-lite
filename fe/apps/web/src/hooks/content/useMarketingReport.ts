"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"
import { useMutatePostMarketingWeeklyReportSwr, useQueryMarketingWeeklyReportSwr } from "@/hooks/swr"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { MARKETING_REPORT_PLACEHOLDER, marketingReportView, type MarketingReportSay } from "@/modules/content"
import { useGraphQLWithToast } from "@/modules/toast"

const ZONE = "Asia/Ho_Chi_Minh"

const dayOf = (iso: string) => new Date(`${iso}T00:00:00+07:00`)

/** The weekly marketing report of the Performance tab, and the command that posts it into the Marketing room of the Hub. */
export const useMarketingReport = () => {
    const t = useTranslations("marketing")
    const format = useFormatter()
    const runGraphQL = useGraphQLWithToast()
    const read = useQueryMarketingWeeklyReportSwr("")
    const post = useMutatePostMarketingWeeklyReportSwr()
    const say = useMemo(
        (): MarketingReportSay => ({
            number: (value) => format.number(value),
            day: (iso) =>
                format.dateTime(dayOf(iso), { weekday: "short", day: "2-digit", month: "2-digit", timeZone: ZONE }),
            period: (start, end) =>
                t("period", {
                    start: format.dateTime(dayOf(start), { day: "2-digit", month: "2-digit", timeZone: ZONE }),
                    end: format.dateTime(dayOf(end), {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        timeZone: ZONE,
                    }),
                }),
            channel: (channel) => {
                if (channel === "facebook") return t("channelFacebook")
                if (channel === "zalo") return t("channelZalo")
                return channel
            },
            change: (pct) => (pct === null ? t("changeNone") : t("changePct", { sign: pct > 0 ? "+" : "", pct })),
            kpi: { reach: t("kpiReach"), engagements: t("kpiEngagements"), messages: t("kpiMessages") },
            insight: (channel, share, day, count) => t("insight", { channel, share, day, count }),
        }),
        [format, t],
    )
    const send = async () => {
        const posted = await runGraphQL(() => post.trigger(), { successMessage: t("postDone") })
        if (posted !== undefined) await read.mutate(posted, { revalidate: false })
    }
    return {
        placeholder: MARKETING_REPORT_PLACEHOLDER,
        slot: mapSlot(slotOfSwr(read), (report) => marketingReportView(say, report)),
        reload: () => void read.mutate(),
        isPosting: post.isMutating,
        send,
    }
}
