"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    QUERY_PROVIDER_RIGHTS_SWR_KEY,
    QUERY_SANDBOX_ACCOUNTS_SWR_KEY,
    QUERY_SANDBOX_CALLS_SWR_KEY,
    QUERY_SANDBOX_LATEST_REQUEST_SWR_KEY,
    QUERY_SANDBOX_NEXT_CASES_SWR_KEY,
    useMutateOpenSandboxAccountSwr,
    useMutateResetSandboxAccountSwr,
} from "@/hooks/swr"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { refreshSandbox } from "./sandbox.shared"

/** The commands on an account as a whole: open it, clear what it holds, copy its key. */
export interface SandboxAccountCommands {
    /** Opens a sandbox account; answers its id, or undefined when it failed (a refusal was toasted with the back end words). */
    readonly open: (input: {
        readonly provider: string
        readonly name: string
        /** The agents the account is given to at once. */
        readonly attachTo: ReadonlyArray<string>
    }) => Promise<string | undefined>
    /** Clears the call log and the state of an account; answers whether it worked. */
    readonly clear: (connectionId: string) => Promise<boolean>
    /** Puts the key on the clipboard. */
    readonly copy: (text: string) => Promise<void>
    readonly isOpening: boolean
    readonly isClearing: boolean
    readonly isCopying: boolean
}

/** Opens and clears sandbox accounts and copies their key through the back end, toasted in plain words, refreshing what they changed. */
export const useSandboxAccountCommands = (): SandboxAccountCommands => {
    const t = useTranslations("sandbox")
    const run = useGraphQLWithToast()
    const opening = useMutateOpenSandboxAccountSwr()
    const clearing = useMutateResetSandboxAccountSwr()
    const [isCopying, setIsCopying] = useState(false)
    return {
        open: async (input) => {
            const answer = await run(() => opening.trigger({ ...input, attachTo: [...input.attachTo] }), { successMessage: t("toastOpened") })
            if (answer === undefined) return undefined
            await refreshSandbox(QUERY_SANDBOX_ACCOUNTS_SWR_KEY, QUERY_PROVIDER_RIGHTS_SWR_KEY)
            return answer.id
        },
        clear: async (connectionId) => {
            const answer = await run(() => clearing.trigger({ connectionId }), { successMessage: t("toastCleared") })
            if (answer === undefined) return false
            await refreshSandbox(
                QUERY_SANDBOX_CALLS_SWR_KEY,
                QUERY_SANDBOX_LATEST_REQUEST_SWR_KEY,
                QUERY_SANDBOX_NEXT_CASES_SWR_KEY,
            )
            return true
        },
        copy: async (text) => {
            setIsCopying(true)
            try {
                await navigator.clipboard.writeText(text)
                toast.success(t("toastKeyCopied"))
            } catch {
                toast.danger(t("toastKeyCopyFailed"))
            } finally {
                setIsCopying(false)
            }
        },
        isOpening: opening.isMutating,
        isClearing: clearing.isMutating,
        isCopying,
    }
}
