import { useState } from "react"
import type { ReactNode } from "react"
import type { ActionHandle } from "@nivo-lite/agent-sdk/block"
import { Button, Cluster, DropdownMenu, Form, Heading, Quote, Stack, Text, Textarea } from "@starci/grammar/common"
import type { ProposalRow } from "../../rows/conversation.types"

/** The words of the proposal that are not its own. */
interface ConversationProposalWords {
    /** The heading of the card. */
    readonly title: string
    /** The name of the menu that holds the refusal. */
    readonly moreLabel: string
    /** The words on the button that sends the changed reply. */
    readonly saveLabel: string
    /** The words on the button that closes the change without sending. */
    readonly cancelLabel: string
}

/** What the commands of the proposal are. */
interface ConversationProposalActions {
    readonly approve: ActionHandle
    readonly edit: ActionHandle
    readonly reject: ActionHandle
}

/** What a command of the proposal is run with: the proposal, and the changed words for an edit. */
export interface ProposalInput {
    readonly id: string
    readonly values?: { readonly text: string }
}

/** What the card of a proposed reply is given. */
interface ConversationProposalProps {
    readonly proposal: ProposalRow
    readonly words: ConversationProposalWords
    readonly actions: ConversationProposalActions
    /** Runs a command on the proposal; the thread tells the person when it did not go through. */
    readonly onRun: (action: ActionHandle, input: ProposalInput) => void
}

/** The proposal with what closes its change form. */
interface ProposalEditFormProps extends ConversationProposalProps {
    readonly onClose: () => void
}

/** The proposal with what opens its change form. */
interface ProposalCommandsProps extends ConversationProposalProps {
    readonly onEdit: () => void
}

/** The change form of the reply: the words in a field, to send as they stand or to leave. */
const ProposalEditForm = (props: ProposalEditFormProps): ReactNode => {
    const [text, setText] = useState(props.proposal.text)
    const { edit } = props.actions
    return (
        <Form
            label={props.words.title}
            isPending={edit.isRunning}
            onSubmit={() => {
                props.onRun(edit, { id: props.proposal.id, values: { text } })
                props.onClose()
            }}
        >
            <Textarea
                name="text"
                label={props.words.title}
                isLabelHidden
                rows={3}
                value={text}
                onValueChange={setText}
            />
            <Cluster gap="inline">
                <Button type="submit" intent="commit" isPending={edit.isRunning} isDisabled={text.trim() === ""}>
                    {props.words.saveLabel}
                </Button>
                <Button intent="neutral" onPress={props.onClose}>
                    {props.words.cancelLabel}
                </Button>
            </Cluster>
        </Form>
    )
}

/** The commands of the proposal: the one that sends it, the one that changes it, and the menu that refuses it. */
const ProposalCommands = (props: ProposalCommandsProps): ReactNode => {
    const { approve, edit, reject } = props.actions
    const id = props.proposal.id
    return (
        <Cluster gap="inline">
            {approve.isAllowed ? (
                <Button intent="commit" isPending={approve.isRunning} onPress={() => props.onRun(approve, { id })}>
                    {approve.label}
                </Button>
            ) : null}
            {edit.isAllowed ? (
                <Button intent="alternative" onPress={props.onEdit}>
                    {edit.label}
                </Button>
            ) : null}
            {reject.isAllowed ? (
                <DropdownMenu
                    placement="bottom end"
                    trigger={
                        <Button intent="neutral" isPending={reject.isRunning}>
                            {props.words.moreLabel}
                        </Button>
                    }
                    entries={[
                        {
                            id: "reject",
                            label: reject.label,
                            tone: "danger",
                            onAction: () => props.onRun(reject, { id }),
                        },
                    ]}
                />
            ) : null}
        </Cluster>
    )
}

/**
 * A reply an agent proposes inside the thread: what the customer asked, the words proposed, a line of guidance, and the commands to
 * send it, change it or refuse it.
 */
export const ConversationProposal = (props: ConversationProposalProps): ReactNode => {
    const [isEditing, setIsEditing] = useState(false)
    const { proposal } = props
    return (
        <Stack gap="row">
            <Heading level={3}>{props.words.title}</Heading>
            {proposal.asked === "" ? null : (
                <Text size="sm" tone="muted">
                    {proposal.asked}
                </Text>
            )}
            {isEditing ? (
                <ProposalEditForm {...props} onClose={() => setIsEditing(false)} />
            ) : (
                <>
                    <Quote text={proposal.text} />
                    {proposal.note === "" ? null : (
                        <Text size="sm" tone="muted">
                            {proposal.note}
                        </Text>
                    )}
                    <ProposalCommands {...props} onEdit={() => setIsEditing(true)} />
                </>
            )}
        </Stack>
    )
}
