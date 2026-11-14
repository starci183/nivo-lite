"use client"

// React hooks that wrap the pure toast helpers (./api) and inject localized copy through next-intl.
import { useTranslations } from "next-intl"
import { useCallback, useMemo } from "react"
import { runGraphQLWithToast, type RunGraphQLWithToastOptions, type ToastMessages } from "./api"

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
export const useGraphQLWithToast = (): (<T>(
    action: () => Promise<T>,
    options?: Omit<RunGraphQLWithToastOptions, "messages">,
) => Promise<T | undefined>) => {
    const messages = useToastMessages()
    return useCallback(
        <T>(action: () => Promise<T>, options?: Omit<RunGraphQLWithToastOptions, "messages">) =>
            runGraphQLWithToast(action, { ...options, messages }),
        [messages],
    )
}
