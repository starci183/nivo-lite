import { Alert, Section, Stack, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ApprovalCard } from "@/components/composites/ApprovalCard"
import type { LeadApprovalPane, LeadApprovalView, LeadPanesOn } from "@/modules/types"

/** What the approval region draws and what a person can do on its draft. */
interface LeadApprovalSectionProps {
    readonly pane: LeadApprovalPane
    readonly on: Pick<LeadPanesOn, "approvalToggleEdit" | "approvalEditChange" | "approvalDecide">
}

const PLACEHOLDER: LeadApprovalView = {
    explanation: "",
    canDraft: false,
    waiting: null,
    earlier: [],
}

/**
 * The approval region of the main pane: the draft that waits for a decision, with its approval card, else the line that says who
 * drafts the next message and that nothing leaves the company before a person approves. Earlier decisions follow.
 */
export const LeadApprovalSection = (props: LeadApprovalSectionProps) => {
    const { pane, on } = props
    const l = pane.labels
    const cardOn = { toggleEdit: on.approvalToggleEdit, editChange: on.approvalEditChange, decide: on.approvalDecide }
    return (
        <SlotView
            slot={pane.slot}
            placeholder={PLACEHOLDER}
            labels={l.slot}
            render={(view, isLoading) => (
                <>
                    <Section
                        id="execution"
                        title={view.waiting === null ? l.followUp : l.waitingTitle}
                        {...(view.waiting === null ? {} : { meta: l.followUp })}
                        headingLevel={2}
                        isLoading={isLoading}
                    >
                        <Stack gap="row">
                            {view.waiting === null ? (
                                <Text tone="muted" isLoading={isLoading}>
                                    {view.explanation}
                                </Text>
                            ) : (
                                <ApprovalCard view={view.waiting.view} labels={l.approval} on={cardOn} />
                            )}
                            {pane.error === null ? null : (
                                <Alert tone="negative" title={l.failTitle} description={pane.error} />
                            )}
                        </Stack>
                    </Section>
                    {view.earlier.length === 0 ? null : (
                        <Section title={l.earlierTitle} meta={l.earlierMeta} headingLevel={2}>
                            <Stack gap="section">
                                {view.earlier.map((item) => (
                                    <ApprovalCard key={item.id} view={item.view} labels={l.approval} on={cardOn} />
                                ))}
                            </Stack>
                        </Section>
                    )}
                </>
            )}
        />
    )
}
