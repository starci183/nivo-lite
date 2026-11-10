import { DataTable, EmptyNotice, Meter, Link, Section, Stack, Text } from "@starci/grammar/common"
import type { OverviewChannelView } from "@/modules/types"

/** The column heads of the table. */
interface OverviewChannelColumns {
    readonly channel: string
    readonly customers: string
    readonly revenue: string
}

/** What the channels card is told. */
interface OverviewChannelsCardProps {
    readonly props: {
        readonly title: string
        readonly note: string
        readonly openLabel: string
        readonly columns: OverviewChannelColumns
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly channels: ReadonlyArray<OverviewChannelView>
        readonly isLoading: boolean
    }
    /** Where the head link leads. */
    readonly href: string
}

/** Where customers come from: customers and money per channel, the busiest channel first, and the way into the Inbox. */
export const OverviewChannelsCard = (props: OverviewChannelsCardProps) => {
    const copy = props.props
    const rows = copy.channels
    return (
        <Section
            title={copy.title}
            headingLevel={2}
            isLoading={copy.isLoading}
            caption={copy.note}
            action={
                <Link variant="head" href={props.href}>
                    {copy.openLabel}
                </Link>
            }
        >
            <DataTable
                label={copy.title}
                isLoading={copy.isLoading}
                columns={[
                    { id: "channel", label: copy.columns.channel, isRowHeader: true },
                    { id: "customers", label: copy.columns.customers, isNumeric: true },
                    { id: "revenue", label: copy.columns.revenue, isNumeric: true },
                ]}
                rows={rows}
                renderCell={(channel, columnId) => {
                    if (columnId === "customers") return <Text isLoading={copy.isLoading}>{channel.leads}</Text>
                    if (columnId === "revenue") return <Text isLoading={copy.isLoading}>{channel.revenue}</Text>
                    return (
                        <Stack gap="identity">
                            <Text isLoading={copy.isLoading}>{channel.label}</Text>
                            <Meter
                                label={channel.label}
                                isLabelHidden
                                size="sm"
                                value={channel.share}
                                minValue={0}
                                maxValue={100}
                                isLoading={copy.isLoading}
                                tone="neutral"
                            />
                        </Stack>
                    )
                }}
                emptyContent={<EmptyNotice message={copy.emptyTitle} description={copy.emptyBody} />}
            />
        </Section>
    )
}
