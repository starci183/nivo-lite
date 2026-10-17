// Pure (non-React) toast helpers around API outcomes. The localized labels are injected by the `use*WithToast` hooks (./hooks),
// so this core stays free of React and i18n.
import { isUnauthenticatedFailure } from "@/modules/failure"
import type { GraphQLResponse } from "@/modules/types"
import { toast } from "./toast"

/** Localized labels used by the toast helpers; resolved from the `toast` i18n namespace by the hooks. */
export interface ToastMessages {
    successTitle: string
    errorTitle: string
    unauthorizedTitle: string
    unauthorizedDescription: string
    /** Fallback success description when the outcome carries no message. */
    defaultSuccess: string
    /** Fallback error description when the failure carries no message. */
    defaultError: string
}

/** Shows a toast from the `success` flag of an outcome. */
export const showGraphQLToast = <T>(response: GraphQLResponse<T>, messages: ToastMessages) => {
    const description = response.message || (response.success ? messages.defaultSuccess : messages.defaultError)
    if (response.success) toast.success(messages.successTitle, { description })
    else toast.danger(messages.errorTitle, { description })
}

/** Shows the toast of a refused session. */
export const showUnauthorizedToast = (messages: ToastMessages) => {
    toast.danger(messages.unauthorizedTitle, { description: messages.unauthorizedDescription })
}

/** Builds the client-side outcome of a failed operation: the message is the (server-localized) text of the failure. */
export const failureResponse = (error: unknown, fallback: string): GraphQLResponse => ({
    success: false,
    message: error instanceof Error && error.message ? error.message : fallback,
    error: error instanceof Error ? error.name : undefined,
})

/** Options for {@link runGraphQLWithToast}. */
export interface RunGraphQLWithToastOptions {
    /** Whether to toast a success. Defaults to `true`. */
    showSuccessToast?: boolean
    /** Whether to toast a failure. Defaults to `true`. */
    showErrorToast?: boolean
    /** Success description (localized by the caller). When omitted the generic success copy is used. */
    successMessage?: string
    /** Localized labels. Injected by `useGraphQLWithToast`. */
    messages: ToastMessages
}

/**
 * Runs a GraphQL operation and toasts its outcome: the success copy is front-end i18n (`successMessage`), a failure shows the
 * message the back end sent (already localized).
 *
 * @returns The data on success, or `undefined` when the operation failed.
 */
export const runGraphQLWithToast = async <T>(
    action: () => Promise<T>,
    options: RunGraphQLWithToastOptions,
): Promise<T | undefined> => {
    const { showSuccessToast = true, showErrorToast = true, successMessage, messages } = options
    try {
        const data = await action()
        if (showSuccessToast) showGraphQLToast({ success: true, message: successMessage ?? "" }, messages)
        return data
    } catch (error) {
        if (showErrorToast) {
            if (isUnauthenticatedFailure(error)) showUnauthorizedToast(messages)
            else showGraphQLToast(failureResponse(error, messages.defaultError), messages)
        }
        return undefined
    }
}

/** Options for {@link runRestWithToast}. */
export interface RunRestWithToastOptions {
    successMessage?: string
    showSuccessToast?: boolean
    showErrorToast?: boolean
    messages: ToastMessages
}

/** Runs a REST call (axios, a presigned upload) and toasts its outcome; answers the payload, or `null` on failure. */
export const runRestWithToast = async <T>(
    action: () => Promise<T>,
    options: RunRestWithToastOptions,
): Promise<T | null> => {
    const { successMessage, showSuccessToast = true, showErrorToast = true, messages } = options
    try {
        const response = await action()
        if (showSuccessToast)
            toast.success(messages.successTitle, { description: successMessage ?? messages.defaultSuccess })
        return response
    } catch (error) {
        if (showErrorToast) showGraphQLToast(failureResponse(error, messages.defaultError), messages)
        return null
    }
}
