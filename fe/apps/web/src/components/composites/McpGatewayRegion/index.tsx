import { Badge, EmptyNotice, ListRow, SurfaceListCard } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { RegionState } from "@/components/branches/RegionState"
import type { RegionFailure } from "@/components/branches/RegionState"

/** One badge of a gateway row. */
export interface McpGatewayBadge {
    readonly label: string
    readonly tone: BadgeTone
}

/** One row of a gateway list: a title, a line under it and its badges. */
export interface McpGatewayRow {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly badges: ReadonlyArray<McpGatewayBadge>
}

/** One card of the gateway region. */
export interface McpGatewayCard {
    readonly label: string
    readonly rows: ReadonlyArray<McpGatewayRow>
    readonly emptyMessage: string
    readonly emptyDescription: string
}

/** Copy and state of the MCP gateway region. */
export interface McpGatewayRegionProps {
    readonly label: string
    readonly isLoading: boolean
    readonly isFailed: boolean
    readonly view: { readonly cards: ReadonlyArray<McpGatewayCard> }
    readonly failure: RegionFailure
    readonly onRetry: () => void
}

/** The workspace's MCP gateway: its connectors and their namespaced tools, each agent's grants, and the masked audit log. */
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
                            <ListRow
                                key={row.id}
                                title={row.title}
                                description={row.description}
                                badges={
                                    <>
                                        {row.badges.map((badge) => (
                                            <Badge key={badge.label} tone={badge.tone}>
                                                {badge.label}
                                            </Badge>
                                        ))}
                                    </>
                                }
                            />
                        ))}
                    </SurfaceListCard>
                ))}
            </>
        )}
    </RegionState>
)
