import { Badge, Cluster, Link, Section, Stack, Text } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { OverviewPaneCopy, OverviewPaneReady } from "@/modules/types"

/** What the two "needs you" sections draw. */
interface OverviewAsideWaitingProps {
    readonly data: OverviewPaneReady
    readonly copy: OverviewPaneCopy
    readonly isLoading: boolean
}

/** One waiting decision: who asked and why, with the way to decide it in the Office. */
const rowOf = (
    item: OverviewPaneReady["waiting"]["items"][number],
    seeInOffice: string,
    officeHref: string,
): ListRowData => ({
    id: item.id,
    title: item.title,
    description: item.line,
    leading: { icon: nivoIconSource("review", "leading") },
    action: { label: seeInOffice, href: officeHref },
})

/** What the exceptions draw. */
interface ExceptionsProps {
    readonly officeHref: string
    readonly exceptions: OverviewPaneReady["exceptions"]
    readonly copy: OverviewPaneCopy
    readonly isLoading: boolean
}

/** The work that stopped: how many, by which reason, and the way to see it. */
const Exceptions = (props: ExceptionsProps) => {
    const { total, chips } = props.exceptions
    if (total === null) {
        return (
            <Text size="sm" tone="muted" isLoading={props.isLoading}>
                {props.copy.exceptionsNone}
            </Text>
        )
    }
    return (
        <Stack gap="row">
            <Text size="sm">{total}</Text>
            <Cluster gap="inline">
                {chips.map((chip) => (
                    <Badge key={chip.id} tone={chip.tone}>
                        {chip.label}
                    </Badge>
                ))}
            </Cluster>
            <Link href={props.officeHref}>{props.copy.seeInOffice}</Link>
        </Stack>
    )
}

/** The decisions that wait for the owner and the exceptions that need a look: the top of the side pane. */
export const OverviewAsideWaiting = (props: OverviewAsideWaitingProps) => (
    <>
        <Section
            kind="list"
            title={props.copy.waitingTitle}
            headingLevel={3}
            count={props.data.pending}
            isLoading={props.isLoading}
            empty={
                <Text size="sm" tone="muted" isLoading={props.isLoading}>
                    {props.copy.waitingNone}
                </Text>
            }
            items={props.data.waiting.items.map((item) => rowOf(item, props.copy.seeInOffice, props.data.links.office))}
        />
        <Section title={props.copy.exceptionsTitle} headingLevel={3} isLoading={props.isLoading}>
            <Exceptions
                exceptions={props.data.exceptions}
                officeHref={props.data.links.office}
                copy={props.copy}
                isLoading={props.isLoading}
            />
        </Section>
    </>
)
