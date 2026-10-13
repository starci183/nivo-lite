"use client"

import { useFormatter, useTranslations } from "next-intl"
import { agentChoicesOf } from "@/hooks/connection-wizard"
import { MAX_GRID_ROWS, NO_COLUMN, useCsvImportCopy, useCsvImportWizard } from "@/hooks/csv-import-wizard"
import type { AgentOption } from "@/modules/types"
import { CsvImportWizardBase } from "./component"

/** What the board hands the import wizard. */
interface CsvImportWizardProps {
    /** Workspace agents (any module): every agent may be given read access to a data source. */
    readonly agents: ReadonlyArray<AgentOption>
    /** Add more data to this existing import instead of creating a new one. */
    readonly resumeId?: string
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** The column kinds read automatically, in the order the mapping step lists them. */
const KIND_ORDER = ["phone", "email", "number", "date"] as const

/**
 * Setup of a csv_import data connection (owner only): name and kind of rows, the source (file, Google Sheets link, typed or pasted
 * table, documents), the column mapping with a preview, the import itself, and the agents that may read it. Every file is parsed by
 * the back end over GraphQL. With `resumeId` it loads the saved import first, then adds more data to it with the saved mapping.
 */
export const CsvImportWizard = (props: CsvImportWizardProps) => {
    const t = useTranslations("connectorCsv")
    const tw = useTranslations("connectionWizard")
    const format = useFormatter()
    const copy = useCsvImportCopy()
    const wizard = useCsvImportWizard(props)
    const { preview, mapping, result, grid, saved, form } = wizard
    const headerOptions = (preview?.headers ?? []).map((header) => ({ id: header, label: header }))
    const kindList = KIND_ORDER.map((kind) => {
        const columns = Object.entries(mapping?.kinds ?? {}).filter(([, value]) => value === kind)
        return columns.length ? `${columns.map(([header]) => header).join(", ")} (${copy.kinds[kind]})` : ""
    })
        .filter(Boolean)
        .join("; ")
    const linkCount = form.link.trim() ? 1 : 0
    const sheets = preview?.sheets ?? []
    return (
        <CsvImportWizardBase
            props={{
                gate:
                    wizard.isLoading || wizard.loadError !== null
                        ? { message: t("loading"), failure: wizard.loadError }
                        : null,
                title: t("title"),
                stepLabel: tw("stepOf", { n: wizard.index + 1, total: wizard.steps.length }),
                steps: wizard.steps.map((step) => copy.steps[step]),
                index: wizard.index,
                step: wizard.step,
                source: wizard.source,
                resumeLine:
                    saved === null
                        ? null
                        : [t("resumeFor", { name: saved.name }), saved.summary].filter(Boolean).join(" · "),
                isResume: props.resumeId !== undefined,
                isPending: wizard.isPending,
                canGoBack: wizard.canGoBack,
                form,
                link: form.link,
                paste: form.paste,
                entityOptions: copy.entities,
                sourceOptions: copy.sources,
                scheduleOptions: copy.schedules,
                fileChosen: wizard.file === null ? null : t("fileChosen", { name: wizard.file.name }),
                docsReady: wizard.docs.length > 0 || linkCount > 0,
                grid: {
                    columns: grid.columns.map((column, at) => {
                        const label = t("gridHeader", { n: at + 1 })
                        return { id: column.id, name: column.name, label, cellLabel: column.name.trim() || label }
                    }),
                    rows: grid.rows,
                    isFull: grid.rows.length >= MAX_GRID_ROWS,
                    text: {
                        title: copy.text.gridTitle,
                        addRow: copy.text.gridAddRow,
                        addColumn: copy.text.gridAddColumn,
                        remove: copy.text.gridRemove,
                        rows: t("gridRows", { n: format.number(grid.rows.length) }),
                        tooBig: copy.text.gridTooBig,
                    },
                },
                map:
                    preview === null || mapping === null
                        ? null
                        : {
                              missing: preview.missing.length
                                  ? t("mapMissing", { columns: preview.missing.join(", ") })
                                  : null,
                              intro: `${t("mapIntro")} ${t("previewTotal", { n: format.number(preview.total) })}`,
                              sheet:
                                  sheets.length > 1
                                      ? { value: preview.sheet, options: sheets.map((s) => ({ id: s, label: s })) }
                                      : null,
                              idOptions: [{ id: NO_COLUMN, label: t("mapRowNumber") }, ...headerOptions],
                              optionalOptions: [{ id: NO_COLUMN, label: t("mapNone") }, ...headerOptions],
                              values: {
                                  idColumn: mapping.idColumn ?? NO_COLUMN,
                                  titleColumn: mapping.titleColumn ?? NO_COLUMN,
                                  dateColumn: mapping.dateColumn ?? NO_COLUMN,
                              },
                              kinds: kindList ? t("mapKinds", { list: kindList }) : null,
                              headers: preview.headers,
                              sample: preview.sample,
                              text: copy.text,
                          },
                importIntro:
                    wizard.source === "document"
                        ? t("importIntroDocs", { n: wizard.docs.length + linkCount })
                        : t("importIntro", {
                              n: format.number(preview?.total ?? 0),
                              entity: copy.entityLabel(form.entity),
                          }),
                done:
                    result === null
                        ? null
                        : {
                              title: t(wizard.source === "document" ? "importDoneDocs" : "importDone", {
                                  added: format.number(result.added),
                                  updated: format.number(result.updated),
                              }),
                              description: t("importSummary", { summary: result.summary }),
                              skipped: result.skipped ? t("importSkipped", { n: result.skipped }) : null,
                          },
                note: wizard.note,
                agentStep: {
                    title: t("agentTitle"),
                    notice: null,
                    agents: agentChoicesOf(props.agents, "csv_import", tw),
                    value: wizard.agentIds,
                    hint: tw("agentHint"),
                    none: tw("agentNone"),
                },
                text: {
                    ...copy.text,
                    readNext: wizard.isPending ? t("reading") : copy.text.next,
                    importNow: wizard.isPending ? t("reading") : t("importRun"),
                },
            }}
            on={wizard.on}
        />
    )
}
