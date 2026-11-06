import type { ReactNode } from "react"
import { EmptyNotice, Link, SurfaceCard, Text } from "@starci/grammar/common"
import type { KnowledgeRegionView } from "../../views/views.types"

/** Copy and view of the knowledge region; `isLoading` draws the same card with blank geometry while the data is read. */
interface KnowledgeRegionProps {
    readonly label: string
    readonly view: KnowledgeRegionView
    readonly isLoading: boolean
}

/** What the agent can read: its lens, public and internal. The open gaps stand in their own card. */
export const KnowledgeRegion = (props: KnowledgeRegionProps): ReactNode => (
    <SurfaceCard
        kind="list"
        label={props.label}
        labelEnd={<Link href={props.view.openHref}>{props.view.openLabel}</Link>}
        isLoading={props.isLoading}
        items={[
            { id: "public", title: props.view.publicTitle, description: props.view.publicDescription },
            { id: "internal", title: props.view.internalTitle, description: props.view.internalDescription },
        ]}
        empty={<EmptyNotice message={props.view.footer} />}
        footer={
            <Text size="sm" tone="muted" isLoading={props.isLoading}>
                {props.view.footer}
            </Text>
        }
    />
)
