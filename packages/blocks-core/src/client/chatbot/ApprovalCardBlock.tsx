import { useState } from "react"
import type { ReactNode } from "react"
import type { ActionHandle } from "@nivo-lite/agent-sdk/block"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import {
    Button,
    Cluster,
    DropdownMenu,
    Form,
    Heading,
    Quote,
    Stack,
    SurfaceCard,
    Text,
    Textarea,
} from "@starci/grammar/common"
import type { approvalCardBlock } from "../../blocks/chatbot/approval-card.block"
import { PROPOSAL_FIELDS } from "../../rows/chatbot/inbox-fields"
import { proposalOf } from "../../rows/chatbot/proposal"
import type { ProposalRow } from "../../rows/chatbot/conversation.types"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

type CardProps = RenderOf<typeof approvalCardBlock>

/** What an action on a draft is given: the draft and, when the person changed it, the new words. */
interface DraftRunInput {
    readonly id: string
    readonly values?: { readonly text: string }
}

/** What the card of one waiting draft is given. */
interface DraftCardProps {
    readonly proposal: ProposalRow
    readonly slots: CardProps["slots"]
    readonly maxLength: number
    /** Runs an action on the draft; the card tells the person when it did not go through. */
    readonly onRun: (action: ActionHandle, input: DraftRunInput) => void
}

/** The card of a draft in the field that changes it. */
interface DraftEditProps extends DraftCardProps {
    /** Leaves the field. */
    readonly onClose: () => void
}

/** The card of a draft with its commands. */
interface DraftCommandProps extends DraftCardProps {
    /** Opens the field that changes the draft. */
    readonly onEdit: () => void
}

/** The draft in a field to change; the send-edited button approves it with the changed words, cancel leaves it as it was. */
const DraftEditForm = (props: DraftEditProps): ReactNode => {
    const words = useBlockWords()
    const [text, setText] = useState(props.proposal.text)
    const { approve } = props.slots
    return (
        <Form
            label={words({ key: "approval_title" })}
            isPending={approve.isRunning}
            onSubmit={() => {
                props.onRun(approve, { id: props.proposal.id, values: { text: text.trim() } })
                props.onClose()
            }}
        >
            <Textarea
                name="text"
                label={words({ key: "approval_title" })}
                isLabelHidden
                rows={3}
                maxLength={props.maxLength}
                value={text}
                onValueChange={setText}
            />
            <Cluster gap="inline">
                <Button type="submit" intent="commit" isPending={approve.isRunning} isDisabled={text.trim() === ""}>
                    {words({ key: "approval_send_edited" })}
                </Button>
                <Button intent="neutral" onPress={props.onClose}>
                    {words({ key: "approval_cancel" })}
                </Button>
            </Cluster>
        </Form>
    )
}

/** The commands of the draft: approve and send it, change it, or dismiss it from the menu. */
const DraftCommands = (props: DraftCommandProps): ReactNode => {
    const words = useBlockWords()
    const { approve, dismiss } = props.slots
    const id = props.proposal.id
    return (
        <Cluster gap="inline">
            {approve.isAllowed ? (
                <Button intent="commit" isPending={approve.isRunning} onPress={() => props.onRun(approve, { id })}>
                    {approve.label}
                </Button>
            ) : null}
            {approve.isAllowed ? (
                <Button intent="alternative" onPress={props.onEdit}>
                    {words({ key: "approval_edit" })}
                </Button>
            ) : null}
            {dismiss.isAllowed ? (
                <DropdownMenu
                    placement="bottom end"
                    trigger={
                        <Button intent="neutral" isPending={dismiss.isRunning}>
                            {words({ key: "approval_more" })}
                        </Button>
                    }
                    entries={[
                        {
                            id: "dismiss",
                            label: dismiss.label,
                            tone: "danger",
                            onAction: () => props.onRun(dismiss, { id }),
                        },
                    ]}
                />
            ) : null}
        </Cluster>
    )
}

/** The card of one draft: what the customer asked, the draft in a quote, a line of guidance, and the commands. */
const DraftCard = (props: DraftCardProps): ReactNode => {
    const words = useBlockWords()
    const [isEditing, setIsEditing] = useState(false)
    const { proposal } = props
    return (
        <SurfaceCard ariaLabel={words({ key: "approval_title" })}>
            <Stack gap="row">
                <Heading level={3}>{words({ key: "approval_title" })}</Heading>
                {proposal.asked === "" ? null : (
                    <Text size="sm" tone="muted">
                        {`${words({ key: "approval_asked_prefix" })}${proposal.asked}`}
                    </Text>
                )}
                {isEditing ? (
                    <DraftEditForm {...props} onClose={() => setIsEditing(false)} />
                ) : (
                    <>
                        <Quote text={proposal.text} />
                        <Text size="sm" tone="muted">
                            {proposal.note === "" ? words({ key: "approval_note" }) : proposal.note}
                        </Text>
                        <DraftCommands {...props} onEdit={() => setIsEditing(true)} />
                    </>
                )}
            </Stack>
        </SurfaceCard>
    )
}

/**
 * The approval card of the Chatbot thread: the reply the AI drafted, waiting for a person. It draws nothing while no draft waits and
 * holds no business: the approve-and-send button is the bound action, which posts the line and queues its delivery.
 */
export const ApprovalCardBlock = (props: CardProps): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels()
    const read = props.slots.proposal
    const fail = (): void => host.notify("danger", words({ key: "approval_failed" }))
    const run: DraftCardProps["onRun"] = (action, input) => {
        action
            .run(input)
            .then((outcome) => {
                if (!outcome.ok) fail()
            })
            .catch(fail)
    }
    return (
        <SlotView
            slot={read.slot}
            labels={labels}
            placeholder={{}}
            forbidden="hide"
            empty="collapse"
            onRetry={read.retry}
            render={(record) => {
                const proposal = proposalOf(record, PROPOSAL_FIELDS)
                return proposal === null ? null : (
                    <DraftCard proposal={proposal} slots={props.slots} maxLength={props.props.maxLength} onRun={run} />
                )
            }}
        />
    )
}
