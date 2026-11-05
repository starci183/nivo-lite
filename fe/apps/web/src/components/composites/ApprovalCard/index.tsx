import type { ModuleIconName } from "@/modules/types"
import { Badge, Cluster, Quote, Stack, SurfaceCard, Text, Textarea, type BadgeTone } from "@starci/grammar/common"

import { DecisionButtons } from "@/components/leaves/DecisionButtons"
import { Icon } from "@/components/leaves/Icon"
import { CopyTextButton } from "@/components/branches/CopyTextButton"

/** The drafting agent: its mark and its spoken name. */
interface ApprovalAgentView {
    readonly name: string
    readonly glyph: ModuleIconName
    /** The picture the owner gave the agent; null draws the NIVO unicorn mascot. */
    readonly avatarUrl: string | null
}

/** One drafted message with every word resolved and the state of its controls. */
interface ApprovalCardView {
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
interface ApprovalCardLabels {
    readonly draft: string
    readonly copy: string
    readonly copied: string
    readonly waitingManager: string
    readonly approveSend: string
    readonly edit: string
    readonly discardEdits: string
    readonly reject: string
    /** The one muted note under the draft: the AI drafted it, nothing is sent until the owner approves, every decision is recorded. */
    readonly note: string
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

/** The approval card in the mockup form: who drafted it and for whom, the draft in its tinted box, one muted note, and the decision. */
export const ApprovalCard = (props: ApprovalCardProps) => {
    const { view, labels, on } = props
    const isBusy = view.pendingDecision !== null
    const shownText = view.isWaiting && view.isEditing ? view.editText : view.draft
    return (
        <SurfaceCard
            ariaLabel={view.nextAction}
            kind="bands"
            bands={[
                {
                    kind: "body",
                    children: (
                        <Stack gap="row">
                            <Cluster gap="inline">
                                <Badge tone={view.status.tone}>{view.status.label}</Badge>
                                {view.agent === null ? null : <Badge tone="neutral">{view.agent.name}</Badge>}
                                <Text size="xs" tone="muted">
                                    {view.willSend}
                                </Text>
                            </Cluster>
                            {renderApprovalCardDraft(view, labels, isBusy, on, shownText)}
                        </Stack>
                    ),
                },
            ]}
        />
    )
}

/** The command being sent, in the words of the decision group. */
const pendingOf = (decision: "approved" | "rejected" | null): "approve" | "reject" | null => {
    if (decision === null) return null
    return decision === "approved" ? "approve" : "reject"
}

/** Renders the ApprovalCard draft, its note and the decision. */
const renderApprovalCardDraft = (
    view: NonNullable<ApprovalCardProps["view"]>,
    labels: NonNullable<ApprovalCardProps["labels"]>,
    isBusy: boolean,
    on: NonNullable<ApprovalCardProps["on"]>,
    shownText: string,
) => (
    <Stack gap="row">
        {view.isWaiting && view.isEditing ? (
            <Textarea
                label={labels.draft}
                rows={8}
                value={view.editText}
                isDisabled={isBusy}
                onValueChange={on.editChange}
            />
        ) : (
            <Quote source={labels.draft} text={view.draft} byline={view.characters} />
        )}
        {view.error === null ? null : (
            <Text size="sm" live="assertive">
                {view.error}
            </Text>
        )}
        <Cluster gap="inline" justify="between">
            <Text size="xs" tone="muted">
                {labels.note}
            </Text>
            <CopyTextButton text={shownText} copyLabel={labels.copy} copiedLabel={labels.copied} />
        </Cluster>
        {view.isWaiting && !view.canDecide ? (
            <Text size="sm" isStrong live="polite">
                {labels.waitingManager}
            </Text>
        ) : null}
        {view.isWaiting && view.canDecide ? (
            <DecisionButtons
                pending={pendingOf(view.pendingDecision)}
                reject={{ label: labels.reject, onPress: () => on.decide("rejected") }}
                edit={{
                    label: view.isEditing ? labels.discardEdits : labels.edit,
                    onPress: on.toggleEdit,
                    icon: <Icon props={{ name: "edit", usage: "leading" }} />,
                }}
                approve={{
                    label: labels.approveSend,
                    onPress: () => on.decide("approved"),
                    isDisabled: view.isEditing && view.editText.trim().length === 0,
                }}
            />
        ) : null}
        {view.isWaiting ? null : (
            <Text size="sm" tone="muted">
                {view.settledLabel}
            </Text>
        )}
    </Stack>
)
