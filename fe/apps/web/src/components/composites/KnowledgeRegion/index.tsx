import { Badge, EmptyNotice, ListRow, SurfaceListCard, Text, TextAction } from "@starci/grammar/common"
import { RegionState } from "@/components/branches/RegionState"
import type { RegionFailure } from "@/components/branches/RegionState"
import { LABEL_END_CLASS_NAME } from "./classNames"

/** The open knowledge gaps of the agent. */
interface GapsView {
    readonly label: string
    /** The count badge; null when no gap is open. */
    readonly count: string | null
    readonly openLabel: string
    readonly openHref: string
    readonly rows: ReadonlyArray<{
        readonly id: string
        readonly title: string
        readonly description: string
        readonly asked: string
    }>
    readonly emptyMessage: string
    readonly emptyDescription: string
}

/** What the knowledge region shows once read. */
interface KnowledgeView {
    readonly openLabel: string
    readonly openHref: string
    readonly footer: string
    readonly publicTitle: string
    readonly publicDescription: string
    readonly internalTitle: string
    readonly internalDescription: string
    /** null shows no gaps block. */
    readonly gaps: GapsView | null
}

/** Copy and state of the knowledge region. */
export interface KnowledgeRegionProps {
    readonly label: string
    readonly isLoading: boolean
    readonly isFailed: boolean
    readonly view: KnowledgeView
    readonly failure: RegionFailure
    readonly onRetry: () => void
}

/** What the agent can read (its lens, public and internal) and, when the data exists, the questions it could not answer. */
export const KnowledgeRegion = (props: KnowledgeRegionProps) => (
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
                <SurfaceListCard
                    label={props.label}
                    labelEnd={
                        <TextAction size="sm" href={view.openHref}>
                            {view.openLabel}
                        </TextAction>
                    }
                    footer={
                        <Text size="sm" tone="muted">
                            {view.footer}
                        </Text>
                    }
                >
                    <ListRow title={view.publicTitle} description={view.publicDescription} />
                    <ListRow title={view.internalTitle} description={view.internalDescription} />
                </SurfaceListCard>
                {view.gaps === null ? null : (
                    <SurfaceListCard
                        label={view.gaps.label}
                        labelEnd={
                            view.gaps.count === null ? undefined : (
                                <div className={LABEL_END_CLASS_NAME}>
                                    <Badge tone="warning" isDot>
                                        {view.gaps.count}
                                    </Badge>
                                    <TextAction size="sm" href={view.gaps.openHref}>
                                        {view.gaps.openLabel}
                                    </TextAction>
                                </div>
                            )
                        }
                        empty={
                            <EmptyNotice message={view.gaps.emptyMessage} description={view.gaps.emptyDescription} />
                        }
                    >
                        {view.gaps.rows.map((row) => (
                            <ListRow
                                key={row.id}
                                title={row.title}
                                description={row.description}
                                badges={<Badge tone="warning">{row.asked}</Badge>}
                            />
                        ))}
                    </SurfaceListCard>
                )}
            </>
        )}
    </RegionState>
)
