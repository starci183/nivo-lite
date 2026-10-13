"use client"

import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import {
    channelLabel,
    pad2,
    pillarBalance,
    shiftMonth,
    slotsForMonth,
    vietnamClock,
    useContentData,
} from "@/hooks/content"
import { ContentBalancePanelBase } from "./component"

const percent = (share: number): number => Math.round(share * 100)

/** The Balance tab: planned posts per theme against the weights, and per channel against the posting rhythm, for one month. */
export const ContentBalancePanel = () => {
    const data = useContentData()
    const t = useTranslations("content")
    const now = useMemo(() => new Date(data.nowIso), [data.nowIso])
    const [ym, setYm] = useState(() => {
        const here = vietnamClock(now)
        return { y: here.y, m: here.m }
    })
    const monthItems = data.items.filter((i) => {
        if (i.scheduled_at === null) return false
        const p = vietnamClock(new Date(i.scheduled_at))
        return p.y === ym.y && p.m === ym.m
    })
    const live = monthItems.filter((i) => i.status !== "skipped")
    const slots = slotsForMonth(ym.y, ym.m, data.cadence)
    return (
        <ContentBalancePanelBase
            props={{
                t,
                y: ym.y,
                m: ym.m,
                monthTitle: t("monthTitle", { m: pad2(ym.m), y: ym.y }),
                title: `${t("balanceTitle")} · ${t("balanceScope", { m: pad2(ym.m), y: ym.y })}`,
                themes:
                    live.length === 0
                        ? []
                        : pillarBalance(data.pillars, monthItems).map((row) => ({
                              id: row.pillarId ?? "none",
                              label: row.name || t("balanceNone"),
                              value: Math.min(100, percent(row.actualShare)),
                              max: 100,
                              valueLabel: t("balanceActual", { n: row.count, p: percent(row.actualShare) }),
                              target:
                                  row.targetShare > 0 ? t("balanceTarget", { p: percent(row.targetShare) }) : undefined,
                          })),
                channels: data.cadence
                    .filter((c) => c.posts_per_week > 0)
                    .map((c) => {
                        const want = slots.filter((s) => s.channel === c.channel).length
                        const have = live.filter((i) => i.channels.includes(c.channel)).length
                        const label = channelLabel(t, c.channel)
                        return {
                            id: c.channel,
                            label,
                            value: want > 0 ? Math.min(want, have) : 0,
                            max: Math.max(1, want),
                            valueLabel: t("cadenceRow", { channel: label, n: have, want }),
                            target: undefined,
                        }
                    }),
            }}
            on={{
                shift: (by) => setYm((cur) => shiftMonth(cur.y, cur.m, by)),
                today: () => {
                    const here = vietnamClock(now)
                    setYm({ y: here.y, m: here.m })
                },
            }}
        />
    )
}
