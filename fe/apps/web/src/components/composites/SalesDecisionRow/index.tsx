import { Badge, Button, SurfaceCard, Text } from "@starci/grammar/common"
import { SalesDecisionFields } from "@/components/branches/SalesDecisionFields"
import { SalesRow } from "@/components/branches/SalesRow"

/** One data field NIVO is missing and the person fills in. */
interface MissingFieldView {
    readonly name: string
    readonly label: string
    readonly value: string
}

/** One pending decision, every word and flag already resolved. */
export interface DecisionRowView {
    readonly id: string
    readonly anchor: string
    readonly isFocused: boolean
    readonly badge: string
    readonly age: string
    readonly isStale: boolean
    readonly customer: string
    readonly leadHref: string | null
    readonly actionLabel: string
    readonly summary: string
    readonly reasonHint: string | null
    readonly amountLine: string | null
    readonly draft: string | null
    readonly canAct: boolean
    readonly assignedTo: string | null
    readonly missing: ReadonlyArray<MissingFieldView>
    readonly isEditing: boolean
    readonly draftValue: string
    readonly showDraftField: boolean
    readonly amountValue: string
    readonly showAmountField: boolean
    readonly canEdit: boolean
    /** True while a decision is in flight: every command waits. */
    readonly isBusy: boolean
    readonly isApproveBusy: boolean
    readonly isRejectBusy: boolean
    readonly isApproveDisabled: boolean
    readonly editLabel: string
    readonly error: string | null
}

/** The words every pending decision shares. */
export interface DecisionRowLabels {
    readonly draftLabel: string
    readonly waitingManager: string
    readonly amountLabel: string
    readonly approveLabel: string
    readonly rejectLabel: string
}

/** What a person can do with one pending decision; every argument is an atom. */
export interface DecisionRowActions {
    readonly field: (id: string, name: string, value: string) => void
    readonly draft: (id: string, value: string) => void
    readonly amount: (id: string, value: string) => void
    readonly toggleEdit: (id: string) => void
    readonly decide: (id: string, decision: "approved" | "rejected") => void
}

/** The pending decision to draw, the words every decision shares and what a person can do with it. */
interface SalesDecisionRowProps {
    readonly row: DecisionRowView
    readonly labels: DecisionRowLabels
    readonly on: DecisionRowActions
}

/** One pending sales decision: what NIVO proposes, the fields it misses, and approve, edit or reject for a person who may decide. */
export const SalesDecisionRow = (props: SalesDecisionRowProps) => {
    const { row, labels: l, on } = props
    return (
        <SalesRow
            id={row.anchor}
            isFocused={row.isFocused}
            chips={
                <>
                    <Badge tone="warning" isDot>
                        {row.badge}
                    </Badge>
                    <Text as="span" size="xs" tone="muted" weight={row.isStale ? "semibold" : "normal"}>
                        {row.age}
                    </Text>
                </>
            }
            customer={row.customer}
            customerHref={row.leadHref}
            actions={row.canAct ? renderSalesDecisionRowActions(row, on, l) : undefined}
        >
            <Text size="sm" weight="medium">
                {row.actionLabel}
            </Text>
            {row.summary === "" ? null : (
                <Text size="sm" tone="muted">
                    {row.summary}
                </Text>
            )}
            {row.reasonHint === null ? null : (
                <Text size="xs" tone="muted">
                    {row.reasonHint}
                </Text>
            )}
            {row.amountLine === null ? null : (
                <Text size="sm" weight="semibold">
                    {row.amountLine}
                </Text>
            )}
            {row.draft === null ? null : (
                <SurfaceCard depth="nested" ariaLabel={l.draftLabel}>
                    <Text size="xs" tone="muted" weight="medium">
                        {l.draftLabel}
                    </Text>
                    <Text as="p" size="sm">
                        {row.draft}
                    </Text>
                </SurfaceCard>
            )}
            {row.canAct && (row.missing.length > 0 || row.isEditing) ? renderSalesDecisionRowFields(row, l, on) : null}
            {row.error === null ? null : (
                <Text size="sm" live="assertive">
                    {row.error}
                </Text>
            )}
            {row.canAct ? null : (
                <Text size="sm" weight="medium" live="polite">
                    {l.waitingManager}
                </Text>
            )}
            {row.assignedTo === null ? null : (
                <Text size="xs" tone="muted">
                    {row.assignedTo}
                </Text>
            )}
        </SalesRow>
    )
}

/** Renders the SalesDecisionRow actions section. */
const renderSalesDecisionRowActions = (
    row: NonNullable<SalesDecisionRowProps["row"]>,
    on: NonNullable<SalesDecisionRowProps["on"]>,
    l: NonNullable<SalesDecisionRowProps["labels"]>,
) => (
    <>
        <Button
            variant="primary"
            size="sm"
            isPending={row.isApproveBusy}
            isDisabled={row.isApproveDisabled}
            onPress={() => on.decide(row.id, "approved")}
        >
            {l.approveLabel}
        </Button>
        {row.canEdit ? (
            <Button variant="outline" size="sm" isDisabled={row.isBusy} onPress={() => on.toggleEdit(row.id)}>
                {row.editLabel}
            </Button>
        ) : null}
        <Button
            variant="danger-soft"
            size="sm"
            isPending={row.isRejectBusy}
            isDisabled={row.isBusy}
            onPress={() => on.decide(row.id, "rejected")}
        >
            {l.rejectLabel}
        </Button>
    </>
)

/** Renders the SalesDecisionRow fields section. */
const renderSalesDecisionRowFields = (
    row: NonNullable<SalesDecisionRowProps["row"]>,
    l: NonNullable<SalesDecisionRowProps["labels"]>,
    on: NonNullable<SalesDecisionRowProps["on"]>,
) => (
    <SalesDecisionFields
        anchor={row.anchor}
        missing={row.missing}
        showDraftField={row.showDraftField}
        draftLabel={l.draftLabel}
        draftValue={row.draftValue}
        showAmountField={row.showAmountField}
        amountLabel={l.amountLabel}
        amountValue={row.amountValue}
        isBusy={row.isBusy}
        onField={(name, value) => on.field(row.id, name, value)}
        onDraft={(value) => on.draft(row.id, value)}
        onAmount={(value) => on.amount(row.id, value)}
    />
)
