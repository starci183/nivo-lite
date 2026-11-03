"use client"
import type { ContentViews, ContentActions, ContentBalanceFields, ContentBalanceActions } from "@/modules/types"

import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { pad2, shiftMonth, slotsForMonth, vietnamClock } from "@/hooks/content"
import { useFeatureReset } from "@/hooks/reuseables"
import { balanceChannelsOf, balanceThemesOf } from "@/modules/content"
import type { ContentViewInput } from "./contentWorkbench.shared"

/** The view `useContentBalancePanelView` returns. */
export interface ContentBalancePanelView {
    props: ContentBalanceFields | undefined
    on: ContentBalanceActions
    loading: {
        y: number
        m: number
        monthTitle: string
        title: string
    }
}

/** Owns the actual ContentBalancePanel data derivations and conditional controller lifetime. */
export const useContentBalancePanelView = (input: ContentViewInput): ContentBalancePanelView => {
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
                  themes: balanceThemesOf(t, data.pillars, monthItems, live),
                  channels: balanceChannelsOf(t, data.cadence, slots, live),
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
