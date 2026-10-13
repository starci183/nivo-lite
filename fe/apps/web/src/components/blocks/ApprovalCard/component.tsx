import { Badge, Button, Divider, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import {
    ACTIONS_CLASS,
    BAND_CLASS,
    BAND_DIVIDED_CLASS,
    COLUMN_CLASS,
    META_ROW_CLASS,
    QUOTE_CLASS,
    STATUS_ROW_CLASS,
} from "./classNames"

/** Copy, values and state of the approval card. */
export interface ApprovalCardBaseProps {
    readonly props: {
        /** Whether the draft still waits for a decision. */
        readonly isWaiting: boolean
        readonly isApproved: boolean
        readonly nextAction: string
        readonly willSend: string
        readonly agentName: string | null
        /** SVG path data of the glyph drawn beside the agent name. */
        readonly agentGlyph: string
        readonly aiChip: string
        readonly needsApproval: string
        readonly statusWord: string
        readonly draft: string
        readonly draftLabel: string
        readonly isEditing: boolean
        readonly editText: string
        readonly characters: string
        readonly copyLabel: string
        /** False when the signed-in member may not decide this draft (staff, not assigned): the buttons give way to a note. */
        readonly canDecide: boolean
        readonly waitingManager: string
        readonly approveLabel: string
        readonly editLabel: string
        readonly rejectLabel: string
        readonly settledLabel: string
        readonly openLeadLabel: string
        readonly href?: string
        readonly pendingDecision: "approved" | "rejected" | null
    }
    readonly on: {
        readonly toggleEdit: () => void
        readonly editChange: (value: string) => void
        readonly decide: (decision: "approved" | "rejected") => void
        readonly copy: () => void
    }
}

/** Draws the approval card: pending shows the decision bands, settled shows who decided and the final text. */
export const ApprovalCardBase = (props: ApprovalCardBaseProps) => {
    const view = props.props
    const isBusy = view.pendingDecision !== null
    const isEmptyEdit = view.isEditing && view.editText.trim().length === 0
    return (
        <div className={COLUMN_CLASS}>
            <SurfaceCard composition="joined" depth="nested" ariaLabel={view.nextAction}>
                <div className={BAND_CLASS}>
                    <div className={STATUS_ROW_CLASS}>
                        {view.agentName === null ? null : (
                            <AgentMark glyph={view.agentGlyph} module="chatbot" size="sm" label={view.agentName} />
                        )}
                        {view.isWaiting ? (
                            <Badge tone="warning">{view.needsApproval}</Badge>
                        ) : (
                            <Badge tone={view.isApproved ? "success" : "danger"}>{view.statusWord}</Badge>
                        )}
                        {view.agentName === null ? null : <Badge tone="neutral">{view.aiChip}</Badge>}
                    </div>
                    <Text weight="semibold">{view.nextAction}</Text>
                    <Text size="sm" tone="muted">
                        {view.willSend}
                    </Text>
                </div>
                <Divider semantics="presentation" />
                <div className={BAND_DIVIDED_CLASS}>
                    {view.isWaiting && view.isEditing ? (
                        <Textarea
                            variant="secondary"
                            label={view.draftLabel}
                            rows={8}
                            value={view.editText}
                            isDisabled={isBusy}
                            onValueChange={props.on.editChange}
                        />
                    ) : (
                        <div className={QUOTE_CLASS}>
                            <Text>{view.draft}</Text>
                        </div>
                    )}
                    <div className={META_ROW_CLASS}>
                        <Text size="xs" tone="muted">
                            {view.characters}
                        </Text>
                        <Button variant="ghost" size="sm" onPress={props.on.copy}>
                            {view.copyLabel}
                        </Button>
                    </div>
                    {view.isWaiting && !view.canDecide ? (
                        <Text size="sm" weight="medium" live="polite">
                            {view.waitingManager}
                        </Text>
                    ) : null}
                    {view.isWaiting && view.canDecide ? (
                        <div className={ACTIONS_CLASS}>
                            <Button
                                variant="primary"
                                isPending={view.pendingDecision === "approved"}
                                isDisabled={isBusy || isEmptyEdit}
                                onPress={() => props.on.decide("approved")}
                            >
                                {view.approveLabel}
                            </Button>
                            <Button variant="outline" isDisabled={isBusy} onPress={props.on.toggleEdit}>
                                {view.editLabel}
                            </Button>
                            <Button
                                variant="ghost"
                                isPending={view.pendingDecision === "rejected"}
                                isDisabled={isBusy}
                                onPress={() => props.on.decide("rejected")}
                            >
                                {view.rejectLabel}
                            </Button>
                        </div>
                    ) : null}
                    {view.isWaiting ? null : (
                        <div className={META_ROW_CLASS}>
                            <Text size="sm" tone="muted">
                                {view.settledLabel}
                            </Text>
                            {view.href === undefined ? null : (
                                <Button variant="ghost" size="sm" href={view.href}>
                                    {view.openLeadLabel}
                                </Button>
                            )}
                        </div>
                    )}
                    {view.isWaiting && view.href !== undefined ? (
                        <Button variant="ghost" size="sm" href={view.href}>
                            {view.openLeadLabel}
                        </Button>
                    ) : null}
                </div>
            </SurfaceCard>
        </div>
    )
}
