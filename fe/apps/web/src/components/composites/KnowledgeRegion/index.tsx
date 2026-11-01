import { Badge, ListRow, SurfaceListCard, Text, TextAction } from "@starci/grammar/common"
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

/** Copy and view of the knowledge region; `isSkeleton` draws the same cards with blank geometry while the data is read. */
export interface KnowledgeRegionProps {
    readonly label: string
    readonly view: KnowledgeView
    readonly isSkeleton: boolean
}

/** What the agent can read (its lens, public and internal) and, when the data exists, the questions it could not answer. */
export const KnowledgeRegion = (props: KnowledgeRegionProps) => {
    const { view, isSkeleton } = props
    return (
        <>
            <SurfaceListCard
                label={props.label}
                labelEnd={
                    <TextAction size="sm" href={view.openHref} isSkeleton={isSkeleton}>
                        {view.openLabel}
                    </TextAction>
                }
                footer={
                    <Text size="sm" tone="muted" isSkeleton={isSkeleton}>
                        {view.footer}
                    </Text>
                }
            >
                <ListRow isSkeleton={isSkeleton} title={view.publicTitle} description={view.publicDescription} />
                <ListRow isSkeleton={isSkeleton} title={view.internalTitle} description={view.internalDescription} />
            </SurfaceListCard>
            {view.gaps === null || (view.gaps.rows.length === 0 && !isSkeleton) ? null : (
                <SurfaceListCard
                    label={view.gaps.label}
                    labelEnd={
                        view.gaps.count === null ? undefined : (
                            <div className={LABEL_END_CLASS_NAME}>
                                <Badge tone="warning" isDot isSkeleton={isSkeleton}>
                                    {view.gaps.count}
                                </Badge>
                                <TextAction size="sm" href={view.gaps.openHref} isSkeleton={isSkeleton}>
                                    {view.gaps.openLabel}
                                </TextAction>
                            </div>
                        )
                    }
                >
                    {view.gaps.rows.map((row) => (
                        <ListRow
                            key={row.id}
                            isSkeleton={isSkeleton}
                            title={row.title}
                            description={row.description}
                            badges={<Badge tone="warning">{row.asked}</Badge>}
                        />
                    ))}
                </SurfaceListCard>
            )}
        </>
    )
}
