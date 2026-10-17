"use client"

import { databaseTargetOf, stateOf, DB_SCHEDULES, DB_STEPS, dbEngineOf, dbPortOf } from "./database-wizard.shared"
import { useSetConnectionAgents } from "@/hooks/connections"
import type { AgentWish } from "@/hooks/connections"
import { useDatabaseTargetForm } from "@/hooks/rhf"
import type { DatabaseTargetValues } from "@/hooks/rhf"
import type { DbEngine, DbTableInfo, DbTableMapping, DbTarget } from "@/modules/types"
import { DB_DEFAULT_PORT } from "@/modules/utils"
import { useEffect, useReducer, useRef, useTransition } from "react"
import type { Settled } from "../connection-wizard"
import { useDatabaseCommands } from "./useDatabaseCommands"
import type { DatabaseCommands } from "./useDatabaseCommands"
import { useDatabaseSaved } from "./useDatabaseSaved"
import { useDatabaseTables } from "./useDatabaseTables"

/** What the database wizard needs from its drawer. */
interface DatabaseWizardInput {
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
type DatabasePatch = Partial<DatabaseWizardState> | ((state: DatabaseWizardState) => Partial<DatabaseWizardState>)

type TextField = "name" | "host" | "port" | "database" | "user" | "password"

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
    const [isPending, startTransition] = useTransition()
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

    const { go, test, save, finish, setField, setEngine, setSsl } = createDatabaseWizardActions(
        patch,
        form,
        values,
        startTransition,
        commands,
        state,
        typed,
        input,
        setConnectionAgents,
    )

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

const createDatabaseWizardActions = (
    patch: import("react").Dispatch<Parameters<typeof merge>[1]>,
    form: ReturnType<typeof useDatabaseTargetForm>,
    values: DatabaseTargetValues,
    startTransition: import("react").TransitionStartFunction,
    commands: DatabaseCommands,
    state: DatabaseWizardState,
    typed: () => DbTarget,
    input: DatabaseWizardInput,
    setConnectionAgents: (connectionId: string, wanted: ReadonlyArray<AgentWish>) => Promise<Settled<true>>,
) => {
    const go = (to: number) => patch({ error: null, found: null, index: to })
    const fail = (message: string) => patch({ error: message, found: null })
    const setField = (field: TextField) => (value: string) => {
        form.setValue(field, field === "port" ? dbPortOf(value) : value, { shouldValidate: true, shouldDirty: true })
        patch({ tables: null })
    }
    const setEngine = (value: string | null) => {
        const engine: DbEngine = dbEngineOf(value ?? "") ?? "postgres"
        if (values.port === String(DB_DEFAULT_PORT[values.engine]))
            form.setValue("port", String(DB_DEFAULT_PORT[engine]))
        form.setValue("engine", engine, { shouldValidate: true, shouldDirty: true })
        patch({ tables: null })
    }
    const setSsl = (on: boolean) => {
        form.setValue("ssl", on, { shouldValidate: true, shouldDirty: true })
        patch({ tables: null })
    }

    const test = () => {
        patch({ error: null, found: null })
        startTransition(async () => {
            const answer = await commands.test(state.connId, typed())
            if (answer.kind !== "ok") return fail(answer.message)
            const found = answer.value
            // Keep the saved mapping for tables that still exist.
            patch((s) => ({
                tables: found,
                found: found.length,
                picked: s.picked.filter((m) => found.some((x) => x.schema === m.schema && x.name === m.table)),
            }))
        })
    }

    const save = () =>
        startTransition(async () => {
            const answer = await commands.save({
                connectionId: state.connId,
                name: values.name,
                target: typed(),
                tables: state.picked,
                everyMinutes: state.everyMinutes,
            })
            if (answer.kind !== "ok") return fail(answer.message)
            form.setValue("password", "", { shouldValidate: true })
            patch({ connId: answer.value, passwordKept: true, error: null, found: null, index: 3 })
        })

    const finish = () => {
        const id = state.connId
        if (!id) return input.onClose(false)
        startTransition(async () => {
            const answer = await setConnectionAgents(id, state.agentIds)
            if (answer.kind !== "ok") return fail(answer.message)
            input.onClose(true)
        })
    }
    return { go, test, save, finish, setField, setEngine, setSsl }
}

/** Builds the normalized target sent by database commands. */
