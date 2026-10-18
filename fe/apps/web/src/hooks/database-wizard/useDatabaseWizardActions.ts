"use client"

import { dbEngineOf, dbPortOf } from "./database-wizard.shared"
import { type AgentWish } from "@/hooks/connections"
import { useDatabaseTargetForm, type DatabaseTargetValues } from "@/hooks/rhf"
import type { DbEngine, DbTableInfo, DbTableMapping, DbTarget } from "@/modules/types"
import { DB_DEFAULT_PORT } from "@/modules/utils"
import { useTransition } from "react"
import type { Settled } from "../connection-wizard"
import { type DatabaseCommands } from "./useDatabaseCommands"
import type { DatabasePatch, DatabaseWizardInput, DatabaseWizardState } from "./useDatabaseWizard"

type TextField = "name" | "host" | "port" | "database" | "user" | "password"

/** The resolved inputs for database wizard actions input. */
interface DatabaseWizardActionsInput {
    readonly patch: import("react").Dispatch<DatabasePatch>
    readonly form: ReturnType<typeof useDatabaseTargetForm>
    readonly values: DatabaseTargetValues
    readonly commands: DatabaseCommands
    readonly state: DatabaseWizardState
    readonly typed: () => DbTarget
    readonly input: DatabaseWizardInput
    readonly setConnectionAgents: (connectionId: string, wanted: ReadonlyArray<AgentWish>) => Promise<Settled<true>>
}

/** Owns pending database tests, configuration saves and agent assignment. */
export const useDatabaseWizardActions = ({
    patch,
    form,
    values,
    commands,
    state,
    typed,
    input,
    setConnectionAgents,
}: DatabaseWizardActionsInput) => {
    const [isPending, startTransition] = useTransition()
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
                picked: retainedMappingsOf(s.picked, found),
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
    return { go, test, save, finish, setField, setEngine, setSsl, isPending }
}

/** Keeps only mappings whose schema and table still exist after a connection test. */
const retainedMappingsOf = (
    picked: ReadonlyArray<DbTableMapping>,
    found: ReadonlyArray<DbTableInfo>,
): ReadonlyArray<DbTableMapping> =>
    picked.filter((mapping) => found.some((table) => table.schema === mapping.schema && table.name === mapping.table))
