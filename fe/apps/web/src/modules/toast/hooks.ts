"use client"

// React hooks that wrap the pure toast helpers (./api) and inject localized copy through next-intl. Components and hooks use
// these instead of importing `run*WithToast` directly, so every toast message is localized.
import { useTranslations } from "next-intl"
import { useCallback, useMemo } from "react"
import { runGraphQLWithToast, runRestWithToast } from "./api"
import type { RunGraphQLWithToastOptions, RunRestWithToastOptions, ToastMessages } from "./api"

/** Resolves the localized {@link ToastMessages} from the `toast` namespace. */
const useToastMessages = (): ToastMessages => {
    const t = useTranslations("toast")
    return useMemo<ToastMessages>(
        () => ({
            successTitle: t("successTitle"),
            errorTitle: t("errorTitle"),
            unauthorizedTitle: t("unauthorizedTitle"),
            unauthorizedDescription: t("unauthorizedDescription"),
            defaultSuccess: t("defaultSuccess"),
            defaultError: t("defaultError"),
        }),
        [t],
    )
}

/** A localized `runGraphQLWithToast`: use it for every GraphQL mutation. Answers the data, or `undefined` on failure. */
export const useGraphQLWithToast = () => {
    const messages = useToastMessages()
    return useCallback(
        <T>(action: () => Promise<T>, options?: Omit<RunGraphQLWithToastOptions, "messages">) =>
            runGraphQLWithToast(action, { ...options, messages }),
        [messages],
    )
}

/** A localized `runRestWithToast`: use it for every REST write (axios, presigned uploads). Answers the payload, or `null` on failure. */
export const useRestWithToast = () => {
    const messages = useToastMessages()
    return useCallback(
        <T>(action: () => Promise<T>, options?: Omit<RunRestWithToastOptions, "messages">) =>
            runRestWithToast(action, { ...options, messages }),
        [messages],
    )
}
