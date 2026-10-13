import { useState, useTransition } from "react"
import type { InventoryResult } from "@/hooks/inventoryCommands"
import { navigation } from "@/modules/i18n"

/** What one command run leaves on the screen. */
export interface InventoryRun {
    /** Runs a command; on success the notice is the text `onOk` returns and the server data is read again. */
    readonly exec: <T>(command: () => Promise<InventoryResult<T>>, onOk?: (value: T) => string | undefined) => void
    readonly isPending: boolean
    /** The back end sentence for a refusal, or a plain failure sentence. */
    readonly error: string | null
    readonly notice: string | null
}

/** Runs commands of the inventory workbench with a pending flag, one error line, one notice and a refresh of the server data after a success. */
export const useInventoryRun = (): InventoryRun => {
    const router = navigation.useRouter()
    const [isPending, start] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const exec: InventoryRun["exec"] = (command, onOk) => {
        setError(null)
        setNotice(null)
        start(async () => {
            const outcome = await command()
            if (outcome.kind === "ok") {
                setNotice(onOk?.(outcome.value) ?? null)
                router.refresh()
                return
            }
            setError(outcome.code)
        })
    }
    return { exec, isPending, error, notice }
}
