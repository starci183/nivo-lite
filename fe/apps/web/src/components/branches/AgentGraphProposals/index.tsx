import {
    AlertDialog,
    Cluster,
    Button,
    DescriptionList,
    Disclosure,
    EmptyNotice,
    Stack,
    Quote,
    Section,
    type ListRowData,
    SurfaceCard,
} from "@starci/grammar/common"
import type { AgentGraphProposalView, AgentGraphProposalsView, AgentGraphSourceData } from "@/modules/types"

/** The proposals NIVO makes and the choice the owner has on each. */
type AgentGraphProposalsProps = {
    readonly view: AgentGraphProposalsView
    readonly isLoading: boolean
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
    readonly isLoading: boolean
}

/** One source passage, named within the quote so it can share the existing subject's surface. */
const Passage = (props: PassageProps) => (
    <Quote text={props.source.quote} source={props.title} isLoading={props.isLoading} />
)

/** One proposal and whether it waits for its data. */
interface ProposalBodyProps {
    readonly item: AgentGraphProposalView
    readonly isLoading: boolean
}

/** The body of one proposal: the two passages of a conflict with what switching changes, or the evidence of a learned change. */
const ProposalBody = (props: ProposalBodyProps) => {
    const { item } = props
    const preview = item.evidence.slice(0, PREVIEW)
    const rest = item.evidence.slice(PREVIEW)
    return (
        <Stack gap="section">
            {item.before === null || item.after === null ? null : (
                <Cluster gap="row" align="start">
                    <Passage title={item.beforeTitle} source={item.before} isLoading={props.isLoading} />
                    <Passage title={item.afterTitle} source={item.after} isLoading={props.isLoading} />
                </Cluster>
            )}
            {item.effects.length === 0 ? null : (
                <Section
                    kind="list"
                    title={item.effectsTitle}
                    headingLevel={4}
                    isLoading={props.isLoading}
                    items={item.effects.map((effect) => ({ id: effect, title: effect }))}
                    empty={<EmptyNotice message={item.effectsTitle} />}
                />
            )}
            {preview.length === 0 ? null : (
                <SurfaceCard><DescriptionList layout="columns" isDivided items={evidenceItemsOf(preview)} /></SurfaceCard>
            )}
            {rest.length === 0 ? null : (
                <Disclosure
                    title={item.evidenceMoreLabel}
                    body={<DescriptionList layout="columns" isDivided items={evidenceItemsOf(rest)} />}
                />
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
                        intent="neutral"
                        size="sm"
                        isLoading={props.isLoading}
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
                    <Button intent="neutral" size="sm" isLoading={props.isLoading}>
                        {item.keepLabel}
                    </Button>
                }
            />
        </Cluster>
    )
}

/** One proposal contributes data to the shared collection; its evidence and confirmation controls remain in detail. */
const proposalItemOf = (item: AgentGraphProposalView, props: AgentGraphProposalsProps): ListRowData => ({
    id: item.id,
    title: item.title,
    description: item.why,
    badges: [{ label: item.kindLabel }, { label: item.widensLabel, tone: item.widensTone }],
    detail: (
        <Stack gap="section">
            <ProposalBody item={item} isLoading={props.isLoading} />
            <ProposalChoices item={item} isLoading={props.isLoading} onDecide={props.onDecide} />
        </Stack>
    ),
})

/** Proposed changes stay under one section; the confirmation still precedes every decision. */
export const AgentGraphProposals = (props: AgentGraphProposalsProps) => (
    <Section
        kind="list"
        title={props.view.title}
        caption={props.view.hint}
        isLoading={props.isLoading}
        headingLevel={3}
        items={props.view.items.map((item) => proposalItemOf(item, props))}
        empty={<EmptyNotice message={props.view.emptyText} />}
    />
)
