import type { ReactNode } from "react"
import type { WorkbenchKnowledgeRegionView as KnowledgeView } from "../view/view.types"
import { Badge, Cluster, EmptyNotice, Link, SurfaceCard, Text } from "@starci/grammar/common"
/** Copy and view of the knowledge region; `isLoading` draws the same cards with blank geometry while the data is read. */
interface KnowledgeRegionProps {
    readonly label: string
    readonly view: KnowledgeView
    readonly isLoading: boolean
}
/** What the agent can read (its lens, public and internal) and, when the data exists, the questions it could not answer. */
export const KnowledgeRegion = (props: KnowledgeRegionProps): ReactNode => {
    const { view, isLoading } = props
    return (
        <>
            <SurfaceCard
                kind="list"
                label={props.label}
                labelEnd={<Link href={view.openHref}>{view.openLabel}</Link>}
                isLoading={isLoading}
                items={[
                    { id: "public", title: view.publicTitle, description: view.publicDescription },
                    { id: "internal", title: view.internalTitle, description: view.internalDescription },
                ]}
                empty={<EmptyNotice message={view.footer} />}
                footer={
                    <Text size="sm" tone="muted" isLoading={isLoading}>
                        {view.footer}
                    </Text>
                }
            />
            {view.gaps === null || (view.gaps.rows.length === 0 && !isLoading) ? null : (
                <SurfaceCard
                    kind="list"
                    label={view.gaps.label}
                    labelEnd={
                        view.gaps.count === null ? undefined : (
                            <Cluster gap="inline" align="center">
                                <Badge tone="warning" isDot isLoading={isLoading}>
                                    {view.gaps.count}
                                </Badge>
                                <Link href={view.gaps.openHref}>{view.gaps.openLabel}</Link>
                            </Cluster>
                        )
                    }
                    isLoading={isLoading}
                    items={view.gaps.rows.map((row) => ({
                        id: row.id,
                        title: row.title,
                        description: row.description,
                        badges: [{ label: row.asked, tone: "warning" as const }],
                    }))}
                    empty={<EmptyNotice message={view.gaps.emptyMessage} description={view.gaps.emptyDescription} />}
                />
            )}
        </>
    )
}
