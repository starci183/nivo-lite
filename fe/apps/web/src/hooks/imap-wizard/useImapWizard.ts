"use client"

import { useEffect, useReducer, useRef, useTransition } from "react"
import { useSetConnectionAgents, useSyncNow } from "@/hooks/connections"
import { useImapAccountForm } from "@/hooks/rhf"
import type { ImapAccountValues } from "@/hooks/rhf"
import { IMAP_PRESETS, IMAP_STEPS, defaultPort, presetOfHost, securityOf } from "./imap-wizard.shared"
import type { ImapMailbox, ImapPresetId, ImapSecurity } from "./imap-wizard.shared"
import { useImapCommands } from "./useImapCommands"
import { useImapMailbox } from "./useImapMailbox"

/** What the mailbox wizard needs from its drawer. */
interface ImapWizardInput {
    /** The saved mailbox being continued or edited; absent for a new one. */
    readonly resumeId: string | undefined
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** The wizard's own state, besides the account form. */
interface ImapWizardState {
    readonly index: number
    readonly savedId: string | null
    readonly preset: ImapPresetId
    readonly folderList: ReadonlyArray<string>
    readonly tested: string | null
    readonly folders: ReadonlyArray<string>
    readonly sinceDays: number
    readonly every: number | null
    readonly agentIds: ReadonlyArray<string>
    readonly error: string | null
}

type TextField = "name" | "email" | "host" | "port" | "user" | "password"

const stateOf = (mailbox: ImapMailbox | undefined): ImapWizardState => ({
    index: 0,
    savedId: mailbox === undefined ? null : mailbox.id,
    preset: mailbox === undefined ? "gmail" : presetOfHost(mailbox.host),
    folderList: mailbox === undefined ? [] : mailbox.folders,
    tested: null,
    folders: mailbox === undefined ? ["INBOX"] : mailbox.folders,
    sinceDays: mailbox === undefined ? 30 : mailbox.sinceDays,
    every: mailbox === undefined ? 60 : mailbox.syncEveryMinutes,
    agentIds: mailbox === undefined ? [] : mailbox.agentIds,
    error: null,
})

const accountOf = (mailbox: ImapMailbox | undefined): ImapAccountValues | undefined =>
    mailbox === undefined
        ? undefined
        : {
              name: mailbox.name,
              email: mailbox.email,
              host: mailbox.host,
              port: String(mailbox.port),
              security: mailbox.security,
              user: mailbox.user,
              password: "",
          }

const merge = (state: ImapWizardState, patch: Partial<ImapWizardState>): ImapWizardState => ({ ...state, ...patch })

/**
 * The mailbox wizard's state machine: 1 sign-in with a test that lists the folders, 2 folders and how far back the first sync reads,
 * 3 how often to sync (the mailbox is saved here), 4 attach agents. When resuming, the saved mailbox is read first (`loading`, or
 * `loadError` when it could not be) and seeds the steps once. The password goes to the back end once and is never read back.
 */
export const useImapWizard = ({ resumeId, onClose }: ImapWizardInput) => {
    const commands = useImapCommands()
    const setConnectionAgents = useSetConnectionAgents()
    const { start: startSync } = useSyncNow()
    const { loading, view: mailbox, error: loadError } = useImapMailbox(resumeId)
    const [state, patch] = useReducer(merge, undefined, stateOf)
    const [isPending, startTransition] = useTransition()
    const form = useImapAccountForm(state.savedId !== null)
    const { reset } = form
    const seeded = useRef<string | null>(null)
    useEffect(() => {
        if (mailbox === undefined || seeded.current === mailbox.id) return
        seeded.current = mailbox.id
        patch(stateOf(mailbox))
        const account = accountOf(mailbox)
        if (account !== undefined) reset(account)
    }, [mailbox, reset])
    const values = form.watch()

    const user = values.user.trim() || values.email.trim()
    const stamp = `${values.host}|${values.port}|${values.security}|${user}|${values.password}`
    const request = () => ({
        ...(state.savedId === null ? {} : { connectionId: state.savedId }),
        name: values.name.trim(),
        email: values.email.trim(),
        host: values.host,
        port: Number(values.port),
        security: values.security,
        user,
        password: values.password,
    })

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

    return {
        loading,
        loadError,
        step: IMAP_STEPS[state.index] ?? "account",
        index: state.index,
        savedId: state.savedId,
        preset: state.preset,
        folderList: state.folderList,
        folders: state.folders,
        sinceDays: state.sinceDays,
        every: state.every,
        agentIds: state.agentIds,
        error: state.error,
        values,
        isPending,
        isTested: state.tested === stamp,
        wasTested: state.tested !== null,
        ready: form.formState.isValid,
        go,
        setField,
        pickPreset,
        pickSecurity,
        setFolders: (folders: ReadonlyArray<string>) => patch({ folders }),
        setSinceDays: (sinceDays: number) => patch({ sinceDays }),
        setEvery: (every: number | null) => patch({ every }),
        setAgentIds: (agentIds: ReadonlyArray<string>) => patch({ agentIds }),
        check,
        save,
        finish,
    }
}
