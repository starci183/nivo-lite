import { useState, useTransition } from "react"
import type { DbOutcome } from "@/modules/db"
import { navigation } from "@/modules/i18n"

/** Where an install stands: nothing running, one agent being installed, or the last install refused. */
type InstallState =
    | { readonly phase: "idle" }
    | { readonly phase: "busy"; readonly key: string }
    | { readonly phase: "refused"; readonly reason: string }

/** What the install hook hands the block. */
type InstallAgent = {
    /** The key being installed now, empty when idle. */
    readonly busyKey: string
    /** Why the last install was refused, empty otherwise. */
    readonly refusal: string
    /** Installs the agent with the key and opens it. */
    readonly install: (key: string) => void
}

/** Installs an agent with the action the connected block passes in (it answers the page to open) and opens it; a refusal is kept for the block to show. */
export const useInstallAgent = (run: (key: string) => Promise<DbOutcome<string>>): InstallAgent => {
    const router = navigation.useRouter()
    const [state, setState] = useState<InstallState>({ phase: "idle" })
    const [, startTransition] = useTransition()
    const install = (key: string) => {
        setState({ phase: "busy", key })
        startTransition(async () => {
            const outcome = await run(key)
            if (outcome.kind === "ok") {
                router.push(outcome.value)
                return
            }
            setState({ phase: "refused", reason: outcome.code })
        })
    }
    return {
        busyKey: state.phase === "busy" ? state.key : "",
        refusal: state.phase === "refused" ? state.reason : "",
        install,
    }
}
