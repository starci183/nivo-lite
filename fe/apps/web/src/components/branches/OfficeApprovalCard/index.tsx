import { useState } from "react"
import type { ReactNode } from "react"
import { Badge, Button, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { OfficeCardFrame } from "@/components/leaves/OfficeCardFrame"
import type { OfficeApprovalView, OfficeText } from "@/modules/types"
import { ACTIONS_CLASS_NAME, LINK_CLASS_NAME, QUOTE_CLASS_NAME, STATUS_CLASS_NAME, TEXT_CLASS_NAME } from "./classNames"

/** What one approval request draws. */
type OfficeApprovalCardProps = {
    readonly approval: OfficeApprovalView
    readonly avatar: ReactNode
    readonly text: OfficeText
    /** True while this request is being decided. */
    readonly isBusy: boolean
    readonly onDecide: (id: string, decision: "approved" | "rejected", editedDraft: string | null) => void
}

const PREVIEW_CHARS = 280

const TONES = { waiting: "warning", approved: "success", rejected: "danger" } as const

/**
 * An approval request as a message from the drafting agent: what will be sent, to whom, and inline "Approve and send / Edit /
 * Reject". A decided request shows who decided and when.
 */
export const OfficeApprovalCard = (props: OfficeApprovalCardProps) => {
    const { approval, text } = props
    const [isEditing, setIsEditing] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    const [editText, setEditText] = useState(approval.draft)
    const isWaiting = approval.status === "waiting"
    const isLong = approval.draft.length > PREVIEW_CHARS
    const shown =
        !isWaiting && isLong && !isExpanded ? `${approval.draft.slice(0, PREVIEW_CHARS).trimEnd()}...` : approval.draft
    const trimmed = editText.trim()

    const onApprove = () => {
        props.onDecide(approval.id, "approved", isEditing && trimmed !== approval.draft ? trimmed : null)
        setIsEditing(false)
    }

    const onToggleEdit = () => {
        setEditText(approval.draft)
        setIsEditing((value) => !value)
    }

    return (
        <OfficeCardFrame
            id={approval.anchor}
            author={approval.author}
            avatar={props.avatar}
            meta={approval.time}
            label={approval.title}
            isHighlight={approval.isFocused}
            head={
                <div className={TEXT_CLASS_NAME}>
                    {approval.title === "" ? null : <Text weight="semibold">{approval.title}</Text>}
                    <Text size="sm" tone="muted">
                        {approval.target}
                    </Text>
                </div>
            }
        >
            {renderOfficeApprovalCardStatus(approval, text)}
            {isWaiting && isEditing ? (
                <Textarea
                    label={text("draftLabel")}
                    rows={6}
                    value={editText}
                    isDisabled={props.isBusy}
                    onValueChange={setEditText}
                />
            ) : (
                <SurfaceCard ariaLabel={approval.title === "" ? text("draftLabel") : approval.title}>
                    <div className={QUOTE_CLASS_NAME}>
                        <Text as="p" size="sm">
                            {shown}
                        </Text>
                    </div>
                </SurfaceCard>
            )}
            {!isWaiting && isLong ? (
                <div>
                    <Button intent="neutral" size="sm" onPress={() => setIsExpanded((value) => !value)}>
                        {isExpanded ? text("showLess") : text("showMore")}
                    </Button>
                </div>
            ) : null}
            <Text size="xs" tone="muted">
                {approval.settled}
            </Text>
            {isWaiting && !approval.canAct ? (
                <Text size="sm" weight="medium" live="polite">
                    {text("waitingManager")}
                </Text>
            ) : null}
            {isWaiting && approval.canAct
                ? renderOfficeApprovalCardActions(props, isEditing, trimmed, onApprove, text, onToggleEdit, approval)
                : null}
        </OfficeCardFrame>
    )
}

/** Renders the OfficeApprovalCard actions section. */
const renderOfficeApprovalCardActions = (
    props: Pick<OfficeApprovalCardProps, "isBusy" | "onDecide">,
    isEditing: boolean,
    trimmed: string,
    onApprove: () => void,
    text: NonNullable<OfficeApprovalCardProps["text"]>,
    onToggleEdit: () => void,
    approval: NonNullable<OfficeApprovalCardProps["approval"]>,
) => (
    <div className={ACTIONS_CLASS_NAME}>
        <Button
            intent="commit"
            size="sm"
            isPending={props.isBusy}
            isDisabled={props.isBusy || (isEditing && trimmed.length === 0)}
            onPress={onApprove}
        >
            {isEditing ? text("approveEdited") : text("approveSend")}
        </Button>
        <Button intent="neutral" size="sm" isDisabled={props.isBusy} onPress={onToggleEdit}>
            {isEditing ? text("cancelEdit") : text("edit")}
        </Button>
        <Button
            intent="alternative"
            size="sm"
            isDisabled={props.isBusy}
            onPress={() => props.onDecide(approval.id, "rejected", null)}
        >
            {text("reject")}
        </Button>
    </div>
)

/** Renders the OfficeApprovalCard status section. */
const renderOfficeApprovalCardStatus = (
    approval: NonNullable<OfficeApprovalCardProps["approval"]>,
    text: NonNullable<OfficeApprovalCardProps["text"]>,
) => (
    <div className={STATUS_CLASS_NAME}>
        <Badge tone={TONES[approval.status]} isDot>
            {approval.statusLabel}
        </Badge>
        <Badge tone="neutral">{text("aiBadge")}</Badge>
        {approval.leadHref === null ? null : (
            <div className={LINK_CLASS_NAME}>
                <Button intent="neutral" size="sm" href={approval.leadHref}>
                    {text("openLead")}
                </Button>
            </div>
        )}
    </div>
)
