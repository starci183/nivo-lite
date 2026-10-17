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
import type { useSalesWorkbench } from "@/hooks/salesworkbench"
import type { SalesContract } from "@/modules/types"
import { Badge, Button, EmptyNotice, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SalesContractDrawer } from "@/components/composites/SalesContractDrawer"
import type { SalesContractDrawerProps } from "@/components/composites/SalesContractDrawer"
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
        readonly editLabel: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly note: string
        readonly rows: ReadonlyArray<ContractItemView>
        /** The contract drawer while it is open. */
        readonly drawer: SalesContractDrawerProps["props"] | null
    }
    readonly on: SalesContractDrawerProps["on"] & {
        readonly add: () => void
        readonly edit: (contractId: string) => void
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
                <Button variant="primary" size="sm" onPress={on.add}>
                    {p.addLabel}
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
                            <Button variant="outline" size="sm" onPress={() => on.edit(row.id)}>
                                {p.editLabel}
                            </Button>
                        }
                    />
                ))}
            </SurfaceListCard>
            {p.drawer === null ? null : <SalesContractDrawer props={p.drawer} on={on} />}
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
