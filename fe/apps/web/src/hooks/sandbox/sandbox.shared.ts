import { slotOfSwr } from "@/hooks/slot"
import type { ReadResponse } from "@/hooks/workspaceread"
import type { DataSlot, SandboxPanesBaseProps } from "@/modules/types"
import { mutate } from "@/modules/viewer-cache"
import type { SandboxAccountReads } from "./useSandboxAccountReads"
import type { SandboxAccountState } from "./useSandboxAccountState"
import type { SandboxAccountCommands } from "./useSandboxAccountCommands"
import type { SandboxCaseCommands } from "./useSandboxCaseCommands"
import type { SandboxDrawerState } from "./useSandboxDrawer"
import type { SandboxWaitCommands } from "./useSandboxWaitCommands"
import type { SandboxAgentView } from "./useSandboxAgentView"

/** A read as the slot recipe takes it: loading, failed, empty (an empty list) or the data. */
export const slotOfSandboxRead = <T>(read: ReadResponse<T>): DataSlot<T> =>
    slotOfSwr<T>({ data: read.data, error: read.error, isLoading: read.isLoading, isValidating: read.isValidating })

/** Refreshes the reads whose cache names start with these keys, so what a command changed shows at once. */
export const refreshSandbox = async (...keys: ReadonlyArray<string>): Promise<void> => {
    const names: ReadonlySet<string> = new Set(keys)
    await mutate((key) => Array.isArray(key) && typeof key[0] === "string" && names.has(key[0]))
}

/** What the actions of the page act on: the open account, what the person typed, the reads and the commands. */
export interface SandboxActionsInput {
    /** The open account; undefined while there is none. */
    readonly selectedId: string | undefined
    /** The name the open-account form would send: what was typed, else the suggested one. */
    readonly accountName: string
    readonly state: SandboxAccountState
    readonly reads: SandboxAccountReads
    readonly drawer: SandboxDrawerState
    readonly accountCommands: SandboxAccountCommands
    readonly caseCommands: SandboxCaseCommands
    readonly waitCommands: SandboxWaitCommands
    readonly agentView: SandboxAgentView
    readonly choose: (accountId: string) => void
    readonly askClear: (isAsked: boolean) => void
    /** Reads again: the dev switch, the accounts, the parked runs, the providers. */
    readonly retry: Pick<SandboxPanesBaseProps["on"], "retryGate" | "retryAccounts" | "retryWaiting" | "retryProviders" | "retryAgents">
}

/** The inputs a send carries: every field that holds a value (typed or prefilled); an empty one is left to the back end. */
const sendInputsOf = (reads: SandboxAccountReads): ReadonlyArray<{ readonly name: string; readonly value: string }> =>
    (reads.casesData?.fields ?? [])
        .filter((field) => field.value !== "")
        .map((field) => ({ name: field.name, value: field.value }))

/** The commands of the open-account drawer: choose, name, close, submit (the new account opens at once). */
const drawerActionsOf = (input: SandboxActionsInput) => ({
    openDrawer: input.drawer.show,
    closeDrawer: input.drawer.hide,
    chooseProvider: input.drawer.chooseProvider,
    setName: input.drawer.setName,
    chooseAgents: input.drawer.chooseAgents,
    submitOpen: () => {
        const provider = input.drawer.provider
        if (provider === null) return
        void input.accountCommands
            .open({ provider, name: input.accountName.trim(), attachTo: input.drawer.agentIds })
            .then((id) => {
            if (id === undefined) return
            input.choose(id)
            input.drawer.hide()
        })
    },
})

/** The commands on the agents of the open account: give it to more, take it from one (after the question), make it one's default. */
const agentActionsOf = (input: SandboxActionsInput) => ({
    openAttach: input.agentView.state.showAttach,
    closeAttach: input.agentView.state.hideAttach,
    chooseAttach: input.agentView.state.chooseAttach,
    submitAttach: () => {
        const agentIds = input.agentView.state.attachIds
        if (input.selectedId === undefined || agentIds.length === 0) return
        void input.agentView.commands.attach(input.selectedId, agentIds).then(input.agentView.state.hideAttach)
    },
    askDetach: (agentId: string) => input.agentView.state.askDetach(agentId),
    cancelDetach: () => input.agentView.state.askDetach(null),
    acceptDetach: () => {
        const agentId = input.agentView.state.detachAskId
        input.agentView.state.askDetach(null)
        if (input.selectedId === undefined || agentId === null) return
        void input.agentView.commands.detach(input.selectedId, agentId)
    },
    setDefault: (agentId: string) => {
        if (input.selectedId !== undefined) void input.agentView.commands.setDefault(input.selectedId, agentId)
    },
})

/** The commands on the open account: its inputs, its cases, its log, its key. */
const accountActionsOf = (input: SandboxActionsInput) => ({
    setInput: input.state.setInput,
    send: (caseId: string) => {
        if (input.selectedId === undefined) return
        void input.caseCommands.send({
            connectionId: input.selectedId,
            caseId,
            inputs: sendInputsOf(input.reads),
        })
    },
    choose: (caseId: string) => {
        if (input.selectedId !== undefined) void input.caseCommands.choose(input.selectedId, caseId)
    },
    moreCalls: input.state.moreCalls,
    askClear: () => input.askClear(true),
    cancelClear: () => input.askClear(false),
    acceptClear: () => {
        if (input.selectedId === undefined) return
        input.askClear(false)
        void input.accountCommands.clear(input.selectedId)
    },
    revealKey: () => input.state.setKeyRevealed(true),
    hideKey: () => input.state.setKeyRevealed(false),
    copyKey: () => {
        if (input.reads.keyValue !== undefined) void input.accountCommands.copy(input.reads.keyValue)
    },
})

/** Every command of the page, built once from what it acts on. */
export const actionsOf = (input: SandboxActionsInput): SandboxPanesBaseProps["on"] => ({
    ...input.retry,
    retryCases: input.reads.retryCases,
    retryCalls: input.reads.retryCalls,
    retryKey: input.reads.retryKey,
    select: input.choose,
    expire: (runId) => void input.waitCommands.expire(runId),
    ...drawerActionsOf(input),
    ...agentActionsOf(input),
    ...accountActionsOf(input),
})

/** The commands whose running state the page shows. */
interface PendingSources extends Pick<SandboxActionsInput, "accountCommands" | "caseCommands" | "waitCommands"> {
    readonly agentCommands: SandboxAgentView["commands"]
}

/** What is running now, so only its own control shows pending. */
export const pendingOf = (commands: PendingSources): SandboxPanesBaseProps["props"]["pending"] => ({
    sendingId: commands.caseCommands.sendingId,
    choosingId: commands.caseCommands.choosingId,
    expiringId: commands.waitCommands.expiringId,
    isClearing: commands.accountCommands.isClearing,
    isCopying: commands.accountCommands.isCopying,
    detachingId: commands.agentCommands.detachingId,
    defaultingId: commands.agentCommands.defaultingId,
})

/** The open-account drawer as the block draws it: what was chosen and typed, the providers and the agents to choose from. */
export const openViewOf = (
    input: Pick<SandboxActionsInput, "drawer" | "accountCommands" | "accountName">,
    choices: Pick<SandboxPanesBaseProps["props"]["open"], "providers" | "agents">,
): SandboxPanesBaseProps["props"]["open"] => ({
    isOpen: input.drawer.isOpen,
    isPending: input.accountCommands.isOpening,
    provider: input.drawer.provider,
    name: input.accountName,
    agentIds: input.drawer.agentIds,
    ...choices,
})
