import { Badge, EmptyNotice, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { RegionState } from "@/components/branches/RegionState"
import type { RegionFailure } from "@/components/branches/RegionState"
import { nivoIconSource } from "@/components/leaves/Icon"
import { AgentMark } from "@/components/leaves/AgentMark"
import type { ModuleIconName } from "@/modules/types"

/** One line of a list region. */
interface ListRegionRow {
    readonly id: string
    readonly title: string
    readonly description: string
    /** The agent mark at the start of the line; null for a line that is not an agent. */
    readonly mark: { readonly glyph: ModuleIconName; readonly module: string } | null
    /** At most two status marks after the title. */
    readonly badges: ReadonlyArray<{ readonly label: string; readonly tone: BadgeTone }>
}

/** Copy and state of a list region. */
export interface ListRegionProps {
    readonly label: string
    readonly isLoading: boolean
    readonly isFailed: boolean
    readonly rows: ReadonlyArray<ListRegionRow>
    readonly emptyMessage: string
    readonly emptyDescription: string
    /** A line under the list; null for none. */
    readonly footer: string | null
    readonly failure: RegionFailure
    readonly onRetry: () => void
}

/** A card of lines that is read apart from its page: a skeleton while it loads, one Alert with a retry when it failed, else its rows. */
export const ListRegion = (props: ListRegionProps) => (
    <RegionState
        label={props.label}
        isLoading={props.isLoading}
        isFailed={props.isFailed}
        view={props.rows}
        failure={props.failure}
        onRetry={props.onRetry}
    >
        {(rows) => (
            <SurfaceListCard
                label={props.label}
                empty={<EmptyNotice message={props.emptyMessage} description={props.emptyDescription} />}
                footer={
                    props.footer === null ? undefined : (
                        <Text size="sm" tone="muted">
                            {props.footer}
                        </Text>
                    )
                }
            >
                {rows.map((row) => (
                    <ListRow
                        key={row.id}
                        title={row.title}
                        description={row.description}
                        leading={
                            row.mark === null ? undefined : (
                                <AgentMark
                                    glyph={nivoIconSource(row.mark.glyph, "leading")}
                                    module={row.mark.module}
                                    label={row.title}
                                />
                            )
                        }
                        badges={row.badges.map((badge) => (
                            <Badge key={badge.label} tone={badge.tone}>
                                {badge.label}
                            </Badge>
                        ))}
                    />
                ))}
            </SurfaceListCard>
        )}
    </RegionState>
)
