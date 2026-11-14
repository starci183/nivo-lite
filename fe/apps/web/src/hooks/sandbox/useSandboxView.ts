"use client"

import { useLocale } from "next-intl"
import { useState } from "react"
import { loadingSlot, mapSlot } from "@/hooks/slot"
import {
    useQuerySandboxAccountsSwr,
    useQuerySandboxProvidersSwr,
    useQuerySandboxWaitingRunsSwr,
} from "@/hooks/swr"
import {
    accountsDataOf,
    providerChoicesOf,
    selectedAccountOf,
    waitingRowsOf,
} from "@/modules/sandbox"
import { actionsOf, openViewOf, pendingOf, slotOfSandboxRead } from "./sandbox.shared"
import { useSandboxAccountCommands } from "./useSandboxAccountCommands"
import { useSandboxAccountReads } from "./useSandboxAccountReads"
import { useSandboxAccountState } from "./useSandboxAccountState"
import { useSandboxAgentView } from "./useSandboxAgentView"
import { useSandboxCaseCommands } from "./useSandboxCaseCommands"
import { useSandboxCopy } from "./useSandboxCopy"
import { useSandboxDrawer } from "./useSandboxDrawer"
import { useSandboxGate } from "./useSandboxGate"
import { useSandboxWaitCommands } from "./useSandboxWaitCommands"
import type { DataSlot, SandboxPanesBaseProps } from "@/modules/types"

/** How many parked runs the page asks for (the back end bounds it at fifty). */
const WAITING_LIMIT = 20

/**
 * The whole view of the Sandbox page: which body it draws (the dev switch, the viewer's seat), the accounts and what the open one
 * holds (its cases, its call log, its key), the parked runs, the drawer that opens an account and the commands. The block only hands
 * the result to its pure half. While the dev switch is asked, or the accounts are read, every block holds its skeleton.
 */
export const useSandboxView = (): SandboxPanesBaseProps => {
    const locale = useLocale()
    const { copy, words } = useSandboxCopy()
    const { gate, retry: retryGate } = useSandboxGate()
    const drawer = useSandboxDrawer()
    const accountCommands = useSandboxAccountCommands()
    const caseCommands = useSandboxCaseCommands()
    const waitCommands = useSandboxWaitCommands()
    const [chosenId, setChosenId] = useState<string | null>(null)
    const [isClearAsked, setIsClearAsked] = useState(false)
    const isOn = gate === "on"
    const accountsRead = useQuerySandboxAccountsSwr(isOn)
    const waitingRead = useQuerySandboxWaitingRunsSwr(WAITING_LIMIT, isOn)
    const providersRead = useQuerySandboxProvidersSwr(isOn && drawer.isOpen)
    const selected = selectedAccountOf(accountsRead.data, chosenId)
    const state = useSandboxAccountState(selected?.id ?? null)
    const reads = useSandboxAccountReads(selected, state, words)
    const accounts = mapSlot(slotOfSandboxRead(accountsRead), (wire) =>
        accountsDataOf(wire, selected?.id ?? "", words, locale),
    )
    const agentView = useSandboxAgentView({
        isOn,
        isOpenDrawerShown: drawer.isOpen,
        accountsRead,
        chosenId,
        locale,
    })
    const isChecking = gate === "checking"
    const held = <T>(slot: DataSlot<T>): DataSlot<T> =>
        isChecking || "isLoading" in accounts ? loadingSlot<T>() : slot
    const accountName = drawer.typedName ?? (drawer.provider === null ? "" : words.defaultName(drawer.provider))
    return {
        props: {
            copy,
            locale,
            gate,
            accounts: isChecking ? loadingSlot() : accounts,
            agents: held(agentView.agents),
            attach: agentView.attach,
            detachAsk: agentView.detachAsk,
            cases: held(reads.cases),
            calls: held(reads.calls),
            webhookKey: { isRevealed: state.isKeyRevealed, value: held(reads.key) },
            waiting: isChecking
                ? loadingSlot()
                : mapSlot(slotOfSandboxRead(waitingRead), (wire) => waitingRowsOf(wire, words)),
            open: openViewOf(
                { drawer, accountCommands, accountName },
                {
                    providers: mapSlot(slotOfSandboxRead(providersRead), (wire) =>
                        providerChoicesOf(wire, words, locale),
                    ),
                    agents: agentView.openChoices,
                },
            ),
            pending: pendingOf({ accountCommands, caseCommands, waitCommands, agentCommands: agentView.commands }),
            isClearAsked,
        },
        on: actionsOf({
            selectedId: selected?.id,
            accountName,
            state,
            reads,
            drawer,
            accountCommands,
            caseCommands,
            waitCommands,
            agentView,
            choose: setChosenId,
            askClear: setIsClearAsked,
            retry: {
                retryGate,
                retryAccounts: () => void accountsRead.mutate(),
                retryWaiting: () => void waitingRead.mutate(),
                retryProviders: () => void providersRead.mutate(),
                retryAgents: agentView.retry,
            },
        }),
    }
}
