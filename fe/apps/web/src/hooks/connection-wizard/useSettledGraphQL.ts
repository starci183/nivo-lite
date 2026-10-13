"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useGraphQLWithToast } from "@/modules/toast"

/** What a connection command settled with: its payload, or the back end message of why it failed (already in the reader's language). */
export type Settled<T> =
    { readonly kind: "ok"; readonly value: T } | { readonly kind: "failed"; readonly message: string }

/**
 * Runs one GraphQL mutation of the connections console through the toast helper. A success toasts `successMessage` when one is
 * given; a failure is not toasted but handed back with the message the back end sent, so the wizard or row that asked shows it
 * on the line where the owner is looking.
 */
export const useSettledGraphQL = () => {
    const t = useTranslations("toast")
    const runGraphQL = useGraphQLWithToast()
    return useCallback(
        async <T>(action: () => Promise<T>, successMessage?: string): Promise<Settled<T>> => {
            let message = t("defaultError")
            const value = await runGraphQL(
                async () => {
                    try {
                        return await action()
                    } catch (error) {
                        if (error instanceof Error && error.message) message = error.message
                        throw error
                    }
                },
                successMessage === undefined
                    ? { showSuccessToast: false, showErrorToast: false }
                    : { successMessage, showErrorToast: false },
            )
            return value === undefined ? { kind: "failed", message } : { kind: "ok", value }
        },
        [runGraphQL, t],
    )
}
