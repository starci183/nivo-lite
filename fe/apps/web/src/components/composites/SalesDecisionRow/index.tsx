import { Badge, Button, Quote, Stack, Text } from "@starci/grammar/common"
import { SalesDecisionFields } from "@/components/branches/SalesDecisionFields"
import { SalesRow } from "@/components/branches/SalesRow"

import type { DecisionRowView, DecisionRowLabels, DecisionRowActions } from "@/modules/types"

/** The pending decision to draw, the words every decision shares and what a person can do with it. */
interface SalesDecisionRowProps {
    readonly row: DecisionRowView
    readonly labels: DecisionRowLabels
    readonly on: DecisionRowActions
    readonly isLoading?: boolean
}

/** One pending sales decision: what NIVO proposes, the fields it misses, and approve, edit or reject for a person who may decide. */
export const SalesDecisionRow = (props: SalesDecisionRowProps) => {
    const { row, labels: l, on } = props
    return (
        <SalesRow
            {...{
                id: row.anchor,
                chips: (
                    <>
                        <Badge tone="warning" isDot isLoading={props.isLoading === true}>
                            {row.badge}
                        </Badge>
                        <Text
                            as="span"
                            size="xs"
                            tone="muted"
                            isStrong={row.isStale}
                            isLoading={props.isLoading === true}
                        >
                            {row.age}
                        </Text>
                    </>
                ),

                actions: row.canAct ? renderSalesDecisionRowActions(row, on, l, props.isLoading) : undefined,
                body: <SalesDecisionBody {...props} />,
            }}
        />
    )
}

/** Renders the SalesDecisionRow actions section. */
const renderSalesDecisionRowActions = (
    row: NonNullable<SalesDecisionRowProps["row"]>,
    on: NonNullable<SalesDecisionRowProps["on"]>,
    l: NonNullable<SalesDecisionRowProps["labels"]>,
    isLoading?: boolean,
) => (
    <>
        <Button
            intent="commit"
            size="sm"
            isPending={row.isApproveBusy}
            isLoading={isLoading === true}
            isDisabled={row.isApproveDisabled}
            onPress={() => on.decide(row.id, "approved")}
        >
            {l.approveLabel}
        </Button>
        {row.canEdit ? (
            <Button
                intent="neutral"
                size="sm"
                isLoading={isLoading === true}
                isDisabled={row.isBusy}
                onPress={() => on.toggleEdit(row.id)}
            >
                {row.editLabel}
            </Button>
        ) : null}
        <Button
            intent="destructive"
            step="entry"
            size="sm"
            isPending={row.isRejectBusy}
            isLoading={isLoading === true}
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
    isLoading?: boolean,
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
        isLoading={isLoading === true}
        onField={(name, value) => on.field(row.id, name, value)}
        onDraft={(value) => on.draft(row.id, value)}
        onAmount={(value) => on.amount(row.id, value)}
    />
)

/** The proposal, editable fields and existing decision feedback. */
const SalesDecisionBody = (props: SalesDecisionRowProps) => {
    const { row, labels: l, on } = props
    return (
        <Stack gap="row">
            <Text size="sm" isStrong isLoading={props.isLoading === true}>
                {row.actionLabel}
            </Text>
            {row.summary === "" ? null : (
                <Text size="sm" tone="muted" isLoading={props.isLoading === true}>
                    {row.summary}
                </Text>
            )}
            {row.reasonHint === null ? null : (
                <Text size="xs" tone="muted" isLoading={props.isLoading === true}>
                    {row.reasonHint}
                </Text>
            )}
            {row.amountLine === null ? null : (
                <Text size="sm" isStrong isLoading={props.isLoading === true}>
                    {row.amountLine}
                </Text>
            )}
            {row.draft === null ? null : (
                <Quote source={l.draftLabel} text={row.draft} isLoading={props.isLoading === true} />
            )}
            {row.canAct && (row.missing.length > 0 || row.isEditing)
                ? renderSalesDecisionRowFields(row, l, on, props.isLoading)
                : null}
            {row.error === null ? null : (
                <Text size="sm" live="assertive">
                    {row.error}
                </Text>
            )}
            {row.canAct ? null : (
                <Text size="sm" isStrong live="polite">
                    {l.waitingManager}
                </Text>
            )}
            {row.assignedTo === null ? null : (
                <Text size="xs" tone="muted">
                    {row.assignedTo}
                </Text>
            )}
        </Stack>
    )
}
