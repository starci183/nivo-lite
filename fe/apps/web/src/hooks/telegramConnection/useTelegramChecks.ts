"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { connectionErrorOf, useSettledGraphQL } from "@/hooks/connection-wizard"
import { connectionCheckOf } from "@/hooks/connection-wire"
import { mapSlot } from "@/hooks/slot"
import { useMutateCheckTelegramConnectionSwr } from "@/hooks/swr"
import type { ConnectionCheck, ConnectionLineView, DataSlot } from "@/modules/types"
import { TOKEN_REJECTED_CODE, WEBHOOK_REFUSED_CODE } from "./telegramConnection.shared"
import { useTelegramPage } from "./useTelegramPage"
import type { TelegramPageData } from "./useTelegramPage"

type Verdict = Pick<ConnectionLineView, "badge">

/** The badge of a check line: a dot, the verdict word and its tone. */
const verdictOf = (label: string, tone: "success" | "danger" | "warning"): Verdict => ({
    badge: { label, tone, isDot: true },
})

/**
 * The check list (token, webhook, last error) and the check run again. The page alone says whether the bot works; Telegram's own word
 * on the webhook (and how many messages it holds back) comes from a check, which the owner or manager runs and the page keeps.
 */
export const useTelegramChecks = (connectionId: string | undefined) => {
    const t = useTranslations("telegramConnection")
    const tc = useTranslations("connections")
    const settle = useSettledGraphQL()
    const { slot, mutate } = useTelegramPage(connectionId)
    const { data, trigger, isMutating } = useMutateCheckTelegramConnectionSwr(connectionId)
    const check = data === undefined ? undefined : connectionCheckOf(data)

    const ok = (): Verdict => verdictOf(t("markOk"), "success")
    const fail = (): Verdict => verdictOf(t("markFail"), "danger")
    const warn = (): Verdict => verdictOf(t("markWarn"), "warning")

    const tokenLine = (page: TelegramPageData): ConnectionLineView => {
        const handle = page.botUsername === "" ? "-" : `@${page.botUsername}`
        const rejected = page.lastError === TOKEN_REJECTED_CODE
        return {
            id: "token",
            title: t("checkToken"),
            description: rejected ? t("detailTokenRejected") : t("detailTokenOk", { handle }),
            ...(rejected ? fail() : ok()),
        }
    }

    const webhookLine = (page: TelegramPageData, checked: ConnectionCheck | undefined): ConnectionLineView => {
        const line = (description: string, outcome: Verdict): ConnectionLineView => ({
            id: "webhook",
            title: t("checkWebhook"),
            description,
            ...outcome,
        })
        if (checked?.localOnly === true) return line(t("detailWebhookLocal"), warn())
        if (checked !== undefined) {
            return checked.webhookOk
                ? line(t("detailWebhookOk", { pending: checked.pending }), ok())
                : line(t("detailWebhookMissing"), fail())
        }
        if (page.lastError === WEBHOOK_REFUSED_CODE) return line(t("detailWebhookRefused"), fail())
        return page.healthy ? line(t("detailWebhookRegistered"), ok()) : line(t("detailWebhookUnchecked"), warn())
    }

    const errorLine = (page: TelegramPageData, checked: ConnectionCheck | undefined): ConnectionLineView => {
        const error = checked === undefined ? page.lastError : checked.lastError
        return {
            id: "error",
            title: t("checkLastError"),
            description:
                error === null ? t("detailNoError") : t("detailLastError", { error: connectionErrorOf(error, tc) }),
            ...(error === null ? ok() : fail()),
        }
    }

    const lines: DataSlot<ReadonlyArray<ConnectionLineView>> = mapSlot(slot, (page) => [
        tokenLine(page),
        webhookLine(page, check),
        errorLine(page, check),
    ])

    const recheck = useCallback(async (): Promise<void> => {
        const result = await settle(() => trigger(), t("toastRechecked"))
        if (result.kind === "ok") await mutate()
    }, [settle, trigger, t, mutate])

    return { lines, recheck, isRechecking: isMutating }
}
