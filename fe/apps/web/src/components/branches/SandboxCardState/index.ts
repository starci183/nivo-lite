import type { ErrorData } from "@starci/grammar/common"
import type { DataSlot } from "@/modules/types"

/** What a card of the Sandbox page takes from its slot: whether it loads, how it failed and the data it draws. */
interface SandboxCardState<T> {
    readonly isLoading: boolean
    readonly error: ErrorData | undefined
    readonly data: T
}

/** How a failed read is worded and retried. */
interface SandboxFailure {
    readonly message: string
    readonly retryLabel: string
    readonly onRetry: () => void
}

/**
 * The slot of one block as the card draws it: the placeholder while the first read loads (the card keeps its geometry), the failure
 * with its retry when the read failed, the empty data when nothing came, else the data.
 */
export const sandboxCardStateOf = <T>(
    slot: DataSlot<T>,
    placeholder: T,
    empty: T,
    failure: SandboxFailure,
): SandboxCardState<T> => {
    if ("isLoading" in slot) return { isLoading: true, error: undefined, data: placeholder }
    if ("isError" in slot || "isForbidden" in slot) {
        return {
            isLoading: false,
            error: { message: failure.message, actionLabel: failure.retryLabel, onAction: failure.onRetry },
            data: empty,
        }
    }
    return { isLoading: false, error: undefined, data: "items" in slot ? slot.items : empty }
}
