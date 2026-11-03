import type { ReactNode } from "react"
import { Badge, Cluster, EmptyNotice, Link, SurfaceCard } from "@starci/grammar/common"
import type { KnowledgeGapsView } from "../../views/views.types"

/** Copy and view of the knowledge gaps card. */
interface KnowledgeGapsCardProps {
    readonly emptyMessage: string
    readonly view: KnowledgeGapsView
    readonly isLoading: boolean
}

/** The questions the agent could not answer; the block draws it only when gaps exist. */
export const KnowledgeGapsCard = (props: KnowledgeGapsCardProps): ReactNode => (
    <SurfaceCard
        kind="list"
        label={props.view.label}
        labelEnd={
            props.view.count === null ? undefined : (
                <Cluster gap="inline" align="center">
                    <Badge tone="warning" isDot isLoading={props.isLoading}>
                        {props.view.count}
                    </Badge>
                    <Link href={props.view.openHref}>{props.view.openLabel}</Link>
                </Cluster>
            )
        }
        isLoading={props.isLoading}
        items={props.view.rows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
            badges: [{ label: row.asked, tone: "warning" as const }],
        }))}
        empty={<EmptyNotice message={props.emptyMessage} />}
    />
)
