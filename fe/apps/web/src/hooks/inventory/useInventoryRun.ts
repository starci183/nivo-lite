import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { mutate } from "swr"
import { QUERY_INVENTORY_WORKBENCH_SWR_KEY } from "@/hooks/swr"
import { toast, useGraphQLWithToast } from "@/modules/toast"

/** What one command run leaves on the screen. */
export interface InventoryRun {
    /** Runs a command; on success the notice is the text `onOk` returns and the workbench read is revalidated. */
    readonly exec: <T>(command: () => Promise<T>, onOk?: (value: T) => string | undefined) => void
    readonly isPending: boolean
    /** The generic failure line; the back end sentence is already toasted. */
    readonly error: string | null
    readonly notice: string | null
}

/** Runs commands of the inventory workbench with a pending flag, one error line, one notice, toasts and a read refresh. */
export const useInventoryRun = (): InventoryRun => {
    const t = useTranslations("toast")
    const runGraphQL = useGraphQLWithToast()
    const [isPending, start] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const exec: InventoryRun["exec"] = (command, onOk) => {
        setError(null)
        setNotice(null)
        start(async () => {
            const value = await runGraphQL(command, { showSuccessToast: false })
            if (value === undefined) {
                setError(t("defaultError"))
                return
            }
            const text = onOk?.(value) ?? null
            setNotice(text)
            toast.success(t("successTitle"), { description: text ?? t("defaultSuccess") })
            await mutate(QUERY_INVENTORY_WORKBENCH_SWR_KEY)
        })
    }
    return { exec, isPending, error, notice }
}
