import type { ReactNode } from "react"
import { Badge, Button, Cluster, EmptyNotice, Link, Pane, PaneGrid, PaneSection, Stack } from "@starci/grammar/common"

/** What the data page draws around the view of the set: the way back to the desk, how fresh the data is, and the view (or the state of a set nobody ships). */
export interface AgentDataBodyBaseProps {
    readonly props: {
        readonly backLabel: string
        readonly backHref: string
        /** How fresh the provider data on the page is, already in words ("Live", "Synced copy, 12 Nov 08:30"); null while no answer states it. */
        readonly freshness: string | null
        /** The state of a set the module does not ship; null when the set exists. */
        readonly unknown: { readonly title: string; readonly body: string } | null
    }
    readonly children: ReactNode
}

/** Draws the head of a data page (back link at the start, freshness at the end) above the view, both inside one padded well (the frame around it holds its pane flush), or the state of an unknown set with the way back. */
export const AgentDataBodyBase = (props: AgentDataBodyBaseProps) => {
    const copy = props.props
    if (copy.unknown !== null)
        return (
            <PaneSection align="center" grow>
                <Stack gap="identity">
                    <EmptyNotice message={copy.unknown.title} description={copy.unknown.body} />
                    <Cluster gap="inline" justify="center">
                        <Button intent="neutral" href={copy.backHref}>
                            {copy.backLabel}
                        </Button>
                    </Cluster>
                </Stack>
            </PaneSection>
        )
    return (
        <PaneGrid label={copy.backLabel} areas={{ base: ["well"] }} columns={{ base: ["fill"] }}>
            <Pane area="well" scroll label={copy.backLabel}>
                <PaneSection gap="section">
                    <Cluster gap="row" align="center" justify="between" wrap>
                        <Link variant="plain" href={copy.backHref}>{copy.backLabel}</Link>
                        {copy.freshness === null ? null : <Badge tone="neutral">{copy.freshness}</Badge>}
                    </Cluster>
                    {props.children}
                </PaneSection>
            </Pane>
        </PaneGrid>
    )
}
