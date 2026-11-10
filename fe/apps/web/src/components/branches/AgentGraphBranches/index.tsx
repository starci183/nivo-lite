import { Badge, Button, DescriptionList, EmptyNotice, Text, Section } from "@starci/grammar/common"
import type { AgentGraphBranchesView } from "@/modules/types"

/** Every branch of the graph as a sentence, for the phone where four lanes cannot be read. */
interface AgentGraphBranchesProps {
    readonly view: AgentGraphBranchesView
    readonly isLoading: boolean
    readonly onOpen: (nodeKey: string) => void
}

/** The question the agent asks, then each answer: when it applies, what happens, with what and on whose rule. */
export const AgentGraphBranches = (props: AgentGraphBranchesProps) => (
    <Section title={props.view.title} description={props.view.hint} isLoading={props.isLoading} headingLevel={3}>
        {props.isLoading || props.view.rows.length > 0 ? null : <EmptyNotice message={props.view.emptyLabel} />}
        <DescriptionList
            layout="stacked"
            isDivided
            isLoading={props.isLoading}
            items={props.view.rows.map((row) => ({
                id: row.id,
                term: row.when,
                description: (
                    <>
                        <Text isStrong isLoading={props.isLoading}>
                            {row.title}
                        </Text>
                        <Text size="sm" tone="muted" isLoading={props.isLoading}>
                            {row.line}
                        </Text>
                        {row.source === "" ? null : <Badge isLoading={props.isLoading}>{row.source}</Badge>}
                        <Button endArrow
                            intent="neutral"
                            size="sm"
                            isLoading={props.isLoading}
                            onPress={() => props.onOpen(row.nodeKey)}
                        >
                            {row.openLabel}
                        </Button>
                    </>
                ),
            }))}
        />
    </Section>
)
