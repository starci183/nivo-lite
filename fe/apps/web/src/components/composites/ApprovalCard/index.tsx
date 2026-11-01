import { nivoIconSource } from "@/components/leaves/Icon"
import type { ModuleIconName } from "@/modules/types"
import { Badge, Button, Divider, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { AiMarkChip } from "@/components/leaves/AiMarkChip"
import { CopyTextButton } from "@/components/branches/CopyTextButton"
import {
    APPROVAL_CARD_ACTIONS_CLASS_NAME,
    APPROVAL_CARD_BAND_CLASS_NAME,
    APPROVAL_CARD_BAND_DIVIDED_CLASS_NAME,
    APPROVAL_CARD_COLUMN_CLASS_NAME,
    APPROVAL_CARD_META_ROW_CLASS_NAME,
    APPROVAL_CARD_QUOTE_CLASS_NAME,
    APPROVAL_CARD_STATUS_ROW_CLASS_NAME,
} from "./classNames"

/** The drafting agent: its mark and its spoken name. */
interface ApprovalAgentView {
    readonly name: string
    readonly glyph: ModuleIconName
    /** The picture the owner gave the agent; null draws the NIVO unicorn mascot. */
    readonly avatarUrl: string | null
}

/** One drafted message with every word resolved and the state of its controls. */
export interface ApprovalCardView {
    readonly nextAction: string
    readonly willSend: string
    /** The agent that drafted it; null for a message a person wrote. */
    readonly agent: ApprovalAgentView | null
    readonly status: { readonly label: string; readonly tone: BadgeTone }
    readonly draft: string
    readonly characters: string
    /** Who decided and when; shown once the draft is settled. */
    readonly settledLabel: string
    readonly isWaiting: boolean
    /** False when the signed-in member may not decide this draft: the buttons give way to a note. */
    readonly canDecide: boolean
    readonly isEditing: boolean
    readonly editText: string
    readonly pendingDecision: "approved" | "rejected" | null
    readonly error: string | null
}

/** The words of the card. */
export interface ApprovalCardLabels {
    readonly aiChip: string
    readonly draft: string
    readonly copy: string
    readonly copied: string
    readonly waitingManager: string
    readonly approveSend: string
    readonly edit: string
    readonly discardEdits: string
    readonly reject: string
}

/** What a person can do on the card. */
interface ApprovalCardActions {
    readonly toggleEdit: () => void
    readonly editChange: (value: string) => void
    readonly decide: (decision: "approved" | "rejected") => void
}

/** What the card draws and what it reports back. */
interface ApprovalCardProps {
    readonly view: ApprovalCardView
    readonly labels: ApprovalCardLabels
    readonly on: ApprovalCardActions
}

/** The approval card: pending shows the decision bands, settled shows who decided and the final text. */
export const ApprovalCard = (props: ApprovalCardProps) => {
    const { view, labels, on } = props
    const isBusy = view.pendingDecision !== null
    const shownText = view.isWaiting && view.isEditing ? view.editText : view.draft
    return (
        <div className={APPROVAL_CARD_COLUMN_CLASS_NAME}>
            <SurfaceCard composition="joined" ariaLabel={view.nextAction}>
                <div className={APPROVAL_CARD_BAND_CLASS_NAME}>
                    <div className={APPROVAL_CARD_STATUS_ROW_CLASS_NAME}>
                        {view.agent === null ? null : (
                            <AgentMark
                                glyph={nivoIconSource(view.agent.glyph, "leading")}
                                label={view.agent.name}
                                seed={view.agent.name}
                                src={view.agent.avatarUrl}
                                module="chatbot"
                                size="sm"
                            />
                        )}
                        <Badge tone={view.status.tone}>{view.status.label}</Badge>
                        {view.agent === null ? null : <AiMarkChip label={labels.aiChip} />}
                    </div>
                    <Text weight="semibold">{view.nextAction}</Text>
                    <Text size="sm" tone="muted">
                        {view.willSend}
                    </Text>
                </div>
                <Divider semantics="presentation" />
                {renderApprovalCardDraft(view, labels, isBusy, on, shownText)}
            </SurfaceCard>
        </div>
    )
}

/** Renders the ApprovalCard draft section. */
const renderApprovalCardDraft = (
    view: NonNullable<ApprovalCardProps["view"]>,
    labels: NonNullable<ApprovalCardProps["labels"]>,
    isBusy: boolean,
    on: NonNullable<ApprovalCardProps["on"]>,
    shownText: string,
) => (
    <div className={APPROVAL_CARD_BAND_DIVIDED_CLASS_NAME}>
        {view.isWaiting && view.isEditing ? (
            <Textarea
                label={labels.draft}
                rows={8}
                value={view.editText}
                isDisabled={isBusy}
                onValueChange={on.editChange}
            />
        ) : (
            <SurfaceCard>
                <div className={APPROVAL_CARD_QUOTE_CLASS_NAME}>
                    <Text>{view.draft}</Text>
                </div>
            </SurfaceCard>
        )}
        <div className={APPROVAL_CARD_META_ROW_CLASS_NAME}>
            <Text size="xs" tone="muted">
                {view.characters}
            </Text>
            <CopyTextButton text={shownText} copyLabel={labels.copy} copiedLabel={labels.copied} />
        </div>
        {view.error === null ? null : (
            <Text size="sm" live="assertive">
                {view.error}
            </Text>
        )}
        {view.isWaiting && !view.canDecide ? (
            <Text size="sm" weight="medium" live="polite">
                {labels.waitingManager}
            </Text>
        ) : null}
        {view.isWaiting && view.canDecide ? (
            <div className={APPROVAL_CARD_ACTIONS_CLASS_NAME}>
                <Button
                    intent="commit"
                    isPending={view.pendingDecision === "approved"}
                    isDisabled={isBusy || (view.isEditing && view.editText.trim().length === 0)}
                    onPress={() => on.decide("approved")}
                >
                    {labels.approveSend}
                </Button>
                <Button intent="alternative" isDisabled={isBusy} onPress={on.toggleEdit}>
                    {view.isEditing ? labels.discardEdits : labels.edit}
                </Button>
                <Button
                    intent="alternative"
                    isPending={view.pendingDecision === "rejected"}
                    isDisabled={isBusy}
                    onPress={() => on.decide("rejected")}
                >
                    {labels.reject}
                </Button>
            </div>
        ) : null}
        {view.isWaiting ? null : (
            <div className={APPROVAL_CARD_META_ROW_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {view.settledLabel}
                </Text>
            </div>
        )}
    </div>
)
