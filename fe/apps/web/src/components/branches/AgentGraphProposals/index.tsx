import {
    AlertDialog,
    Badge,
    Cluster,
    Button,
    DescriptionList,
    Disclosure,
    EmptyNotice,
    List,
    ListRow,
    SectionHeader,
    Stack,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import type {
    AgentGraphProposalView,
    AgentGraphProposalsView,
    AgentGraphSourceData,
} from "@/modules/types"

/** The proposals NIVO makes and the choice the owner has on each. */
type AgentGraphProposalsProps = {
    readonly view: AgentGraphProposalsView
    readonly isSkeleton: boolean
    readonly onDecide: (proposalId: string, isConfirmed: boolean) => void
}

/** How many rows of evidence show before "See all". */
const PREVIEW = 3

/** The decisions that prove a proposal, one line each: what happened and what the approver did. */
const evidenceItemsOf = (rows: AgentGraphProposalView["evidence"]) =>
    rows.map((row) => ({ id: row.id, term: row.line, description: row.outcome }))

/** A rule with the word that says whose it is. */
interface PassageProps {
    readonly title: string
    readonly source: AgentGraphSourceData
    readonly isSkeleton: boolean
}

/** One passage of a conflict in a card of its own, so the old and the new read side by side and nothing is mistaken for the other. */
const Passage = (props: PassageProps) => (
    <SurfaceCard label={props.title} headingLevel={4}>
        <Text isSkeleton={props.isSkeleton}>{props.source.quote}</Text>
    </SurfaceCard>
)

/** One proposal and whether it waits for its data. */
interface ProposalBodyProps {
    readonly item: AgentGraphProposalView
    readonly isSkeleton: boolean
}

/** The body of one proposal: the two passages of a conflict with what switching changes, or the evidence of a learned change. */
const ProposalBody = (props: ProposalBodyProps) => {
    const { item } = props
    const preview = item.evidence.slice(0, PREVIEW)
    const rest = item.evidence.slice(PREVIEW)
    return (
        <Stack gap="section">
            {item.before === null || item.after === null ? null : (
                <Stack gap="row">
                    <Passage title={item.beforeTitle} source={item.before} isSkeleton={props.isSkeleton} />
                    <Passage title={item.afterTitle} source={item.after} isSkeleton={props.isSkeleton} />
                </Stack>
            )}
            {item.effects.length === 0 ? null : (
                <List label={item.effectsTitle}>
                    {item.effects.map((effect) => (
                        <ListRow key={effect} isSkeleton={props.isSkeleton} title={effect} />
                    ))}
                </List>
            )}
            {preview.length === 0 ? null : (
                <DescriptionList layout="columns" isDivided items={evidenceItemsOf(preview)} />
            )}
            {rest.length === 0 ? null : (
                <Disclosure title={item.evidenceMoreLabel}>
                    <DescriptionList layout="columns" isDivided items={evidenceItemsOf(rest)} />
                </Disclosure>
            )}
        </Stack>
    )
}

/** One proposal as a row, and the choice on it. */
interface ProposalRowProps extends ProposalBodyProps {
    readonly onDecide: AgentGraphProposalsProps["onDecide"]
}

/**
 * The two choices on a proposal. Each opens a question first and settles the proposal only on the owner's yes, because a choice
 * made by a stray click on a rule of the business would be hard to take back.
 */
const ProposalChoices = (props: ProposalRowProps) => {
    const { item } = props
    return (
        <Cluster gap="inline">
            <AlertDialog
                title={item.confirmTitle}
                description={item.confirmBody}
                tone="informative"
                cancelLabel={item.cancelLabel}
                confirmLabel={item.confirmLabel}
                onConfirm={() => props.onDecide(item.id, true)}
                trigger={
                    <Button
                        intent="commit"
                        size="sm"
                        isSkeleton={props.isSkeleton}
                        isDisabled={item.confirmBlocked !== ""}
                        {...(item.confirmBlocked === "" ? {} : { disabledReason: item.confirmBlocked })}
                    >
                        {item.confirmLabel}
                    </Button>
                }
            />
            <AlertDialog
                title={item.keepTitle}
                description={item.keepBody}
                tone="informative"
                cancelLabel={item.cancelLabel}
                confirmLabel={item.keepLabel}
                onConfirm={() => props.onDecide(item.id, false)}
                trigger={
                    <Button intent="neutral" size="sm" isSkeleton={props.isSkeleton}>
                        {item.keepLabel}
                    </Button>
                }
            />
        </Cluster>
    )
}

/** One proposal as a row: its kind and reach, why NIVO proposes it, what proves it, and the two choices. */
const ProposalRow = (props: ProposalRowProps) => {
    const { item } = props
    return (
        <ListRow
            isSkeleton={props.isSkeleton}
            title={item.title}
            description={item.why}
            badges={
                <>
                    <Badge>{item.kindLabel}</Badge>
                    <Badge tone={item.widensTone}>{item.widensLabel}</Badge>
                </>
            }
        >
            <Stack gap="section">
                <ProposalBody item={item} isSkeleton={props.isSkeleton} />
                <ProposalChoices {...props} />
            </Stack>
        </ListRow>
    )
}

/** What the Brain changed and what NIVO learned from how the owner approves; nothing here changes the graph until a person chooses. */
export const AgentGraphProposals = (props: AgentGraphProposalsProps) => (
    <>
        <SectionHeader level={3} title={props.view.title} description={props.view.hint} isSkeleton={props.isSkeleton} />
        <List label={props.view.title}>
            {props.view.items.map((item) => (
                <ProposalRow key={item.id} item={item} isSkeleton={props.isSkeleton} onDecide={props.onDecide} />
            ))}
        </List>
        {props.view.items.length === 0 ? <EmptyNotice message={props.view.emptyText} /> : null}
    </>
)
