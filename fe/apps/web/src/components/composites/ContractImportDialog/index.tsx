import type { useFormatter, useTranslations } from "next-intl"
import type { CONTRACT_TONES, ContractImport, ContractImportField, isoDayText } from "@/hooks/salescontracts"
import type { ContractImportDialogEvents, ContractImportDialogView, ContractImportRowView } from "@/modules/types"

export { ContractImportDialog } from "./component"

/** The words, state and commands of the bulk contract import dialog. */
export interface ContractImportDialogProps {
    readonly props: ContractImportDialogView
    readonly on: ContractImportDialogEvents
}

/** The select value that leaves a contract field without a column. */
const NO_IMPORT_COLUMN = "__none__"

const FIELD_LABEL_KEYS = {
    customerName: "contractCustomer",
    plan: "contractPlan",
    startsOn: "contractStart",
    endsOn: "contractEnd",
    amountVnd: "contractAmount",
    status: "contractStatus",
    note: "contractNote",
} as const satisfies Record<ContractImportField, string>

const PROBLEM_KEYS = {
    customerMissing: "contractImportProblemCustomerMissing",
    endsOnMissing: "contractImportProblemEndsOnMissing",
    endsOnInvalid: "contractImportProblemEndsOnInvalid",
    startsOnInvalid: "contractImportProblemStartsOnInvalid",
    datesReversed: "contractImportProblemDatesReversed",
    amountInvalid: "contractImportProblemAmountInvalid",
    duplicate: "contractImportProblemDuplicate",
    startsOnDerived: "contractImportProblemStartsOnDerived",
} as const

const isKnownProblem = (code: string): code is keyof typeof PROBLEM_KEYS => Object.hasOwn(PROBLEM_KEYS, code)

/** Pure vocabulary the import dialog is drawn with. */
type ContractImportVocabulary = {
    readonly fields: ReadonlyArray<ContractImportField>
    readonly isoDayText: typeof isoDayText
    readonly contractTones: typeof CONTRACT_TONES
    readonly statusOf: (value: string) => keyof typeof CONTRACT_TONES
}

/** One previewed row as the back end answers it. */
type PreviewedRow = NonNullable<ContractImport["state"]["preview"]>["rows"][number]

/** The translator and formatter the import dialog is resolved with. */
type ContractImportWords = {
    readonly t: ReturnType<typeof useTranslations<"workbenchSales">>
    readonly format: ReturnType<typeof useFormatter>
}

/** Resolves one previewed row: its number and customer, plan, the days it has (a missing one leaves no dangling dash), amount, status and problems. */
const contractImportRowOf = (
    { t, format }: ContractImportWords,
    vocabulary: ContractImportVocabulary,
    row: PreviewedRow,
): ContractImportRowView => {
    const status = vocabulary.statusOf(row.status)
    return {
        id: String(row.row),
        title: `${t("contractImportRow", { row: row.row })} · ${row.customerName}`,
        description: [
            row.plan,
            [row.startsOn, row.endsOn].flatMap((day) => (day ? [vocabulary.isoDayText(day)] : [])).join(" - "),
            row.amountVnd == null
                ? ""
                : format.number(row.amountVnd, { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
        ]
            .filter(Boolean)
            .join(" · "),
        statusLabel: t(`contractStatus_${status}`),
        statusTone: vocabulary.contractTones[status],
        problems: row.problems.map((code) =>
            isKnownProblem(code)
                ? { label: t(PROBLEM_KEYS[code]), tone: code === "startsOnDerived" ? "warning" : "danger" }
                : { label: t("contractImportProblemOther", { code }), tone: "danger" },
        ),
    }
}

/** Resolves the open import dialog from the import state: words, column pickers and the previewed rows. */
export const createContractImportDialog = (
    input: ContractImportWords,
    importer: ContractImport,
    vocabulary: ContractImportVocabulary,
): ContractImportDialogView | null => {
    const { t } = input
    const { state } = importer
    if (!state.isOpen) return null
    const { preview, mapping } = state
    return {
        text: {
            title: t("contractImportTitle"),
            intro: t("contractImportIntro"),
            close: t("cancel"),
            cancel: t("cancel"),
            source: t("contractImportSource"),
            fileLabel: t("contractImportFileLabel"),
            filePrompt: t("contractImportFilePrompt"),
            pasteLabel: t("contractImportPasteLabel"),
            pasteHint: t("contractImportPasteHint"),
            preview: t("contractImportPreview"),
            sheet: t("contractImportSheet"),
            mapping: t("contractImportMapping"),
        },
        source: state.source,
        sourceOptions: [
            { id: "file", label: t("contractImportSourceFile") },
            { id: "paste", label: t("contractImportSourcePaste") },
        ],
        fileName: state.file?.name ?? null,
        paste: state.paste,
        sheets:
            preview === null || preview.sheets.length < 2
                ? null
                : preview.sheets.map((sheet) => ({ id: sheet, label: sheet })),
        sheet: preview?.sheet ?? "",
        columns:
            mapping === null
                ? null
                : vocabulary.fields.map((field) => ({
                      field,
                      label: t(FIELD_LABEL_KEYS[field]),
                      column: mapping[field] ?? NO_IMPORT_COLUMN,
                  })),
        columnOptions: [
            { id: NO_IMPORT_COLUMN, label: t("contractImportNoColumn") },
            ...(preview?.headers ?? []).map((header) => ({ id: header, label: header })),
        ],
        summary:
            preview === null
                ? null
                : [
                      t("contractImportSummary", { total: preview.total, ready: preview.ready }),
                      preview.total > preview.rows.length ? t("contractImportShowing", { n: preview.rows.length }) : "",
                  ]
                      .filter(Boolean)
                      .join(" "),
        rows: (preview?.rows ?? []).map((row) => contractImportRowOf(input, vocabulary, row)),
        confirmLabel:
            preview === null ? t("contractImportConfirmIdle") : t("contractImportConfirm", { n: preview.ready }),
        canConfirm: preview !== null && preview.ready > 0,
        isPreviewing: importer.isPreviewing,
        isImporting: importer.isImporting,
        error: state.error,
    }
}

/** The dialog commands over the import state; the "no column" choice clears the field. */
export const contractImportEvents = (importer: ContractImport): ContractImportDialogEvents => ({
    source: importer.source,
    file: importer.file,
    paste: importer.paste,
    preview: importer.preview,
    sheet: importer.sheet,
    column: (field, column) => importer.column(field, column === NO_IMPORT_COLUMN ? null : column),
    confirm: importer.runImport,
    close: importer.close,
})
