import type { WorkbenchWaitingRegionView as WaitingView } from "@/modules/types"
import { EmptyNotice, SurfaceCard, Text } from "@starci/grammar/common"
/** Copy and view of the waiting region; `isLoading` draws the same card with blank geometry while the data is read. */
export interface WaitingRegionProps {
    readonly label: string
    readonly view: WaitingView
    readonly isLoading: boolean
}
/** The decisions of a module that wait for a person, each linking to the decision. */
export const WaitingRegion = (props: WaitingRegionProps) =>
    props.view.rows.length === 0 && !props.isLoading ? null : (
        <SurfaceCard
            kind="list"
            isLoading={props.isLoading}
            label={props.view.count === null ? props.label : `${props.label} · ${props.view.count}`}
            footer={
                props.view.more === null ? undefined : (
                    <Text size="sm" tone="muted" isLoading={props.isLoading}>
                        {props.view.more}
                    </Text>
                )
            }
            items={props.view.rows.map((row) => ({
                id: row.id,
                title: row.title,
                description: row.description,
                action: { label: props.view.openLabel, href: row.href },
            }))}
            empty={<EmptyNotice message={props.view.emptyMessage} description={props.view.emptyDescription} />}
        />
    )
