import { Badge, Cluster, DescriptionList, Link, Quote, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { DecisionHistoryRowView } from "@/modules/types"

/** The words of the decision detail. */
export interface DecisionDetailCopy {
    readonly decisionTitle: string
    readonly whyTitle: string
    readonly basisLabel: string
    readonly noteLabel: string
    readonly noLead: string
    readonly terms: {
        readonly job: string
        readonly department: string
        readonly decider: string
        readonly outcome: string
        readonly when: string
        readonly lead: string
    }
}

/** What the opened decision draws below its head. */
interface DecisionDetailProps {
    readonly row: DecisionHistoryRowView
    readonly copy: DecisionDetailCopy
    /** The decision is still being read: the terms stay real and the facts draw as geometry. */
    readonly isLoading: boolean
}

/** What the person who decided draws. */
interface DeciderValueProps {
    readonly name: string
}

/** The person who decided: their mark and their name. */
const DeciderValue = (props: DeciderValueProps) => (
    <Cluster gap="inline" align="center">
        <PersonAvatar name={props.name} size="xs" />
        <Text as="span">{props.name}</Text>
    </Cluster>
)

/** The lead of the decision as a link, or the words that none is attached. */
const LeadValue = (props: Pick<DecisionDetailProps, "row" | "copy">) =>
    props.row.leadHref === null ? (
        <Text tone="muted">{props.copy.noLead}</Text>
    ) : (
        <Link href={props.row.leadHref}>{props.row.leadLabel}</Link>
    )

/** Why NIVO asked: the reason and what it means, what it rested on, and the note. */
const Why = (props: Pick<DecisionDetailProps, "row" | "copy" | "isLoading">) => (
    <SurfaceCard label={props.copy.whyTitle} isLoading={props.isLoading}>
        <Stack gap="row">
            {props.row.reasonTitle === null ? null : (
                <Stack gap="identity">
                    <Text isStrong>{props.row.reasonTitle}</Text>
                    <Text size="sm" tone="muted">
                        {props.row.reasonHint ?? ""}
                    </Text>
                </Stack>
            )}
            {props.row.basis === null ? null : <Quote source={props.copy.basisLabel} text={props.row.basis} />}
            {props.row.note === null ? null : <Quote source={props.copy.noteLabel} text={props.row.note} />}
        </Stack>
    </SurfaceCard>
)

/** The decision's facts, then why NIVO asked when the decision has a reason, a basis or a note. */
export const DecisionDetail = (props: DecisionDetailProps) => {
    const { row, copy } = props
    const decider = row.isPolicy ? row.decider : <DeciderValue name={row.decider} />
    return (
        <>
            <SurfaceCard label={copy.decisionTitle} isLoading={props.isLoading}>
                <DescriptionList
                    isLoading={props.isLoading}
                    items={[
                        { id: "job", term: copy.terms.job, description: row.title },
                        { id: "department", term: copy.terms.department, description: row.departmentLabel },
                        { id: "decider", term: copy.terms.decider, description: decider },
                        {
                            id: "outcome",
                            term: copy.terms.outcome,
                            description: <Badge tone={row.outcomeTone}>{row.outcomeLabel}</Badge>,
                        },
                        { id: "when", term: copy.terms.when, description: row.whenLong },
                        { id: "lead", term: copy.terms.lead, description: <LeadValue row={row} copy={copy} /> },
                    ]}
                />
            </SurfaceCard>
            {row.reasonTitle === null && row.basis === null && row.note === null ? null : (
                <Why row={row} copy={copy} isLoading={props.isLoading} />
            )}
        </>
    )
}
