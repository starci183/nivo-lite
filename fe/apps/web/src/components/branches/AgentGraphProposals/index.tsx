import {
    Badge,
    Button,
    DescriptionList,
    Disclosure,
    EmptyNotice,
    List,
    ListRow,
    SectionHeader,
    Text,
} from "@starci/grammar/common"
import type {
    AgentGraphEvidenceData,
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
const evidenceItemsOf = (rows: ReadonlyArray<AgentGraphEvidenceData>) =>
    rows.map((row) => ({ id: row.id, term: row.line, description: row.outcome }))

/** A rule with the word that says whose it is. */
interface SourceRowProps {
    readonly title: string
    readonly source: AgentGraphSourceData
}

/** Where the map stands against the Brain: the rule it follows, and the rule that replaced it. */
const SourceRow = (props: SourceRowProps) => (
    <ListRow title={props.source.quote} description={props.source.place} badges={<Badge>{props.title}</Badge>} />
)

/** One proposal and whether it waits for its data. */
interface ProposalBodyProps {
    readonly item: AgentGraphProposalView
    readonly isSkeleton: boolean
}

/** The body of one proposal: the two rules of a conflict with what switching changes, or the evidence of a learned change. */
const ProposalBody = (props: ProposalBodyProps) => {
    const { item } = props
    const preview = item.evidence.slice(0, PREVIEW)
    const rest = item.evidence.slice(PREVIEW)
    return (
        <>
            {item.before === null || item.after === null ? null : (
                <List label={item.title}>
                    <SourceRow title={item.beforeTitle} source={item.before} />
                    <SourceRow title={item.afterTitle} source={item.after} />
                </List>
            )}
            {item.effects.length === 0
                ? null
                : item.effects.map((effect) => (
                      <Text key={effect} as="p" size="sm" isSkeleton={props.isSkeleton}>
                          {effect}
                      </Text>
                  ))}
            {preview.length === 0 ? null : (
                <DescriptionList layout="columns" isDivided items={evidenceItemsOf(preview)} />
            )}
            {rest.length === 0 ? null : (
                <Disclosure title={item.evidenceMoreLabel}>
                    <DescriptionList layout="columns" isDivided items={evidenceItemsOf(rest)} />
                </Disclosure>
            )}
        </>
    )
}

/** One proposal as a row, and the choice on it. */
interface ProposalRowProps extends ProposalBodyProps {
    readonly onDecide: AgentGraphProposalsProps["onDecide"]
}

/** One proposal as a row: its kind and reach, why NIVO proposes it, what proves it, and add-to-draft or dismiss. */
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
            <ProposalBody item={item} isSkeleton={props.isSkeleton} />
            <Button
                intent="alternative"
                size="sm"
                isSkeleton={props.isSkeleton}
                isDisabled={item.confirmBlocked !== ""}
                {...(item.confirmBlocked === "" ? {} : { disabledReason: item.confirmBlocked })}
                onPress={() => props.onDecide(item.id, true)}
            >
                {item.confirmLabel}
            </Button>
            <Button
                intent="neutral"
                size="sm"
                isSkeleton={props.isSkeleton}
                onPress={() => props.onDecide(item.id, false)}
            >
                {item.keepLabel}
            </Button>
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
