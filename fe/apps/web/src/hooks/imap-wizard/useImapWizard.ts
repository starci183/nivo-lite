"use client"

import { useImapWizardActions } from "./useImapWizardActions"
import { accountOf, requestOf, stateOf, IMAP_STEPS, type ImapPresetId } from "./imap-wizard.shared"
import { useSetConnectionAgents, useSyncNow } from "@/hooks/connections"
import { useImapAccountForm } from "@/hooks/rhf"
import { useEffect, useReducer, useRef } from "react"
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
export interface ImapWizardState {
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
    const request = requestOf(state, values, user)

    const { go, setField, pickPreset, pickSecurity, check, save, finish, isPending } = useImapWizardActions({
        patch,
        form,
        commands,
        request,
        stamp,
        state,
        onClose,
        setConnectionAgents,
        startSync,
    })

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
