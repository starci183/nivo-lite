import { Badge, Button, Cluster, Text, Textarea } from "@starci/grammar/common"
import type { OfficeApprovalView, OfficeCardDraft, OfficeThreadProps } from "@/modules/types"
import { QUOTE_CLASS_NAME } from "./classNames"

/** What one approval request draws. */
type OfficeApprovalCardProps = {
    readonly approval: OfficeApprovalView
    readonly copy: OfficeThreadProps["props"]["cardCopy"]["approval"]
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
    const { approval, copy } = props
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
        <>
            {renderOfficeApprovalCardStatus(approval, copy)}
            {isWaiting && isEditing ? (
                <Textarea
                    label={copy.draftLabel}
                    rows={6}
                    value={editText}
                    isDisabled={props.isBusy}
                    onValueChange={(value) => edit({ text: value })}
                />
            ) : (
                <div
                    role="group"
                    aria-label={approval.title === "" ? copy.draftLabel : approval.title}
                    className={QUOTE_CLASS_NAME}
                >
                    <Text as="p" size="sm">
                        {shown}
                    </Text>
                </div>
            )}
            {!isWaiting && isLong ? (
                <div>
                    <Button intent="neutral" size="sm" onPress={() => edit({ isExpanded: !isExpanded })}>
                        {isExpanded ? copy.showLess : copy.showMore}
                    </Button>
                </div>
            ) : null}
            <Text size="xs" tone="muted">
                {approval.settled}
            </Text>
            {isWaiting && !approval.canAct ? (
                <Text size="sm" isStrong live="polite">
                    {copy.waitingManager}
                </Text>
            ) : null}
            {isWaiting && approval.canAct
                ? renderOfficeApprovalCardActions(props, isEditing, trimmed, onApprove, copy, onToggleEdit, approval)
                : null}
        </>
    )
}

/** Renders the OfficeApprovalCard actions section. */
const renderOfficeApprovalCardActions = (
    props: Pick<OfficeApprovalCardProps, "isBusy" | "onDecide">,
    isEditing: boolean,
    trimmed: string,
    onApprove: () => void,
    copy: NonNullable<OfficeApprovalCardProps["copy"]>,
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
            {isEditing ? copy.approveEdited : copy.approveSend}
        </Button>
        <Button intent="neutral" size="sm" isDisabled={props.isBusy} onPress={onToggleEdit}>
            {isEditing ? copy.cancelEdit : copy.edit}
        </Button>
        <Button
            intent="alternative"
            size="sm"
            isDisabled={props.isBusy}
            onPress={() => props.onDecide(approval.id, "rejected", null)}
        >
            {copy.reject}
        </Button>
    </Cluster>
)

/** Renders the OfficeApprovalCard status section. */
const renderOfficeApprovalCardStatus = (
    approval: NonNullable<OfficeApprovalCardProps["approval"]>,
    copy: NonNullable<OfficeApprovalCardProps["copy"]>,
) => (
    <Cluster gap="inline" justify="between">
        <Cluster gap="inline">
            <Badge tone={TONES[approval.status]} isDot>
                {approval.statusLabel}
            </Badge>
            <Badge tone="neutral">{copy.aiBadge}</Badge>
        </Cluster>
        {approval.leadHref === null ? null : (
            <Button intent="neutral" size="sm" href={approval.leadHref}>
                {copy.openLead}
            </Button>
        )}
    </Cluster>
)
