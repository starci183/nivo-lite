import { Badge, Button, DescriptionList, EmptyNotice, SectionHeader, Text } from "@starci/grammar/common"
import type { AgentGraphBranchesView } from "@/modules/types"

/** Every branch of the graph as a sentence, for the phone where four lanes cannot be read. */
interface AgentGraphBranchesProps {
    readonly view: AgentGraphBranchesView
    readonly isSkeleton: boolean
    readonly onOpen: (nodeKey: string) => void
}

/** The question the agent asks, then each answer: when it applies, what happens, with what and on whose rule. */
export const AgentGraphBranches = (props: AgentGraphBranchesProps) => (
    <>
        <SectionHeader level={3} title={props.view.title} description={props.view.hint} isSkeleton={props.isSkeleton} />
        {props.isSkeleton || props.view.rows.length > 0 ? null : <EmptyNotice message={props.view.emptyLabel} />}
        <DescriptionList
            layout="stacked"
            isDivided
            isLoading={props.isSkeleton}
            items={props.view.rows.map((row) => ({
                id: row.id,
                term: row.when,
                description: (
                    <>
                        <Text weight="semibold" isSkeleton={props.isSkeleton}>
                            {row.title}
                        </Text>
                        <Text size="sm" tone="muted" isSkeleton={props.isSkeleton}>
                            {row.line}
                        </Text>
                        {row.source === "" ? null : <Badge isSkeleton={props.isSkeleton}>{row.source}</Badge>}
                        <Button
                            intent="neutral"
                            size="sm"
                            isSkeleton={props.isSkeleton}
                            onPress={() => props.onOpen(row.nodeKey)}
                        >
                            {row.openLabel}
                        </Button>
                    </>
                ),
            }))}
        />
    </>
)
