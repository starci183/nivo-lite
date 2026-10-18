"use client"

import { useDatabaseWizardActions } from "./useDatabaseWizardActions"
import { databaseTargetOf, stateOf, DB_SCHEDULES, DB_STEPS } from "./database-wizard.shared"
import { useSetConnectionAgents } from "@/hooks/connections"
import { useDatabaseTargetForm } from "@/hooks/rhf"
import type { DbTableInfo, DbTableMapping } from "@/modules/types"
import { DB_DEFAULT_PORT } from "@/modules/utils"
import { useEffect, useReducer, useRef } from "react"
import { useDatabaseCommands } from "./useDatabaseCommands"
import { useDatabaseSaved } from "./useDatabaseSaved"
import { useDatabaseTables } from "./useDatabaseTables"

/** What the database wizard needs from its drawer. */
export interface DatabaseWizardInput {
    /** The connection being continued or edited; absent for a new one. */
    readonly resumeId: string | undefined
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** The wizard's own state, besides the connect form. */
export interface DatabaseWizardState {
    readonly index: number
    readonly passwordKept: boolean
    readonly connId: string | undefined
    readonly tables: ReadonlyArray<DbTableInfo> | null
    readonly picked: ReadonlyArray<DbTableMapping>
    readonly everyMinutes: number | null
    readonly agentIds: ReadonlyArray<string>
    readonly error: string | null
    /** How many tables the last successful test found; null when there is nothing to say. */
    readonly found: number | null
}

/** One change to the state: a partial patch, or one computed from the latest state. */
export type DatabasePatch =
    Partial<DatabaseWizardState> | ((state: DatabaseWizardState) => Partial<DatabaseWizardState>)

const merge = (state: DatabaseWizardState, patch: DatabasePatch): DatabaseWizardState => ({
    ...state,
    ...(typeof patch === "function" ? patch(state) : patch),
})

/**
 * The database wizard's state machine: 1 connect and list the tables, 2 map the tables, 3 schedule (the connection is saved here),
 * 4 attach agents. When resuming, the saved connection is read first (`isLoading`) and seeds the steps once. The password lives in
 * the form only until it is saved; when editing it is never sent back.
 */
export const useDatabaseWizard = (input: DatabaseWizardInput) => {
    const setConnectionAgents = useSetConnectionAgents()
    const commands = useDatabaseCommands()
    const { saved, isLoading, error: loadError } = useDatabaseSaved(input.resumeId)
    const [state, patch] = useReducer(merge, undefined, () => stateOf(input.resumeId, null))
    const seeded = useRef(false)
    useEffect(() => {
        if (isLoading || seeded.current) return
        seeded.current = true
        patch(stateOf(input.resumeId, saved, loadError))
    }, [isLoading, input.resumeId, saved, loadError])
    const passwordSaved = state.passwordKept || Boolean(saved?.hasPassword)
    const form = useDatabaseTargetForm(passwordSaved, saved, DB_DEFAULT_PORT.postgres)
    const values = form.watch()
    const typed = () => databaseTargetOf(values)
    const mapping = useDatabaseTables({
        commands,
        connectionId: state.connId,
        target: typed,
        tables: state.tables,
        picked: state.picked,
        update: (change) => patch((s) => ({ picked: change(s.picked) })),
    })

    const { go, test, save, finish, setField, setEngine, setSsl, isPending } = useDatabaseWizardActions({
        patch,
        form,
        values,
        commands,
        state,
        typed,
        input,
        setConnectionAgents,
    })

    return {
        isLoading,
        step: DB_STEPS[state.index] ?? "connect",
        index: state.index,
        values,
        passwordSaved,
        tables: state.tables,
        picked: state.picked,
        everyMinutes: state.everyMinutes,
        agentIds: state.agentIds,
        error: state.error,
        found: state.found,
        isPending,
        canTest: form.formState.isValid,
        tablesReady: state.picked.length > 0 && state.picked.every((m) => m.idColumn),
        mapped: mapping.mapped,
        on: {
            go,
            test,
            save,
            finish,
            toggle: mapping.toggle,
            setEntity: mapping.setEntity,
            setIdColumn: mapping.setIdColumn,
            setOptionalColumn: mapping.setOptionalColumn,
            setColumns: mapping.setColumns,
            preview: mapping.preview,
            setField,
            setEngine,
            setSsl,
            close: () => input.onClose(state.connId !== undefined && state.connId !== input.resumeId),
            setSchedule: (key: string) =>
                patch({ everyMinutes: DB_SCHEDULES.find((s) => s.key === key)?.minutes ?? null }),
            setAgentIds: (agentIds: ReadonlyArray<string>) => patch({ agentIds }),
        },
    }
}
