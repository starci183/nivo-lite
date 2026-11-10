import { Badge, Cluster, DataTable, EmptyNotice, Meter, Link, Section, Stack, Text } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import type { OverviewAgentView } from "@/modules/types"

/** The column heads of the table. */
interface OverviewAgentColumns {
    readonly agent: string
    readonly tasks: string
    readonly auto: string
    readonly waiting: string
    readonly errors: string
    readonly response: string
    readonly saved: string
    readonly credits: string
}

/** What the agents card is told. */
interface OverviewAgentsCardProps {
    readonly props: {
        readonly title: string
        readonly note: string
        readonly openLabel: string
        readonly columns: OverviewAgentColumns
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly agents: ReadonlyArray<OverviewAgentView>
        readonly isLoading: boolean
    }
    /** Where the head link leads. */
    readonly href: string
}

/** How one agent did in the period: tasks, the share done alone, what waits for the owner, errors, time to answer, hours saved and credits. */
export const OverviewAgentsCard = (props: OverviewAgentsCardProps) => {
    const copy = props.props
    const { columns } = copy
    return (
        <Section
            title={copy.title}
            headingLevel={2}
            isLoading={copy.isLoading}
            caption={copy.note}
            action={
                <Link variant="head" href={props.href}>
                    {copy.openLabel}
                </Link>
            }
        >
            <DataTable
                label={copy.title}
                isLoading={copy.isLoading}
                columns={[
                    { id: "agent", label: columns.agent, isRowHeader: true },
                    { id: "tasks", label: columns.tasks, isNumeric: true },
                    { id: "auto", label: columns.auto, isNumeric: true, priority: "low" },
                    { id: "waiting", label: columns.waiting, isNumeric: true },
                    { id: "errors", label: columns.errors, isNumeric: true, priority: "low" },
                    { id: "response", label: columns.response, isNumeric: true, priority: "low" },
                    { id: "saved", label: columns.saved, isNumeric: true },
                    { id: "credits", label: columns.credits, isNumeric: true, priority: "low" },
                ]}
                rows={copy.agents}
                renderCell={(agent, columnId) => {
                    switch (columnId) {
                        case "tasks":
                            return <Text isLoading={copy.isLoading}>{agent.tasks}</Text>
                        case "auto":
                            return agent.autoShare === null ? (
                                <Text tone="muted" isLoading={copy.isLoading}>
                                    {agent.auto}
                                </Text>
                            ) : (
                                <Meter
                                    label={columns.auto}
                                    isLabelHidden
                                    size="sm"
                                    value={agent.autoShare}
                                    minValue={0}
                                    maxValue={100}
                                    valueLabel={agent.auto}
                                    isLoading={copy.isLoading}
                                    tone="neutral"
                                />
                            )
                        case "waiting":
                            return (
                                <Badge tone={agent.waiting === "0" ? "muted" : "warning"} isLoading={copy.isLoading}>
                                    {agent.waiting}
                                </Badge>
                            )
                        case "errors":
                            return (
                                <Badge tone={agent.errors === "0" ? "muted" : "danger"} isLoading={copy.isLoading}>
                                    {agent.errors}
                                </Badge>
                            )
                        case "response":
                            return <Text isLoading={copy.isLoading}>{agent.response}</Text>
                        case "saved":
                            return <Text isLoading={copy.isLoading}>{agent.saved}</Text>
                        case "credits":
                            return <Text isLoading={copy.isLoading}>{agent.credits}</Text>
                        default:
                            return (
                                <Cluster gap="row" align="center">
                                    <AgentMark
                                        label={agent.name}
                                        seed={agent.id}
                                        size="sm"
                                        isLoading={copy.isLoading}
                                    />
                                    <Stack gap="identity" align="start">
                                        <Text isLoading={copy.isLoading}>{agent.name}</Text>
                                        <Text size="xs" tone="muted" isLoading={copy.isLoading}>
                                            {"@" + agent.handle}
                                        </Text>
                                    </Stack>
                                </Cluster>
                            )
                    }
                }}
                emptyContent={<EmptyNotice message={copy.emptyTitle} description={copy.emptyBody} />}
            />
        </Section>
    )
}
