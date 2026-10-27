import type { useFormatter, useTranslations } from "next-intl"
import type { useSalesContractForm } from "@/hooks/rhf"
import type { useSalesActions, vietnamDay } from "@/hooks/sales"
import type {
    ContractForm,
    contractDateOf,
    contractDaysLeft,
    isoDayText,
    CONTRACT_TONES,
    contractFormOf,
} from "@/hooks/salescontracts"
import type { ContractImport, ContractImportField } from "@/hooks/salescontracts"
import type { useSalesWorkbench } from "@/hooks/salesworkbench"
import type { SalesContract } from "@/modules/types"
import { Badge, Button, EmptyNotice, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SalesContractDrawer } from "@/components/composites/SalesContractDrawer"
import type { SalesContractDrawerProps } from "@/components/composites/SalesContractDrawer"
import { ContractImportDialog } from "@/components/composites/ContractImportDialog"
import type { ContractImportDialogProps, ContractImportRowView } from "@/components/composites/ContractImportDialog"
import { ACTIONS_CLASS_NAME } from "./classNames"

/** One recurring contract, every word already resolved. */
export interface ContractItemView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly when: { readonly text: string; readonly tone: BadgeTone } | null
}

/** The words and data of the contracts surface. */
export interface SalesContractsBaseProps {
    readonly props: {
        readonly label: string
        readonly intro: string
        readonly addLabel: string
        readonly importLabel: string
        readonly editLabel: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly note: string
        readonly rows: ReadonlyArray<ContractItemView>
        /** The contract drawer while it is open. */
        readonly drawer: SalesContractDrawerProps["props"] | null
        /** The bulk import dialog while it is open. */
        readonly importDialog: ContractImportDialogProps["props"] | null
    }
    readonly on: SalesContractDrawerProps["on"] & {
        readonly add: () => void
        readonly edit: (contractId: string) => void
        readonly openImport: () => void
        readonly importing: ContractImportDialogProps["on"]
    }
}

/** Surface 5: recurring contracts. The renewal automation reminds the customer (and sales) a number of days before the end date. */
export const SalesContractsBase = (props: SalesContractsBaseProps) => {
    const { props: p, on } = props
    return (
        <>
            <Text size="sm" tone="muted">
                {p.intro}
            </Text>
            <div className={ACTIONS_CLASS_NAME}>
                <Button intent="commit" size="sm" onPress={on.add}>
                    {p.addLabel}
                </Button>
                <Button intent="neutral" size="sm" onPress={on.openImport}>
                    {p.importLabel}
                </Button>
            </div>
            <Text size="sm" weight="medium" live="polite">
                {p.note}
            </Text>
            <SurfaceListCard
                ariaLabel={p.label}
                empty={<EmptyNotice message={p.emptyTitle} description={p.emptyBody} />}
            >
                {p.rows.map((row) => (
                    <ListRow
                        key={row.id}
                        title={row.title}
                        description={row.description}
                        badges={
                            <>
                                <Badge tone={row.statusTone} isDot>
                                    {row.statusLabel}
                                </Badge>
                                {row.when === null ? null : <Badge tone={row.when.tone}>{row.when.text}</Badge>}
                            </>
                        }
                        actions={
                            <Button intent="neutral" size="sm" onPress={() => on.edit(row.id)}>
                                {p.editLabel}
                            </Button>
                        }
                    />
                ))}
            </SurfaceListCard>
            {p.drawer === null ? null : <SalesContractDrawer props={p.drawer} on={on} />}
            {p.importDialog === null ? null : <ContractImportDialog props={p.importDialog} on={on.importing} />}
        </>
    )
}

/** Inputs already read by the connected contracts component. */
export type SalesContractsControllerInput = {
    readonly t: ReturnType<typeof useTranslations<"workbenchSales">>
    readonly format: ReturnType<typeof useFormatter>
    readonly actions: ReturnType<typeof useSalesActions>
    readonly data: ReturnType<typeof useSalesWorkbench>["data"]
    readonly nowIso: ReturnType<typeof useSalesWorkbench>["nowIso"]
    readonly contracts: NonNullable<NonNullable<ReturnType<typeof useSalesWorkbench>["data"]>["contracts"]>
    readonly leads: NonNullable<NonNullable<ReturnType<typeof useSalesWorkbench>["data"]>["leadOptions"]>
    readonly editing: SalesContract | null
    readonly setEditing: React.Dispatch<React.SetStateAction<SalesContract | null>>
    readonly isOpen: boolean
    readonly setOpen: React.Dispatch<React.SetStateAction<boolean>>
    readonly note: string
    readonly setNote: React.Dispatch<React.SetStateAction<string>>
    readonly today: ReturnType<typeof vietnamDay>
    readonly form: ReturnType<typeof useSalesContractForm>
}

/** Current form values and validation shown by the drawer. */
type ContractDrawerInput = SalesContractsControllerInput & {
    readonly values: ContractForm
    readonly error: string | null
    readonly isPending: boolean
}
/** Pure date and status vocabulary supplied by the connected owner. */
type ContractDrawerConfiguration = {
    readonly noLead: string
    readonly statusKeys: ReadonlyArray<ContractForm["status"]>
    readonly dateOf: typeof contractDateOf
}

/** Resolves an open contract drawer from the connected form snapshot. */
export const createContractDrawer = (
    { t, isOpen, editing, leads, values, error, isPending }: ContractDrawerInput,
    config: ContractDrawerConfiguration,
): SalesContractsBaseProps["props"]["drawer"] =>
    !isOpen
        ? null
        : {
              title: editing ? t("contractEditTitle") : t("contractAddTitle"),
              closeLabel: t("cancel"),
              saveLabel: t("save"),
              cancelLabel: t("cancel"),
              leadLabel: t("contractLead"),
              leadOptions: [
                  { id: config.noLead, label: t("contractLeadNone") },
                  ...leads.map((lead) => ({ id: lead.id, label: lead.name })),
              ],
              lead: values.leadId,
              customerLabel: t("contractCustomer"),
              customer: values.customerName,
              planLabel: t("contractPlan"),
              planHint: t("contractPlanHint"),
              plan: values.plan,
              startLabel: t("contractStart"),
              start: config.dateOf(values.startsOn),
              endLabel: t("contractEnd"),
              endHint: t("contractEndHint"),
              end: config.dateOf(values.endsOn),
              amountLabel: t("contractAmount"),
              amount: values.amount,
              statusLabel: t("contractStatus"),
              statusOptions: config.statusKeys.map((status) => ({
                  id: status,
                  label: t(`contractStatus_${status}`),
              })),
              status: values.status,
              noteLabel: t("contractNote"),
              note: values.note,
              error,
              isPending,
              canSave: values.customerName.trim() !== "" && values.endsOn.trim() !== "",
          }

/** Pure vocabulary for contract rows and form reset values. */
type ContractStateVocabulary = {
    readonly contractDaysLeft: typeof contractDaysLeft
    readonly isoDayText: typeof isoDayText
    readonly contractTones: typeof CONTRACT_TONES
    readonly contractFormOf: typeof contractFormOf
}

const SOON_DAYS = 14

/** Builds row presentation and drawer commands from a connected snapshot. */
export const createSalesContractsState = (
    input: SalesContractsControllerInput,
    vocabulary: ContractStateVocabulary,
) => {
    const { t, format, actions, setEditing, setOpen, today, form } = input

    const values = form.watch()
    const errors = form.formState.errors
    const error =
        errors.customerName?.message ??
        errors.startsOn?.message ??
        errors.endsOn?.message ??
        errors.amount?.message ??
        errors.status?.message ??
        errors.plan?.message ??
        errors.note?.message ??
        null
    const isPending = actions.isMutating || form.formState.isSubmitting

    const whenOf = (contract: SalesContract): ContractItemView["when"] => {
        if (contract.status !== "active") return null
        const left = vocabulary.contractDaysLeft(contract.ends_on, today)
        if (left < 0) return { text: t("contractOverdue", { n: -left }), tone: "danger" }
        if (left === 0) return { text: t("contractToday"), tone: "warning" }
        return { text: t("contractInDays", { n: left }), tone: left <= SOON_DAYS ? "warning" : "neutral" }
    }
    const itemOf = (contract: SalesContract): ContractItemView => ({
        id: contract.id,
        title: contract.customer_name,
        description: [
            contract.plan,
            `${vocabulary.isoDayText(contract.starts_on)} - ${vocabulary.isoDayText(contract.ends_on)}`,
            contract.amount_vnd != null
                ? format.number(contract.amount_vnd, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
                : "",
        ]
            .filter(Boolean)
            .join(" · "),
        statusLabel: t(`contractStatus_${contract.status}`),
        statusTone: vocabulary.contractTones[contract.status],
        when: whenOf(contract),
    })

    const open = (contract: SalesContract | null) => {
        setEditing(contract)
        form.reset(vocabulary.contractFormOf(contract, today))
        setOpen(true)
    }
    const close = () => setOpen(false)
    return { ...input, values, error, isPending, itemOf, open, close }
}

/** The select value that leaves a contract field without a column. */
export const NO_IMPORT_COLUMN = "__none__"

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

/** Resolves one previewed row: its number and customer, plan, the days it has (a missing one leaves no dangling dash), amount, status and problems. */
const contractImportRowOf = (
    { t, format }: Pick<SalesContractsControllerInput, "t" | "format">,
    vocabulary: ContractImportVocabulary,
    row: PreviewedRow,
): ContractImportRowView => {
    const status = vocabulary.statusOf(row.status)
    return {
        id: String(row.row),
        title: `${t("contractImportRow", { row: row.row })} · ${row.customerName}`,
        description: [
            row.plan,
            [row.startsOn, row.endsOn]
                .filter((day): day is string => Boolean(day))
                .map(vocabulary.isoDayText)
                .join(" - "),
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
    input: Pick<SalesContractsControllerInput, "t" | "format">,
    importer: ContractImport,
    vocabulary: ContractImportVocabulary,
): ContractImportDialogProps["props"] | null => {
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
