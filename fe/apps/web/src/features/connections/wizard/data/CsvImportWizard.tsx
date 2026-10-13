"use client"

import { useState } from "react"
import {
    Alert,
    Button,
    DataTable,
    FileDropzone,
    Input,
    RadioGroup,
    Select,
    Text,
    Textarea,
} from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connectorCsv } from "@/i18n/dict/connectorCsv"
import { useSetConnectionAgents } from "@/hooks/connections"
import {
    MAX_FILE_BYTES,
    NO_COLUMN,
    SCHEDULES,
    TABLE_ENTITIES,
    useCsvImportCommands,
    useCsvImportResume,
} from "@/hooks/csv-import-wizard"
import type {
    CsvEntity,
    CsvImportResult,
    CsvMapping,
    CsvPreview,
    CsvSavedImport,
    CsvSource,
    CsvSourceArg,
} from "@/hooks/csv-import-wizard"
import { useCsvImportForm } from "@/hooks/rhf"
import { AgentStep } from "../AgentStep"
import { FIELDS_CLASS } from "../classNames"
import { WizardFrame } from "../WizardFrame"
import { emptyGrid, gridFromText, gridHasRows, MAX_GRID_ROWS, type Grid } from "./csv/grid"
import { GridEditor } from "./csv/GridEditor"
import {
    STARTER_KEY,
    starterColumns,
    DOC_STEPS,
    ENTITY_KEY,
    SCHEDULE_KEY,
    SOURCES,
    SOURCE_KEY,
    TABLE_STEPS,
    entityOf,
} from "./csv/csv-options"
import type { Note, Step } from "./csv/csv-options"
import type { DataWizardProps } from "./types"

/**
 * Setup of a csv_import data connection (owner only): name and kind of rows, the source (file, Google Sheets link, typed or pasted
 * table, documents), the column mapping with a preview, the import itself, and the agents that may read it. Every file is parsed by
 * the back end over GraphQL. With `resumeId` it adds more data to an existing import and reuses the saved mapping.
 */
const savedColumns = (saved: CsvSavedImport | null, starter: (kind: keyof typeof STARTER_KEY) => string): ReadonlyArray<string> => {
    if (saved === null) return starterColumns(starter("customer"))
    return saved.config.columns.length ? saved.config.columns : starterColumns(starter("other"))
}

/** Props of the wizard body: the wizard props plus the saved import being resumed. */
type CsvImportWizardBodyProps = DataWizardProps & { readonly saved: CsvSavedImport | null }

const CsvImportWizardBody = ({ agents, resumeId, onClose, saved }: CsvImportWizardBodyProps) => {
    const setConnectionAgents = useSetConnectionAgents()
    const t = useT(connectorCsv)
    const commands = useCsvImportCommands()
    const form = useCsvImportForm({
        entity: saved && saved.config.entity !== "document" ? saved.config.entity : "customer",
        schedule: saved?.scheduleMinutes ? String(saved.scheduleMinutes) : "",
    })
    const [source, setSource] = useState<CsvSource>(saved?.config.source ?? "file")
    const name = form.watch("name")
    const schedule = form.watch("schedule")
    const entity = entityOf(form.watch("entity"))
    const setEntity = (value: Exclude<CsvEntity, "document">) => form.setValue("entity", value)
    const [file, setFile] = useState<File | null>(null)
    const [link, setLink] = useState(saved?.config.link ?? "")
    const [paste, setPaste] = useState("")
    const [grid, setGrid] = useState<Grid>(() =>
        emptyGrid(savedColumns(saved, (kind) => t(STARTER_KEY[kind]))),
    )
    const [docs, setDocs] = useState<ReadonlyArray<File>>([])
    const [preview, setPreview] = useState<CsvPreview | null>(null)
    const [mapping, setMapping] = useState<CsvMapping | null>(null)
    const [result, setResult] = useState<CsvImportResult | null>(null)
    const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>(
        saved?.agentIds.length ? saved.agentIds : agents.map((a) => a.id),
    )
    const [note, setNote] = useState<Note | null>(null)
    const [index, setIndex] = useState(saved ? 1 : 0)
    const [isPending, setPending] = useState(false)

    const steps = source === "document" ? DOC_STEPS : TABLE_STEPS
    const step = steps[index]
    const labels: Record<Step, string> = {
        source: t("stepSource"),
        data: t("stepData"),
        docs: t("stepDocs"),
        map: t("stepMap"),
        import: t("stepImport"),
        agent: t("stepAgent"),
    }
    const connectionId = resumeId ?? result?.connectionId
    const fail = (text: string) => setNote({ tone: "negative", text })
    const go = (to: number) => {
        setNote(null)
        setIndex(to)
    }

    /* ---- the chosen source as the back end reads it (it parses everything) */
    const sourceArg = (extra?: { sheet?: string }): CsvSourceArg | null => {
        const base = { entity, ...(connectionId ? { connectionId } : {}) }
        if (source === "file") {
            if (!file) {
                fail(t("needFile"))
                return null
            }
            if (file.size > MAX_FILE_BYTES) {
                fail(t("tooBig"))
                return null
            }
            const sheet = extra?.sheet ?? preview?.sheet
            return { ...base, kind: "file", file, ...(sheet ? { sheet } : {}) }
        }
        if (source === "sheet") {
            if (!link.trim()) {
                fail(t("needLink"))
                return null
            }
            return { ...base, kind: "sheet", link: link.trim() }
        }
        if (!gridHasRows(grid)) {
            fail(t("needSheetEmpty"))
            return null
        }
        return { ...base, kind: "grid", grid: { headers: grid.headers, rows: grid.rows } }
    }

    const read = async (extra?: { sheet?: string }) => {
        const arg = sourceArg(extra)
        if (!arg) return
        setPending(true)
        const r = await commands.preview(arg)
        setPending(false)
        if (r.kind !== "ok") return fail(r.message)
        setPreview(r.value)
        setMapping(r.value.mapping)
        go(2)
    }

    const runImport = async () => {
        let r
        setPending(true)
        if (source === "document") {
            if (docs.reduce((sum, d) => sum + d.size, 0) > MAX_FILE_BYTES) {
                setPending(false)
                return fail(t("tooBig"))
            }
            r = await commands.runDocuments({
                name,
                ...(connectionId ? { connectionId } : {}),
                files: docs,
                link: link.trim(),
            })
        } else {
            const arg = sourceArg()
            if (!arg || !mapping) return setPending(false)
            r = await commands.runImport(arg, {
                name,
                mapping,
                schedule: source === "sheet" && schedule ? Number(schedule) : null,
            })
        }
        setPending(false)
        if (r.kind !== "ok") return fail(r.message)
        setResult(r.value)
        setNote(null)
    }

    const finish = async () => {
        if (!result && !resumeId) return onClose(false)
        const id = result?.connectionId ?? resumeId
        if (!id) return onClose(false)
        setPending(true)
        const r = await setConnectionAgents(id, agentIds)
        setPending(false)
        if (r.kind !== "ok") return fail(r.message)
        onClose(true)
    }

    const chooseEntity = (v: string | null) => {
        const e = entityOf(v ?? "")
        setEntity(e)
        if (!resumeId && !gridHasRows(grid)) setGrid(emptyGrid(starterColumns(t(STARTER_KEY[e]))))
    }

    const usePaste = () => {
        const g = gridFromText(paste)
        if (!g) return
        setGrid({ headers: g.headers, rows: g.rows.slice(0, MAX_GRID_ROWS) })
        setPaste("")
    }

    const close = () => onClose(result !== null)

    /* ---- footer */
    const back = (
        <Button variant="outline" isDisabled={isPending} onPress={() => go(index - 1)}>
            {t("back")}
        </Button>
    )
    const minIndex = resumeId ? 1 : 0
    const backOrNone = index > minIndex && !result ? back : null
    const footer = (() => {
        if (step === "source")
            return (
                <>
                    <Button variant="primary" isDisabled={name.trim().length < 2} onPress={() => go(1)}>
                        {t("next")}
                    </Button>
                    <Button variant="ghost" onPress={close}>
                        {t("close")}
                    </Button>
                </>
            )
        if (step === "data")
            return (
                <>
                    <Button variant="primary" isPending={isPending} onPress={() => void read()}>
                        {isPending ? t("reading") : t("next")}
                    </Button>
                    {backOrNone}
                    {resumeId ? (
                        <Button variant="ghost" onPress={close}>
                            {t("close")}
                        </Button>
                    ) : null}
                </>
            )
        if (step === "docs")
            return (
                <>
                    <Button
                        variant="primary"
                        isDisabled={docs.length === 0 && !link.trim()}
                        onPress={() => go(index + 1)}
                    >
                        {t("next")}
                    </Button>
                    {backOrNone}
                    {resumeId ? (
                        <Button variant="ghost" onPress={close}>
                            {t("close")}
                        </Button>
                    ) : null}
                </>
            )
        if (step === "map")
            return (
                <>
                    <Button variant="primary" isPending={isPending} onPress={() => go(3)}>
                        {t("next")}
                    </Button>
                    {backOrNone}
                </>
            )
        if (step === "import") {
            return result ? (
                <Button variant="primary" onPress={() => go(index + 1)}>
                    {t("next")}
                </Button>
            ) : (
                <>
                    <Button variant="primary" isPending={isPending} onPress={() => void runImport()}>
                        {isPending ? t("reading") : t("importRun")}
                    </Button>
                    {backOrNone}
                </>
            )
        }
        return (
            <>
                <Button variant="primary" isPending={isPending} onPress={() => void finish()}>
                    {t("done")}
                </Button>
            </>
        )
    })()

    const idOptions = preview
        ? [{ id: NO_COLUMN, label: t("mapRowNumber") }, ...preview.headers.map((h) => ({ id: h, label: h }))]
        : []
    const optional = preview
        ? [{ id: NO_COLUMN, label: t("mapNone") }, ...preview.headers.map((h) => ({ id: h, label: h }))]
        : []
    const kindList = mapping
        ? (["phone", "email", "number", "date"] as const)
              .map((k) => {
                  const cols = Object.entries(mapping.kinds)
                      .filter(([, v]) => v === k)
                      .map(([h]) => h)
                  return cols.length
                      ? `${cols.join(", ")} (${t(`kind${k[0].toUpperCase()}${k.slice(1)}` as "kindPhone")})`
                      : ""
              })
              .filter(Boolean)
              .join("; ")
        : ""
    const doneKey = source === "document" ? "importDoneDocs" : "importDone"

    return (
        <WizardFrame title={t("title")} steps={steps.map((s) => labels[s])} index={index} footer={footer}>
            {saved ? (
                <Text size="sm" tone="muted">
                    {t("resumeFor", { name: saved.name })}
                    {saved.summary ? ` · ${saved.summary}` : ""}
                </Text>
            ) : null}

            {step === "source" ? (
                <>
                    <div className={FIELDS_CLASS}>
                        <Input
                            id="csv-name"
                            name="name"
                            label={t("fieldName")}
                            variant="secondary"
                            hint={t("fieldNameHint")}
                            isDisabled={isPending}
                            value={name}
                            onValueChange={(v) => form.setValue("name", v, { shouldValidate: true })}
                        />
                        {source !== "document" ? (
                            <Select
                                label={t("fieldEntity")}
                                variant="secondary"
                                isDisabled={isPending}
                                value={entity}
                                options={TABLE_ENTITIES.map((e) => ({
                                    id: e,
                                    label: t(ENTITY_KEY[e as keyof typeof ENTITY_KEY]),
                                }))}
                                onValueChange={chooseEntity}
                            />
                        ) : null}
                    </div>
                    <RadioGroup
                        variant="secondary"
                        label={t("fieldSource")}
                        isDisabled={isPending}
                        value={source}
                        onValueChange={(v) =>
                            setSource((SOURCES as ReadonlyArray<string>).includes(v) ? (v as CsvSource) : "file")
                        }
                        options={SOURCES.map((s) => ({
                            value: s,
                            label: t(SOURCE_KEY[s][0]),
                            description: t(SOURCE_KEY[s][1]),
                        }))}
                    />
                </>
            ) : null}

            {step === "data" && source === "file" ? (
                <>
                    <FileDropzone
                        label={t("fileLabel")}
                        accept=".csv,.tsv,.txt,.xlsx"
                        prompt={t("filePrompt")}
                        isDisabled={isPending}
                        hideFileList
                        onFilesChange={(files) => {
                            setFile(files[0] ?? null)
                            setPreview(null)
                        }}
                    />
                    {file ? <Text size="sm">{t("fileChosen", { name: file.name })}</Text> : null}
                </>
            ) : null}

            {step === "data" && source === "sheet" ? (
                <>
                    <Input
                        id="csv-link"
                        name="link"
                        label={t("linkSheetLabel")}
                        variant="secondary"
                        hint={t("linkSheetHint")}
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        isDisabled={isPending}
                        value={link}
                        onValueChange={setLink}
                    />
                </>
            ) : null}

            {step === "data" && source === "manual" ? (
                <>
                    <Textarea
                        label={t("pasteLabel")}
                        description={t("pasteHint")}
                        variant="secondary"
                        rows={4}
                        isDisabled={isPending}
                        value={paste}
                        onValueChange={setPaste}
                    />
                    <div>
                        <Button variant="outline" isDisabled={isPending || !paste.trim()} onPress={usePaste}>
                            {t("pasteUse")}
                        </Button>
                    </div>
                    <GridEditor grid={grid} onChange={setGrid} isDisabled={isPending} />
                </>
            ) : null}

            {step === "docs" ? (
                <>
                    <FileDropzone
                        label={t("docsLabel")}
                        accept=".docx,.pdf,.txt,.md"
                        multiple
                        prompt={t("docsPrompt")}
                        description={t("docsNote")}
                        isDisabled={isPending}
                        onFilesChange={(files) => setDocs(files)}
                    />
                    <Text size="sm" tone="muted">
                        {t("docsOr")}
                    </Text>
                    <Input
                        id="csv-doc-link"
                        name="doclink"
                        label={t("linkDocLabel")}
                        variant="secondary"
                        hint={t("linkDocHint")}
                        placeholder="https://docs.google.com/document/d/..."
                        isDisabled={isPending}
                        value={link}
                        onValueChange={setLink}
                    />
                </>
            ) : null}

            {step === "map" && preview && mapping ? (
                <>
                    {preview.missing.length ? (
                        <Alert tone="cautionary" title={t("mapMissing", { columns: preview.missing.join(", ") })} />
                    ) : null}
                    <Text size="sm" tone="muted">
                        {t("mapIntro")} {t("previewTotal", { n: preview.total.toLocaleString("vi-VN") })}
                    </Text>
                    {preview.sheets.length > 1 ? (
                        <Select
                            label={t("sheetLabel")}
                            variant="secondary"
                            isDisabled={isPending}
                            value={preview.sheet}
                            options={preview.sheets.map((s) => ({ id: s, label: s }))}
                            onValueChange={(v) => {
                                if (v) void read({ sheet: v })
                            }}
                        />
                    ) : null}
                    <div className={FIELDS_CLASS}>
                        <Select
                            label={t("mapId")}
                            variant="secondary"
                            isDisabled={isPending}
                            value={mapping.idColumn ?? NO_COLUMN}
                            options={idOptions}
                            onValueChange={(v) =>
                                setMapping({ ...mapping, idColumn: !v || v === NO_COLUMN ? null : v })
                            }
                        />
                        <Select
                            label={t("mapTitle")}
                            variant="secondary"
                            isDisabled={isPending}
                            value={mapping.titleColumn ?? NO_COLUMN}
                            options={optional}
                            onValueChange={(v) =>
                                setMapping({ ...mapping, titleColumn: !v || v === NO_COLUMN ? null : v })
                            }
                        />
                        <Select
                            label={t("mapDate")}
                            variant="secondary"
                            isDisabled={isPending}
                            value={mapping.dateColumn ?? NO_COLUMN}
                            options={optional}
                            onValueChange={(v) =>
                                setMapping({ ...mapping, dateColumn: !v || v === NO_COLUMN ? null : v })
                            }
                        />
                    </div>
                    <Text size="xs" tone="muted">
                        {t("mapIdHint")}
                    </Text>
                    {kindList ? (
                        <Text size="xs" tone="muted">
                            {t("mapKinds", { list: kindList })}
                        </Text>
                    ) : null}
                    <DataTable
                        label={t("previewLabel")}
                        columns={preview.headers.map((h, i) => ({ id: String(i), label: h, isRowHeader: i === 0 }))}
                        rows={preview.sample.map((cells, i) => ({ id: String(i), cells }))}
                        renderCell={(row, col) => row.cells[Number(col)] ?? ""}
                        maxBlockSize="20rem"
                        emptyContent={
                            <Text size="sm" tone="muted">
                                {t("previewEmpty")}
                            </Text>
                        }
                    />
                </>
            ) : null}

            {step === "import" ? (
                <>
                    <Text size="sm">
                        {source === "document"
                            ? t("importIntroDocs", { n: docs.length + (link.trim() ? 1 : 0) })
                            : t("importIntro", {
                                  n: (preview?.total ?? 0).toLocaleString("vi-VN"),
                                  entity: t(ENTITY_KEY[entity as keyof typeof ENTITY_KEY]),
                              })}
                    </Text>
                    {source === "sheet" ? (
                        <Select
                            label={t("importScheduleLabel")}
                            variant="secondary"
                            isDisabled={isPending || result !== null}
                            value={schedule}
                            options={SCHEDULES.map((s) => ({
                                id: s ? String(s) : "",
                                label: t(SCHEDULE_KEY[(s ? String(s) : "") as keyof typeof SCHEDULE_KEY]),
                            }))}
                            onValueChange={(v) => form.setValue("schedule", v ?? "")}
                        />
                    ) : null}
                    {result ? (
                        <>
                            <Alert
                                tone="affirmative"
                                title={t(doneKey, {
                                    added: result.added.toLocaleString("vi-VN"),
                                    updated: result.updated.toLocaleString("vi-VN"),
                                })}
                                description={t("importSummary", { summary: result.summary })}
                            />
                            {result.skipped ? (
                                <Alert tone="informative" title={t("importSkipped", { n: result.skipped })} />
                            ) : null}
                        </>
                    ) : null}
                </>
            ) : null}

            {step === "agent" ? (
                <AgentStep agents={agents} value={agentIds} onValue={setAgentIds} isDisabled={isPending} />
            ) : null}

            {note ? <Alert tone={note.tone} title={note.text} /> : null}
        </WizardFrame>
    )
}

/** Loads the saved import first when resuming, then hands it to the wizard so every field starts from it. */
export const CsvImportWizard = (props: DataWizardProps) => {
    const t = useT(connectorCsv)
    const resume = useCsvImportResume(props.resumeId)
    if (resume.isLoading)
        return (
            <Text size="sm" tone="muted" live="polite">
                {t("loading")}
            </Text>
        )
    if (resume.error !== undefined)
        return (
            <>
                <Alert tone="negative" title={resume.error} />
                <Button variant="ghost" onPress={() => props.onClose(false)}>
                    {t("close")}
                </Button>
            </>
        )
    return <CsvImportWizardBody {...props} saved={resume.saved} />
}
