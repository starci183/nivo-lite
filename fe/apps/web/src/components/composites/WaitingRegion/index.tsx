import type { WorkbenchWaitingRegionView as WaitingView } from "@/modules/types"
import { EmptyNotice, Section, Text } from "@starci/grammar/common"
/** Copy and view of the waiting region; `isLoading` draws the same rows with blank geometry while the data is read. */
interface WaitingRegionProps {
    readonly label: string
    readonly view: WaitingView
    readonly isLoading: boolean
}
/** The decisions of a module that wait for a person, each linking to the decision, as rows of the side pane. */
export const WaitingRegion = (props: WaitingRegionProps) => (
    <>
        <Section
            kind="list"
            title={props.label}
            headingLevel={3}
            isLoading={props.isLoading}
            items={props.view.rows.map((row) => ({
                id: row.id,
                title: row.title,
                description: row.description,
                action: { label: props.view.openLabel, href: row.href },
            }))}
            empty={<EmptyNotice message={props.view.emptyMessage} description={props.view.emptyDescription} />}
        />
        {props.view.more === null ? null : (
            <Text size="sm" tone="muted" isLoading={props.isLoading}>
                {props.view.more}
            </Text>
        )}
    </>
)
