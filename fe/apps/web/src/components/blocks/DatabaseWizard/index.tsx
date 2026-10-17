"use client"

import { useFormatter, useTranslations } from "next-intl"
import { agentChoicesOf } from "@/hooks/connection-wizard"
import {
    DB_ENGINES,
    DB_ENTITIES,
    DB_MAX_COLUMNS,
    DB_MAX_ROWS,
    DB_NO_COLUMN,
    DB_SCHEDULES,
    DB_STEPS,
    dbTableKey,
    useDatabaseWizard,
} from "@/hooks/database-wizard"
import type { AgentOption } from "@/modules/types"
import { DatabaseWizardBase } from "./component"
import type { DatabaseWizardBaseProps } from "./component"

/** What the board hands the database wizard. */
interface DatabaseWizardProps {
    /** Workspace agents (any module): every agent may be given read access to the data. */
    readonly agents: ReadonlyArray<AgentOption>
    /** Continue or edit this existing connection instead of creating a new one. */
    readonly resumeId?: string
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/**
 * Setup of a business database connection (owner only): reads the saved connection when resuming, then connect and list the tables,
 * map them, schedule the sync (saved here), attach the agents.
 */
export const DatabaseWizard = (props: DatabaseWizardProps) => {
    const t = useTranslations("connectorDatabase")
    const tw = useTranslations("connectionWizard")
    const format = useFormatter()
    const wizard = useDatabaseWizard({ resumeId: props.resumeId, onClose: props.onClose })
    const { on } = wizard
    return (
        <DatabaseWizardBase
            props={{
                loading: wizard.isLoading ? t("loading") : null,
                title: t("title"),
                stepLabel: tw("stepOf", { n: wizard.index + 1, total: DB_STEPS.length }),
                steps: [t("stepConnect"), t("stepTables"), t("stepSchedule"), t("stepAgent")],
                index: wizard.index,
                step: wizard.step,
                connect: connectionOf(wizard, t),
                tables: tablesOf(wizard, t, format),
                schedule: {
                    hint: t("scheduleHint"),
                    label: t("scheduleLabel"),
                    value: String(wizard.everyMinutes ?? "manual"),
                    options: DB_SCHEDULES.map((s) => ({ value: s.key, label: t(`every_${s.key}`) })),
                },
                agentStep: {
                    title: t("agentTitle"),
                    notice: null,
                    agents: agentChoicesOf(props.agents, "database", tw),
                    value: wizard.agentIds,
                    hint: tw("agentHint"),
                    none: tw("agentNone"),
                },
                note: noteOf(
                    wizard.error,
                    wizard.found === null ? null : t("testOk", { count: format.number(wizard.found) }),
                ),
                isPending: wizard.isPending,
                canTest: wizard.canTest,
                tablesReady: wizard.tablesReady,
                text: {
                    back: t("back"),
                    next: t("next"),
                    close: t("close"),
                    done: t("done"),
                    save: t("save"),
                    test: t("test"),
                },
            }}
            on={{
                go: on.go,
                test: on.test,
                save: on.save,
                finish: on.finish,
                close: on.close,
                tables: on.toggle,
                mapEntity: on.setEntity,
                mapIdColumn: on.setIdColumn,
                mapOptionalColumn: on.setOptionalColumn,
                mapColumns: on.setColumns,
                mapPreview: on.preview,
                schedule: on.setSchedule,
                agents: on.setAgentIds,
            }}
        />
    )
}

/** The note under the step: the error first, else the test result, else nothing. */
const noteOf = (error: string | null, found: string | null) => {
    if (error !== null) return { tone: "negative" as const, text: error }
    return found === null ? null : { tone: "affirmative" as const, text: found }
}

type DatabaseState = ReturnType<typeof useDatabaseWizard>
type DatabaseSay = ReturnType<typeof useTranslations<"connectorDatabase">>

/** Input values and copy of the connection step. */
const connectionOf = (wizard: DatabaseState, t: DatabaseSay): DatabaseWizardBaseProps["props"]["connect"] => {
    const { values, on } = wizard
    return {
        props: {
            values,
            ssl: values.ssl ? "on" : "off",
            engines: DB_ENGINES.map((engine) => ({ id: engine, label: t(`engine_${engine}`) })),
            passwordHint: wizard.passwordSaved && !values.password ? t("passwordSaved") : undefined,
            isDisabled: wizard.isPending,
            text: {
                readOnlyTitle: t("readOnlyTitle"),
                readOnlyBody: t("readOnlyBody"),
                name: t("fieldName"),
                nameHint: t("fieldNameHint"),
                engine: t("fieldEngine"),
                host: t("fieldHost"),
                hostHint: t("fieldHostHint"),
                port: t("fieldPort"),
                database: t("fieldDatabase"),
                user: t("fieldUser"),
                password: t("fieldPassword"),
                ssl: t("fieldSsl"),
                sslRequire: t("sslRequire"),
                sslOff: t("sslOff"),
            },
        },
        on: { field: on.setField, engine: on.setEngine, ssl: on.setSsl },
    }
}

/** Tables available to map and their resolved copy. */
const tablesOf = (wizard: DatabaseState, t: DatabaseSay, format: ReturnType<typeof useFormatter>) => {
    const { tables } = wizard
    return tables === null
        ? null
        : {
              hint: t("tablesHint", { max: format.number(DB_MAX_COLUMNS) }),
              label: t("tablesFound"),
              options: tables.map((x) => ({
                  value: dbTableKey(x),
                  label: `${dbTableKey(x)} (${format.number(x.columns.length)})`,
              })),
              picked: wizard.picked.map(dbTableKey),
              none: wizard.picked.length === 0 ? t("tablesNone") : null,
              limit: t("limitNote", { rows: format.number(DB_MAX_ROWS) }),
              mapped: wizard.mapped.map((table) => ({
                  ...table,
                  previewTitle: t("previewTitle", { table: table.table }),
              })),
              entities: DB_ENTITIES.map((entity) => ({ id: entity, label: t(`entity_${entity}`) })),
              noneColumn: { id: DB_NO_COLUMN, label: t("colNone") },
              cap: t("colCap", { max: format.number(DB_MAX_COLUMNS) }),
              previewing: t("previewing"),
              text: {
                  entity: t("tableEntity"),
                  id: t("colId"),
                  idHint: t("colIdHint"),
                  titleColumn: t("colTitle"),
                  updated: t("colUpdated"),
                  updatedHint: t("colUpdatedHint"),
                  columns: t("colColumns"),
                  preview: t("preview"),
                  previewEmpty: t("previewEmpty"),
              },
          }
}
