import { Button, ButtonGroup, List, ListRow } from "@starci/grammar/common"

/** One item NIVO filled and the owner did not confirm yet, as the chat proposes it ("Item 4 - ..."). */
interface SetupProposal {
    readonly key: string
    readonly title: string
    readonly evidence: string
}

/** The proposals, the words of their actions and what confirming or editing one does. */
interface SetupProposalsProps {
    readonly proposals: ReadonlyArray<SetupProposal>
    readonly label: string
    readonly confirmLabel: string
    readonly editLabel: string
    readonly onConfirm: (gateKey: string) => void
    readonly onEdit: (gateKey: string, evidence: string) => void
}

/** The proposals of NIVO under its latest reply: each item with its value, to confirm or to edit in the checklist. */
export const SetupProposals = (props: SetupProposalsProps) => (
    <List label={props.label}>
        {props.proposals.map((proposal) => (
            <ListRow
                key={proposal.key}
                title={proposal.title}
                description={proposal.evidence}
                actions={
                    <ButtonGroup label={proposal.title}>
                        <Button intent="neutral" size="sm" onPress={() => props.onConfirm(proposal.key)}>
                            {props.confirmLabel}
                        </Button>
                        <Button
                            intent="neutral"
                            size="sm"
                            onPress={() => props.onEdit(proposal.key, proposal.evidence)}
                        >
                            {props.editLabel}
                        </Button>
                    </ButtonGroup>
                }
            />
        ))}
    </List>
)
