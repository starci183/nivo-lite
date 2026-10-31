import type { ReactNode } from "react"
import { Badge, Button, Cluster, Stack, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { OfficeCardFrame } from "@/components/leaves/OfficeCardFrame"
import type { OfficeApprovalView, OfficeCardDraft, OfficeText } from "@/modules/types"
import { QUOTE_CLASS_NAME } from "./classNames"

/** What one approval request draws. */
type OfficeApprovalCardProps = {
    readonly approval: OfficeApprovalView
    readonly avatar: ReactNode
    readonly text: OfficeText
    /** What the owner edited on this card, kept by the thread's block. */
    readonly draft: OfficeCardDraft
    readonly onEdit: (key: string, patch: Partial<OfficeCardDraft>) => void
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
    const { isEditing, isExpanded } = props.draft
    const editText = props.draft.text ?? approval.draft
    const edit = (patch: Partial<OfficeCardDraft>) => props.onEdit(approval.key, patch)
    const isWaiting = approval.status === "waiting"
    const isLong = approval.draft.length > PREVIEW_CHARS
    const shown =
        !isWaiting && isLong && !isExpanded ? `${approval.draft.slice(0, PREVIEW_CHARS).trimEnd()}...` : approval.draft
    const trimmed = editText.trim()

    const onApprove = () => {
        props.onDecide(approval.id, "approved", isEditing && trimmed !== approval.draft ? trimmed : null)
        edit({ isEditing: false })
    }

    const onToggleEdit = () => edit({ text: null, isEditing: !isEditing })

    return (
        <OfficeCardFrame
            id={approval.anchor}
            author={approval.author}
            avatar={props.avatar}
            meta={approval.time}
            label={approval.title}
            isHighlight={approval.isFocused}
            head={
                <Stack gap="identity">
                    {approval.title === "" ? null : <Text weight="semibold">{approval.title}</Text>}
                    <Text size="sm" tone="muted">
                        {approval.target}
                    </Text>
                </Stack>
            }
        >
            {renderOfficeApprovalCardStatus(approval, text)}
            {isWaiting && isEditing ? (
                <Textarea
                    label={text("draftLabel")}
                    rows={6}
                    value={editText}
                    isDisabled={props.isBusy}
                    onValueChange={(value) => edit({ text: value })}
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
                    <Button intent="neutral" size="sm" onPress={() => edit({ isExpanded: !isExpanded })}>
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
    <Cluster gap="inline">
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
    </Cluster>
)

/** Renders the OfficeApprovalCard status section. */
const renderOfficeApprovalCardStatus = (
    approval: NonNullable<OfficeApprovalCardProps["approval"]>,
    text: NonNullable<OfficeApprovalCardProps["text"]>,
) => (
    <Cluster gap="inline" justify="between">
        <Cluster gap="inline">
            <Badge tone={TONES[approval.status]} isDot>
                {approval.statusLabel}
            </Badge>
            <Badge tone="neutral">{text("aiBadge")}</Badge>
        </Cluster>
        {approval.leadHref === null ? null : (
            <Button intent="neutral" size="sm" href={approval.leadHref}>
                {text("openLead")}
            </Button>
        )}
    </Cluster>
)
