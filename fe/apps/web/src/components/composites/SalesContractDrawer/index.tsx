import type { CalendarDate, DateValue } from "@internationalized/date"
import { DatePicker, Input, Select, Textarea } from "@starci/grammar/common"
import { FormDrawer } from "@/components/branches/FormDrawer"

/** The words and state of the contract drawer. */
export interface SalesContractDrawerProps {
    readonly props: {
        readonly title: string
        readonly closeLabel: string
        readonly saveLabel: string
        readonly cancelLabel: string
        readonly leadLabel: string
        readonly leadOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly lead: string
        readonly customerLabel: string
        readonly customer: string
        readonly planLabel: string
        readonly planHint: string
        readonly plan: string
        readonly startLabel: string
        readonly start: CalendarDate | null
        readonly endLabel: string
        readonly endHint: string
        readonly end: CalendarDate | null
        readonly amountLabel: string
        readonly amount: string
        readonly statusLabel: string
        readonly statusOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly status: string
        readonly noteLabel: string
        readonly note: string
        readonly error: string | null
        readonly isPending: boolean
        readonly canSave: boolean
    }
    readonly on: {
        readonly lead: (value: string) => void
        readonly customer: (value: string) => void
        readonly plan: (value: string) => void
        readonly start: (value: DateValue | null) => void
        readonly end: (value: DateValue | null) => void
        readonly amount: (value: string) => void
        readonly status: (value: string) => void
        readonly note: (value: string) => void
        readonly submit: () => void
        readonly close: () => void
    }
}

/** Add or edit a recurring contract; dates are picked with the grammar date picker. */
export const SalesContractDrawer = (props: SalesContractDrawerProps) => {
    const { props: p, on } = props
    return (
        <FormDrawer
            isOpen
            title={p.title}
            closeLabel={p.closeLabel}
            saveLabel={p.saveLabel}
            cancelLabel={p.cancelLabel}
            error={p.error}
            isPending={p.isPending}
            canSave={p.canSave}
            onSubmit={on.submit}
            onClose={on.close}
        >
            <Select
                label={p.leadLabel}
                value={p.lead}
                options={p.leadOptions}
                onValueChange={(value) => on.lead(value ?? "")}
            />
            <Input
                id="contract-customer"
                name="customer"
                label={p.customerLabel}
                value={p.customer}
                onValueChange={on.customer}
                isRequired
            />
            <Input
                id="contract-plan"
                name="plan"
                label={p.planLabel}
                hint={p.planHint}
                value={p.plan}
                onValueChange={on.plan}
            />
            <DatePicker name="startsOn" label={p.startLabel} value={p.start} onValueChange={on.start} isRequired />
            {renderSalesContractDrawerEndDate(p, on)}
            <Input
                id="contract-amount"
                name="amount"
                label={p.amountLabel}
                value={p.amount}
                onValueChange={on.amount}
            />
            <Select
                label={p.statusLabel}
                value={p.status}
                options={p.statusOptions}
                onValueChange={(value) => on.status(value ?? "active")}
            />
            <Textarea id="contract-note" label={p.noteLabel} rows={2} value={p.note} onValueChange={on.note} />
        </FormDrawer>
    )
}

/** Renders the SalesContractDrawer end date section. */
const renderSalesContractDrawerEndDate = (p: SalesContractDrawerProps["props"], on: SalesContractDrawerProps["on"]) => (
    <DatePicker
        name="endsOn"
        label={p.endLabel}
        description={p.endHint}
        value={p.end}
        {...(p.start === null ? {} : { minValue: p.start })}
        onValueChange={on.end}
        isRequired
    />
)
