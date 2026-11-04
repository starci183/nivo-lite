import type { useSetConnectionAgents } from "@/hooks/connections"
import type { MetaCheck, MetaWizardConnection, WizardNote } from "@/modules/types"
import type { useTranslations } from "next-intl"
import type { MetaCommands } from "./useMetaCommands"

/** The resolved inputs for meta wizard actions input. */
interface MetaWizardActionsInput {
    readonly setNote: import("react").Dispatch<import("react").SetStateAction<WizardNote | null>>
    readonly setIndex: import("react").Dispatch<import("react").SetStateAction<number>>
    readonly conn: MetaWizardConnection | null
    readonly startChecking: import("react").TransitionStartFunction
    readonly commands: MetaCommands
    readonly setCheck: import("react").Dispatch<import("react").SetStateAction<MetaCheck | null>>
    readonly startTransition: import("react").TransitionStartFunction
    readonly pageId: string
    readonly tm: ReturnType<typeof useTranslations<"metaWizard">>
    readonly setConn: import("react").Dispatch<import("react").SetStateAction<MetaWizardConnection | null>>
    readonly setAgentsOf: ReturnType<typeof useSetConnectionAgents>
    readonly agentIds: ReadonlyArray<string>
}

export const createMetaWizardActions = ({
    setNote,
    setIndex,
    conn,
    startChecking,
    commands,
    setCheck,
    startTransition,
    pageId,
    tm,
    setConn,
    setAgentsOf,
    agentIds,
}: MetaWizardActionsInput) => {
    const go = (to: number): void => {
        setNote(null)
        setIndex(to)
    }
    const fail = (message: string) => setNote({ tone: "negative", text: message })

    const runCheck = (repair: boolean): void => {
        if (conn === null) return
        startChecking(async () => {
            const answer = await commands.check(conn.id, repair)
            if (answer.kind !== "ok") return fail(answer.message)
            setCheck(answer.value)
        })
    }

    const login = (): void =>
        startTransition(async () => {
            setNote(null)
            const answer = await commands.authorize(conn === null ? undefined : conn.id)
            if (answer.kind !== "ok") return fail(answer.message)
            window.location.assign(answer.value)
        })
    const choose = (): void => {
        if (conn === null || pageId === "") return setNote({ tone: "negative", text: tm("pickPick") })
        startTransition(async () => {
            const answer = await commands.choosePage(conn.id, pageId)
            if (answer.kind !== "ok") return fail(answer.message)
            setConn(answer.value)
            go(2)
        })
    }
    const saveAgents = (): void => {
        if (conn === null) return go(3)
        startTransition(async () => {
            const answer = await setAgentsOf(conn.id, agentIds)
            if (answer.kind !== "ok") return fail(answer.message)
            go(3)
            runCheck(false)
        })
    }
    return { fail, go, runCheck, login, choose, saveAgents }
}
