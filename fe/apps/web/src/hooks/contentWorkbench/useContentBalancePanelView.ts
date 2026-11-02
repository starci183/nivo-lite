"use client"
import type { ContentViews, ContentActions } from "@/modules/types"

import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { channelLabel, pad2, pillarBalance, shiftMonth, slotsForMonth, vietnamClock } from "@/hooks/content"
import { useFeatureReset } from "@/hooks/reuseables"
import type { ContentViewInput } from "./contentWorkbench.shared"

const percent = (share: number): number => Math.round(share * 100)
/** Owns the actual ContentBalancePanel data derivations and conditional controller lifetime. */
export const useContentBalancePanelView = (input: ContentViewInput) => {
    const data = input.data
    const t = useTranslations("content")
    const now = useMemo(() => new Date(data?.nowIso ?? input.startedAt), [data?.nowIso, input.startedAt])
    const [ym, setYm] = useState(() => {
        const here = vietnamClock(now)
        return { y: here.y, m: here.m }
    })
    const monthItems = (data?.items ?? []).filter((i) => {
        if (i.scheduled_at === null) return false
        const p = vietnamClock(new Date(i.scheduled_at))
        return p.y === ym.y && p.m === ym.m
    })
    const live = monthItems.filter((i) => i.status !== "skipped")
    const slots = slotsForMonth(ym.y, ym.m, data?.cadence ?? [])

    useFeatureReset({
        isActive: input.isActive,
        isReady: input.isReady,
        scope: input.scope,
        onReset: () => {
            const here = vietnamClock(now)
            setYm({ y: here.y, m: here.m })
        },
    })

    const props: ContentViews["balanceFields"] | undefined =
        data === undefined
            ? undefined
            : {
                  copy: input.copy,
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
                                    row.targetShare > 0
                                        ? t("balanceTarget", { p: percent(row.targetShare) })
                                        : undefined,
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
              }
    const on: ContentActions["balanceActions"] = {
        shift: (by) => setYm((cur) => shiftMonth(cur.y, cur.m, by)),
        today: () => {
            const here = vietnamClock(now)
            setYm({ y: here.y, m: here.m })
        },
    }
    return {
        props,
        on,
        loading: {
            y: ym.y,
            m: ym.m,
            monthTitle: t("monthTitle", { m: pad2(ym.m), y: ym.y }),
            title: `${t("balanceTitle")} · ${t("balanceScope", { m: pad2(ym.m), y: ym.y })}`,
        },
    }
}
