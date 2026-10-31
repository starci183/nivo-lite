"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { firstOpenTelegramStep, telegramStepsDone } from "./telegramConnection.shared"
import type { TelegramStepId } from "./telegramConnection.shared"
import { useTelegramChecks } from "./useTelegramChecks"
import { useTelegramPage } from "./useTelegramPage"

/**
 * The four setup steps of a Telegram bot connection in back end order (the bot and its token, the webhook NIVO registers, the check,
 * the agents): each says whether it is done, the first step not done opens on its own, and the reader opens or closes any step.
 */
export const useTelegramSteps = (connectionId: string) => {
    const t = useTranslations("telegramConnection")
    const { slot } = useTelegramPage(connectionId)
    const { lines } = useTelegramChecks(connectionId)
    const [toggled, setToggled] = useState<Readonly<Partial<Record<string, boolean>>>>({})
    const page = slot.items
    const count = page?.agentIds.length ?? 0
    const done = telegramStepsDone({ healthy: page?.healthy ?? false, agentCount: count })
    const opensOn = page === undefined ? null : firstOpenTelegramStep(done)
    const checkLines = lines.items ?? []
    const handle = page === undefined || page.botUsername === "" ? "-" : `@${page.botUsername}`
    const wording = {
        bot: { title: t("stepBot"), hint: t("stepBotHint"), summary: t("stepBotDone", { handle }) },
        webhook: {
            title: t("stepWebhook"),
            hint: t("stepWebhookHint"),
            summary: page?.healthy === true ? t("stepWebhookDone") : t("stepTodo"),
        },
        check: {
            title: t("stepCheck"),
            hint: t("stepCheckHint"),
            summary: t("stepCheckCount", {
                ok: checkLines.filter((line) => line.badge.tone === "success").length,
                total: checkLines.length,
            }),
        },
        agents: {
            title: t("stepAgents"),
            hint: t("stepAgentsHint"),
            summary: count > 0 ? t("stepAgentsDone", { count }) : t("stepAgentsTodo"),
        },
    } as const satisfies Readonly<
        Record<TelegramStepId, { readonly title: string; readonly hint: string; readonly summary: string }>
    >
    const steps = done.map(([id]) => ({
        id,
        title: wording[id].title,
        hint: wording[id].hint,
        summary: page === undefined ? "" : wording[id].summary,
        isOpen: toggled[id] ?? id === opensOn,
    }))
    return { steps, toggle: (id: string, isOpen: boolean) => setToggled((current) => ({ ...current, [id]: isOpen })) }
}
