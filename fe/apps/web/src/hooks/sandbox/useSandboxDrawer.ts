"use client"

import { useState } from "react"

/** The drawer that opens a sandbox account: whether it shows and what the person chose and typed. */
export interface SandboxDrawerState {
    readonly isOpen: boolean
    /** The provider the person chose; null until they do. */
    readonly provider: string | null
    /** The name the person typed; null while they left the suggested one. */
    readonly typedName: string | null
    /** The agents the person chose to give the new account to. */
    readonly agentIds: ReadonlyArray<string>
    readonly show: () => void
    readonly hide: () => void
    readonly chooseProvider: (provider: string) => void
    readonly setName: (name: string) => void
    readonly chooseAgents: (agentIds: ReadonlyArray<string>) => void
}

/** The state of the open-account drawer; closing it forgets what was chosen. */
export const useSandboxDrawer = (): SandboxDrawerState => {
    const [isOpen, setIsOpen] = useState(false)
    const [provider, setProvider] = useState<string | null>(null)
    const [typedName, setTypedName] = useState<string | null>(null)
    const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>([])
    const hide = (): void => {
        setIsOpen(false)
        setProvider(null)
        setTypedName(null)
        setAgentIds([])
    }
    return {
        isOpen,
        provider,
        typedName,
        agentIds,
        show: () => setIsOpen(true),
        hide,
        chooseProvider: setProvider,
        setName: setTypedName,
        chooseAgents: setAgentIds,
    }
}
