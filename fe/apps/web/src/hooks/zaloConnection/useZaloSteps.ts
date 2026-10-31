"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import type { ZaloStepId } from "@/modules/types"
import { firstOpenStep, zaloStepsDone } from "./zaloConnection.shared"
import { useZaloPage } from "./useZaloPage"
import type { ZaloPageData } from "./useZaloPage"

/** One setup step as the page draws its head: done or not, the one-line summary beside its title, and whether it is open. */
export interface ZaloStepState {
    readonly id: ZaloStepId
    readonly isDone: boolean
    readonly summary: string
    readonly isOpen: boolean
}

/**
 * The five setup steps of a Zalo OA connection in back end order (app keys, the Zalo app set up, the OA authorized, the checks, the
 * agents): each says whether it is done, the first step not done opens on its own, and the owner opens or closes any step.
 */
export const useZaloSteps = (connectionId: string) => {
    const t = useTranslations("zaloConnection")
    const { slot } = useZaloPage(connectionId)
    const [toggled, setToggled] = useState<Readonly<Partial<Record<ZaloStepId, boolean>>>>({})
    const page = slot.items
    const done = zaloStepsDone({
        appId: page?.appId ?? "",
        appSecretMask: page?.appSecretMask ?? null,
        oaSecretMask: page?.oaSecretMask ?? null,
        tokenState: page?.access.state ?? "none",
        healthy: page?.healthy ?? false,
        agentCount: page?.agentIds.length ?? 0,
    })
    const opensOn = page === undefined ? null : firstOpenStep(done)
    const summaryOf = (id: ZaloStepId, isDone: boolean, data: ZaloPageData): string => {
        switch (id) {
            case "app":
                return isDone ? t("stepAppDone", { appId: data.appId }) : t("stepTodo")
            case "paste":
                return isDone ? t("stepPasteDone") : t("stepTodo")
            case "authorize":
                if (isDone) return t("stepAuthorizeDone")
                return data.access.state === "expired" ? t("stepAuthorizeExpired") : t("stepTodo")
            case "check":
                return t("stepCheckCount", {
                    ok: data.checks.filter((check) => check.state === "ok").length,
                    total: data.checks.length,
                })
            case "agents":
                return isDone ? t("stepAgentsDone", { count: data.agentIds.length }) : t("stepAgentsTodo")
        }
    }
    const steps: ReadonlyArray<ZaloStepState> = done.map(([id, isDone]) => ({
        id,
        isDone,
        summary: page === undefined ? "" : summaryOf(id, isDone, page),
        isOpen: toggled[id] ?? id === opensOn,
    }))
    return {
        steps,
        isSkeleton: page === undefined,
        toggle: (id: ZaloStepId, isOpen: boolean) => setToggled((current) => ({ ...current, [id]: isOpen })),
    }
}
