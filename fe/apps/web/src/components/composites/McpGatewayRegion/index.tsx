import type { ReactNode } from "react"
import {
    Button,
    Cluster,
    EmptyNotice,
    Section,
    Stack,
    SurfaceCard,
    Switch,
    Text,
    type ListRowData,
    type BadgeTone,
} from "@starci/grammar/common"

/** One badge of a gateway row. */
interface McpGatewayBadge {
    readonly label: string
    readonly tone: BadgeTone
}

/** One command button of a gateway row. */
interface McpGatewayAction {
    readonly id: string
    readonly label: string
    readonly isPending: boolean
    readonly isDisabled: boolean
    readonly onPress: () => void
}

/** One agent's switch for one tool: on means the agent may call it. */
interface McpGatewayAgentSwitch {
    readonly id: string
    readonly name: string
    readonly isOn: boolean
    readonly isDisabled: boolean
    readonly onToggle: (isOn: boolean) => void
}

/** The agents a tool can be turned on for, each with a switch (default deny: a tool nobody switched on is called by nobody). */
interface McpGatewayAgents {
    readonly label: string
    readonly switchLabel: string
    readonly rows: ReadonlyArray<McpGatewayAgentSwitch>
}

/** One row of a gateway list: a title, a line under it, its badges, its commands and the rows it holds (a connector's tools). */
interface McpGatewayRow {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly badges: ReadonlyArray<McpGatewayBadge>
    readonly actions?: ReadonlyArray<McpGatewayAction>
    readonly tools?: { readonly label: string; readonly rows: ReadonlyArray<McpGatewayRow> }
    readonly agents?: McpGatewayAgents
}

/** One card of the gateway region. */
interface McpGatewayCard {
    readonly label: string
    readonly rows: ReadonlyArray<McpGatewayRow>
    readonly emptyMessage: string
    readonly emptyDescription: string
}

/** What the gateway region draws once its reads are in. */
interface McpGatewayView {
    readonly cards: ReadonlyArray<McpGatewayCard>
}

/** The cards of the MCP gateway region; `isLoading` draws them as placeholders. */
interface McpGatewayRegionProps {
    readonly view: McpGatewayView
    readonly isLoading: boolean
}

/** The commands a row draws, named by the row. */
interface RowActionsProps {
    readonly actions: ReadonlyArray<McpGatewayAction>
    readonly isLoading: boolean
}

/** Pending commands retain their own busy state rather than becoming plain navigation data. */
const RowActions = (props: RowActionsProps) =>
    props.actions.length === 0 ? null : (
        <Cluster gap="inline">
            {props.actions.map((action) => (
                <Button
                    key={action.id}
                    size="sm"
                    intent="neutral"
                    isLoading={props.isLoading}
                    isPending={action.isPending}
                    isDisabled={action.isDisabled}
                    onPress={action.onPress}
                >
                    {action.label}
                </Button>
            ))}
        </Cluster>
    )

/** Unpainted tool detail preserves every grant switch inside its containing row. */
const agentsOf = (agents: McpGatewayAgents, isLoading: boolean) =>
    agents.rows.length === 0 ? null : (
        <Section
            kind="list"
            title={agents.label}
            headingLevel={4}
            isLoading={isLoading}
            empty={<EmptyNotice message={agents.label} />}
            items={agents.rows.map((agent) => ({
                id: agent.id,
                title: agent.name,
                detail: (
                    <Switch
                        name={"grant-" + agent.id}
                        label={agents.switchLabel + " " + agent.name}
                        isLabelHidden
                        isSelected={agent.isOn}
                        isDisabled={agent.isDisabled}
                        isLoading={isLoading}
                        onSelectedChange={agent.onToggle}
                    />
                ),
            }))}
        />
    )

/** Keep the tool's operational badges bounded while preserving its remaining facts under the row. */
const gatewayItemOf = (row: McpGatewayRow, isLoading: boolean): ListRowData => {
    const [status, exception, ...facts] = row.badges
    let badges: ListRowData["badges"]
    if (status !== undefined) badges = exception === undefined ? [status] : [status, exception]
    const tools = row.tools
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        ...(badges === undefined ? {} : { badges }),
        detail: (
            <Stack gap="row">
                {facts.length === 0 ? null : (
                    <Cluster gap="inline">
                        {facts.map((fact) => (
                            <Text key={fact.label} size="xs" tone="muted" isLoading={isLoading}>
                                {fact.label}
                            </Text>
                        ))}
                    </Cluster>
                )}
                <RowActions actions={row.actions ?? []} isLoading={isLoading} />
                {row.agents === undefined ? null : agentsOf(row.agents, isLoading)}
                {tools === undefined || tools.rows.length === 0 ? null : (
                    <Section
                        kind="list"
                        title={tools.label}
                        headingLevel={3}
                        isLoading={isLoading}
                        empty={<EmptyNotice message={tools.label} />}
                        items={tools.rows.map((tool) => gatewayItemOf(tool, isLoading))}
                    />
                )}
            </Stack>
        ),
    }
}

/**
 * The workspace's MCP gateway: its connectors with their pinned tools and the approve and check commands, each agent's grants,
 * and the masked audit log.
 */
export const McpGatewayRegion = (props: McpGatewayRegionProps): ReactNode =>
    props.view.cards.map((card) => (
        <SurfaceCard
            kind="list"
            key={card.label}
            label={card.label}
            isLoading={props.isLoading}
            empty={<EmptyNotice message={card.emptyMessage} description={card.emptyDescription} />}
            items={card.rows.map((row) => gatewayItemOf(row, props.isLoading))}
        />
    ))
