import { Badge, Button, ButtonGroup, EmptyNotice, List, ListRow, SurfaceListCard } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { RegionState } from "@/components/branches/RegionState"
import type { RegionFailure } from "@/components/branches/RegionState"

/** One badge of a gateway row. */
export interface McpGatewayBadge {
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

/** One row of a gateway list: a title, a line under it, its badges, its commands and the rows it holds (a connector's tools). */
interface McpGatewayRow {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly badges: ReadonlyArray<McpGatewayBadge>
    readonly actions?: ReadonlyArray<McpGatewayAction>
    readonly tools?: { readonly label: string; readonly rows: ReadonlyArray<McpGatewayRow> }
}

/** One card of the gateway region. */
export interface McpGatewayCard {
    readonly label: string
    readonly rows: ReadonlyArray<McpGatewayRow>
    readonly emptyMessage: string
    readonly emptyDescription: string
}

/** Copy and state of the MCP gateway region. */
interface McpGatewayRegionProps {
    readonly label: string
    readonly isLoading: boolean
    readonly isFailed: boolean
    readonly view: { readonly cards: ReadonlyArray<McpGatewayCard> }
    readonly failure: RegionFailure
    readonly onRetry: () => void
}

/** The badges a row draws. */
interface RowBadgesProps {
    readonly badges: ReadonlyArray<McpGatewayBadge>
}

/** The commands a row draws, named by the row. */
interface RowActionsProps {
    readonly label: string
    readonly actions: ReadonlyArray<McpGatewayAction>
}

/** The row a gateway list draws. */
interface GatewayRowProps {
    readonly row: McpGatewayRow
}

/** The badges of one row. */
const RowBadges = (props: RowBadgesProps) => (
    <>
        {props.badges.map((badge) => (
            <Badge key={badge.label} tone={badge.tone}>
                {badge.label}
            </Badge>
        ))}
    </>
)

/** The commands of one row, joined in one group; nothing when the row has none. */
const RowActions = (props: RowActionsProps) =>
    props.actions.length === 0 ? null : (
        <ButtonGroup label={props.label}>
            {props.actions.map((action) => (
                <Button
                    key={action.id}
                    size="sm"
                    variant="secondary"
                    isPending={action.isPending}
                    isDisabled={action.isDisabled}
                    onPress={action.onPress}
                >
                    {action.label}
                </Button>
            ))}
        </ButtonGroup>
    )

/** One gateway row with its commands and, under it, the rows it holds. */
const GatewayRow = (props: GatewayRowProps) => (
    <ListRow
        title={props.row.title}
        description={props.row.description}
        badges={<RowBadges badges={props.row.badges} />}
        actions={<RowActions label={props.row.title} actions={props.row.actions ?? []} />}
    >
        {props.row.tools === undefined || props.row.tools.rows.length === 0 ? null : (
            <List label={props.row.tools.label}>
                {props.row.tools.rows.map((tool) => (
                    <ListRow
                        key={tool.id}
                        title={tool.title}
                        description={tool.description}
                        badges={<RowBadges badges={tool.badges} />}
                    />
                ))}
            </List>
        )}
    </ListRow>
)

/**
 * The workspace's MCP gateway: its connectors with their pinned tools and the approve and check commands, each agent's grants,
 * and the masked audit log.
 */
export const McpGatewayRegion = (props: McpGatewayRegionProps) => (
    <RegionState
        label={props.label}
        isLoading={props.isLoading}
        isFailed={props.isFailed}
        view={props.view}
        failure={props.failure}
        onRetry={props.onRetry}
    >
        {(view) => (
            <>
                {view.cards.map((card) => (
                    <SurfaceListCard
                        key={card.label}
                        label={card.label}
                        empty={<EmptyNotice message={card.emptyMessage} description={card.emptyDescription} />}
                    >
                        {card.rows.map((row) => (
                            <GatewayRow key={row.id} row={row} />
                        ))}
                    </SurfaceListCard>
                ))}
            </>
        )}
    </RegionState>
)
