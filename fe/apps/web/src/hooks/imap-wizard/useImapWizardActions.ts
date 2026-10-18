"use client"

import { IMAP_PRESETS, defaultPort, securityOf, type ImapSecurity } from "./imap-wizard.shared"
import { type AgentWish } from "@/hooks/connections"
import { useImapAccountForm } from "@/hooks/rhf"
import { useTransition } from "react"
import type { Settled } from "../connection-wizard"
import { type ImapCommands } from "./useImapCommands"
import type { ImapWizardState } from "./useImapWizard"

type TextField = "name" | "email" | "host" | "port" | "user" | "password"

/** The resolved inputs for imap wizard actions input. */
interface ImapWizardActionsInput {
    readonly patch: import("react").Dispatch<Partial<ImapWizardState>>
    readonly form: ReturnType<typeof useImapAccountForm>
    readonly commands: ImapCommands
    readonly request: () => {
        name: string
        email: string
        host: string
        port: number
        security: "tls" | "starttls"
        user: string
        password: string
        connectionId?: string
    }
    readonly stamp: string
    readonly state: ImapWizardState
    readonly onClose: (changed: boolean) => void
    readonly setConnectionAgents: (connectionId: string, wanted: ReadonlyArray<AgentWish>) => Promise<Settled<true>>
    readonly startSync: (connectionId: string) => Promise<void>
}

/** Owns mailbox test, save and agent-assignment transitions. */
export const useImapWizardActions = ({
    patch,
    form,
    commands,
    request,
    stamp,
    state,
    onClose,
    setConnectionAgents,
    startSync,
}: ImapWizardActionsInput) => {
    const [isPending, startTransition] = useTransition()
    const setField = (key: TextField) => (value: string) => {
        patch({ tested: null })
        form.setValue(key, value, { shouldValidate: true, shouldDirty: true })
    }
    const pickPreset = (id: string) => {
        const next = IMAP_PRESETS.find((candidate) => candidate.id === id) ?? IMAP_PRESETS[0]
        patch({ preset: next.id, tested: null })
        if (next.id === "other") return
        form.setValue("security", "tls", { shouldValidate: true })
        form.setValue("host", next.host, { shouldValidate: true })
        form.setValue("port", String(next.port), { shouldValidate: true })
    }
    const pickSecurity = (value: string) => {
        const security: ImapSecurity = securityOf(value)
        patch({ tested: null })
        form.setValue("security", security, { shouldValidate: true })
        form.setValue("port", String(defaultPort(security)), { shouldValidate: true })
    }
    const go = (to: number) => patch({ error: null, index: to })

    const check = () =>
        startTransition(async () => {
            patch({ error: null })
            const answer = await commands.test(request())
            if (answer.kind !== "ok") return patch({ error: answer.message })
            const found = answer.value
            patch({
                tested: stamp,
                folderList: [...new Set([...found, ...state.folders])],
                ...(state.folders.length === 0
                    ? { folders: found.includes("INBOX") ? ["INBOX"] : found.slice(0, 1) }
                    : {}),
            })
        })

    const save = () =>
        startTransition(async () => {
            patch({ error: null })
            const answer = await commands.save({
                ...request(),
                folders: [...state.folders],
                sinceDays: state.sinceDays,
                syncEveryMinutes: state.every,
            })
            if (answer.kind !== "ok") return patch({ error: answer.message })
            form.setValue("password", "")
            patch({ savedId: answer.value, index: 3 })
        })

    const finish = () => {
        if (state.savedId === null) return onClose(false)
        const id = state.savedId
        startTransition(async () => {
            const answer = await setConnectionAgents(id, state.agentIds)
            if (answer.kind !== "ok") return patch({ error: answer.message })
            void startSync(id)
            onClose(true)
        })
    }
    return { go, setField, pickPreset, pickSecurity, check, save, finish, isPending }
}
