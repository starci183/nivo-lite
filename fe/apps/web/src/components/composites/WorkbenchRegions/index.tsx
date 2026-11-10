import type { ReactNode } from "react"
import {
    Badge,
    Disclosure,
    EmptyNotice,
    Link,
    Section,
    Stack,
    Text,
    type BadgeTone,
    type ListRowData,
} from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { WorkbenchDashboardRegions } from "@/modules/types"

/** What the collapsed rows under the decisions read: the regions of the dashboard and the command that asks for them again. */
interface WorkbenchRegionsProps {
    readonly regions: WorkbenchDashboardRegions
    readonly onRetry: () => void
}

/** One collapsed row: its title and one chip at the end, and under it the rows it lists and the lines after them. */
interface RegionRowProps {
    readonly label: string
    readonly chip: { readonly text: string; readonly tone: BadgeTone; readonly isDot?: boolean }
    readonly isLoading: boolean
    readonly items: ReadonlyArray<ListRowData>
    readonly emptyMessage: string
    readonly emptyDescription?: string
    /** What follows the rows: a note and the link to the region's page. */
    readonly after: ReactNode
}

const RegionRow = (props: RegionRowProps) => (
    <Disclosure
        title={props.label}
        summary={
            <Badge tone={props.chip.tone} isDot={props.chip.isDot === true} isLoading={props.isLoading}>
                {props.chip.text}
            </Badge>
        }
        body={
            <Stack gap="section">
                <Section
                    kind="list"
                    title={props.label}
                    headingLevel={4}
                    isLoading={props.isLoading}
                    items={[...props.items]}
                    empty={
                        <EmptyNotice
                            message={props.emptyMessage}
                            {...(props.emptyDescription === undefined ? {} : { description: props.emptyDescription })}
                        />
                    }
                />
                {props.after}
            </Stack>
        }
    />
)

/**
 * The agent's finished work and its knowledge as two collapsed rows under the decisions: a title and one
 * chip each, the list opens under it. Each row reads and fails on its own: its title stays real while the chip and the lines
 * wait, and a failed read shows the band with its retry in the row's place.
 */
export const WorkbenchRegions = (props: WorkbenchRegionsProps) => (
    <>
        <SlotView
            {...props.regions.done}
            onRetry={props.onRetry}
            render={(view, isLoading) => (
                <RegionRow
                    label={props.regions.done.label}
                    chip={{ text: view.count, tone: "success", isDot: true }}
                    isLoading={isLoading}
                    items={view.rows.map((row) => ({
                        id: row.id,
                        title: row.title,
                        description: row.description,
                        href: row.href,
                    }))}
                    emptyMessage={view.emptyMessage}
                    emptyDescription={view.emptyDescription}
                    after={<Link href={view.logHref}>{view.logLabel}</Link>}
                />
            )}
        />
        <SlotView
            {...props.regions.knowledge}
            onRetry={props.onRetry}
            render={(view, isLoading) => (
                <RegionRow
                    label={props.regions.knowledge.label}
                    chip={{ text: view.summary, tone: "neutral" }}
                    isLoading={isLoading}
                    items={[
                        { id: "public", title: view.publicTitle, description: view.publicDescription },
                        { id: "internal", title: view.internalTitle, description: view.internalDescription },
                    ]}
                    emptyMessage={view.footer}
                    after={
                        <>
                            <Text size="sm" tone="muted" isLoading={isLoading}>
                                {view.footer}
                            </Text>
                            <Link href={view.openHref}>{view.openLabel}</Link>
                        </>
                    }
                />
            )}
        />
    </>
)
