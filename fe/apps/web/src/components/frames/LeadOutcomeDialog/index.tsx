import { Alert, Select, Text, Textarea } from "@starci/grammar/common"
import { LeadDialogShell } from "@/components/composites/LeadDialogShell"
import type { DataSlot, LeadOutcomePane, LeadOutcomeView } from "@/modules/types"

/** What the outcome dialog draws and does with a person's input. */
interface LeadOutcomeDialogProps {
    readonly pane: LeadOutcomePane
    readonly on: {
        readonly close: () => void
        readonly stage: (value: string) => void
        readonly evidence: (value: string) => void
        readonly submit: () => void
    }
}

const viewOf = (slot: DataSlot<LeadOutcomeView>): LeadOutcomeView | null => ("items" in slot ? slot.items : null)

/** The dialog that records an outcome: the stage, what happened as evidence, and a note when a won customer is handed on. */
export const LeadOutcomeDialog = (props: LeadOutcomeDialogProps) => {
    const { pane, on } = props
    const l = pane.labels
    const view = viewOf(pane.slot)
    return (
        <LeadDialogShell
            isOpen={pane.isDialogOpen && view !== null}
            title={l.recordLabel}
            closeLabel={l.cancel}
            submitLabel={l.recordLabel}
            isPending={pane.isPending}
            onClose={on.close}
            onSubmit={on.submit}
            fields={
                <>
                    <Select
                        label={l.stageLabel}
                        options={l.stageOptions}
                        value={view?.stage ?? ""}
                        onValueChange={(value) => value && on.stage(value)}
                    />
                    <Textarea
                        label={l.evidenceLabel}
                        description={l.evidenceHint}
                        rows={4}
                        isRequired
                        value={pane.evidenceText}
                        onValueChange={on.evidence}
                    />
                    {view?.wonNote == null ? null : (
                        <Text as="p" size="sm" tone="muted">
                            {view.wonNote}
                        </Text>
                    )}
                    {pane.error === null ? null : (
                        <Alert title={l.failTitle} description={pane.error} tone="negative" />
                    )}
                </>
            }
        />
    )
}
