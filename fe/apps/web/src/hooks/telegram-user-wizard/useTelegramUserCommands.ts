"use client"

import { useCallback, useMemo } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { useConnectionsRefresh } from "@/hooks/connections"
import {
    useMutateCancelTelegramLoginSwr,
    useMutateResendTelegramCodeSwr,
    useMutateSaveTelegramUserSetupSwr,
    useMutateStartTelegramLoginSwr,
    useMutateSubmitTelegramCodeSwr,
    useMutateSubmitTelegramPasswordSwr,
} from "@/hooks/swr"
import type { PickedChat, SinceDays } from "./telegram-user-wizard.shared"

/** What starting a login takes. */
export interface StartLoginForm {
    readonly name: string
    readonly phone: string
    readonly consent: boolean
    readonly connectionId: string | null
}

/** What saving the setup takes. */
export interface SaveSetupForm {
    readonly connectionId: string
    readonly chats: ReadonlyArray<PickedChat>
    readonly sinceDays: SinceDays
    readonly everyMinutes: number | null
}

/** The GraphQL commands of the personal Telegram wizard (the active workspace travels in the request header). */
export interface TelegramUserCommands {
    readonly start: (form: StartLoginForm) => Promise<Settled<{ connectionId: string; viaApp: boolean }>>
    readonly resend: (connectionId: string) => Promise<Settled<boolean>>
    readonly submitCode: (connectionId: string, code: string) => Promise<Settled<{ stage: string }>>
    readonly submitPassword: (connectionId: string, password: string) => Promise<Settled<{ stage: string }>>
    readonly cancel: (connectionId: string) => Promise<Settled<boolean>>
    readonly save: (form: SaveSetupForm) => Promise<Settled<boolean>>
}

/** The Telegram wizard's mutations bound to the toast helper; a started, saved or cancelled connection refreshes the list. */
export const useTelegramUserCommands = (): TelegramUserCommands => {
    const settle = useSettledGraphQL()
    const refresh = useConnectionsRefresh()
    const { trigger: triggerStart } = useMutateStartTelegramLoginSwr()
    const { trigger: triggerResend } = useMutateResendTelegramCodeSwr()
    const { trigger: triggerCode } = useMutateSubmitTelegramCodeSwr()
    const { trigger: triggerPassword } = useMutateSubmitTelegramPasswordSwr()
    const { trigger: triggerCancel } = useMutateCancelTelegramLoginSwr()
    const { trigger: triggerSave } = useMutateSaveTelegramUserSetupSwr()
    const refreshed = useCallback(
        async <T>(settled: Settled<T>): Promise<Settled<T>> => {
            if (settled.kind === "ok") await refresh()
            return settled
        },
        [refresh],
    )
    return useMemo(
        () => ({
            start: async (form) => refreshed(await settle(() => triggerStart(form))),
            resend: (connectionId) => settle(() => triggerResend({ connectionId })),
            submitCode: (connectionId, code) => settle(() => triggerCode({ connectionId, code })),
            submitPassword: (connectionId, password) => settle(() => triggerPassword({ connectionId, password })),
            cancel: async (connectionId) => refreshed(await settle(() => triggerCancel({ connectionId }))),
            save: async (form) =>
                refreshed(
                    await settle(() =>
                        triggerSave({
                            connectionId: form.connectionId,
                            chats: form.chats.map((chat) => ({ id: chat.id, title: chat.title, kind: chat.kind })),
                            sinceDays: form.sinceDays,
                            everyMinutes: form.everyMinutes,
                        }),
                    ),
                ),
        }),
        [settle, refreshed, triggerStart, triggerResend, triggerCode, triggerPassword, triggerCancel, triggerSave],
    )
}
