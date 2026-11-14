import { Alert, Badge, Button, Cluster, Drawer, EmptyNotice, Section, Stack, Text } from "@starci/grammar/common"
import { ConnectionInterestButton } from "@/components/blocks/ConnectionInterestButton"
import { ConnectionRow } from "@/components/blocks/ConnectionRow"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import type { ReactNode } from "react"
import type { Connection, ConnectorGlyph, Provider } from "@/modules/types"
import { connectorDetailClassNames as classNames } from "./classNames"

/** The logo address of a connector, only when it has one. */
const logoOf = (logo: string | undefined) => (logo === undefined ? {} : { src: logo })

/** One connection of the connector with the names of the agents bound to it. */
export interface DetailRow {
    readonly connection: Connection
    readonly agentNames: ReadonlyArray<string>
}

/** Resolve the agents displayed beneath each connection without changing the supplied order. */
export const detailRowsOf = (
    connections: ReadonlyArray<Connection>,
    agentNames: Readonly<Record<string, string>>,
): ReadonlyArray<DetailRow> =>
    connections.map((connection) => ({
        connection,
        agentNames: connection.agentIds
            .map((agentId) => agentNames[agentId])
            .filter((name): name is string => name !== undefined),
    }))

/** The connector whose detail is open, with its words resolved. */
export interface DetailEntry {
    readonly id: string
    readonly name: string
    readonly category: string
    readonly blurb: string
    readonly brings: string
    /** What the owner has to have ready before adding a connection; empty for a planned connector. */
    readonly needs: string
    readonly audience: string
    readonly statusLabel: string
    readonly isOfficial: boolean
    readonly glyph: ConnectorGlyph
    readonly logo?: string
    /** Set when the app can set the connector up today; absent for a planned one. */
    readonly provider?: Provider
}

/** The words of the drawer. */
export interface DetailWords {
    readonly closeLabel: string
    readonly brings: string
    readonly needs: string
    readonly audience: string
    readonly yours: string
    readonly yoursFact: string
    readonly none: string
    readonly add: string
    readonly soon: string
    readonly ownerOnly: string
}

/** The connector detail drawer. */
export interface ConnectorDetailOverlayBaseProps {
    readonly props: {
        readonly entry: DetailEntry | null
        readonly words: DetailWords
        readonly rows: ReadonlyArray<DetailRow>
        readonly localOnly: boolean
        readonly canManage: boolean
        /** The viewer may start a connection of this connector. */
        readonly canConnect: boolean
    }
    readonly on: {
        readonly close: () => void
        readonly add: (provider: Provider) => void
    }
}

const bodyOf = (props: ConnectorDetailOverlayBaseProps, entry: DetailEntry) => {
    const detail = props.props
    if (entry.provider === undefined) {
        return (
            <>
                <Text size="sm" tone="muted">
                    {detail.words.soon}
                </Text>
                <ConnectionInterestButton connectorId={entry.id} />
            </>
        )
    }
    const provider = entry.provider
    return (
        <>
            <Section
                kind="list"
                title={detail.words.yours}
                headingLevel={3}
                count={detail.rows.length}
                empty={<EmptyNotice message={detail.words.none} />}
                items={detail.rows.map((row) => ({
                    id: row.connection.id,
                    title: row.connection.name,
                    detail: (
                        <ConnectionRow
                            connection={row.connection}
                            agentNames={row.agentNames}
                            localOnly={detail.localOnly}
                            canManage={detail.canManage}
                        />
                    ),
                }))}
            />
            {detail.canConnect ? (
                <div>
                    <Button intent="commit" startGlyph="plus" onPress={() => props.on.add(provider)}>
                        {detail.words.add}
                    </Button>
                </div>
            ) : (
                <Alert tone="informative" title={detail.words.ownerOnly} />
            )}
        </>
    )
}

/**
 * The detail of one connector of the library: what it brings in, who it is for, what to have ready, the workspace connections of it with their commands,
 * and either "add a connection" (a real connector) or "I want it" (a planned one).
 */
export const ConnectorDetailOverlayBase = (props: ConnectorDetailOverlayBaseProps) => {
    const entry = props.props.entry
    const statusTone = entry?.isOfficial === true ? "success" : "neutral"
    return (
        <Drawer
            isOpen={entry !== null}
            onOpenChange={(isOpen) => {
                if (!isOpen) props.on.close()
            }}
            title={entry?.name ?? ""}
            closeLabel={props.props.words.closeLabel}
            placement="right"
        >
            {entry === null ? null : (
                <Stack gap="section">
                    <Cluster gap="inline" align="start">
                        <ProviderLogo glyph={entry.glyph} {...logoOf(entry.logo)} />
                        <div className={classNames.lead}>
                            <Stack gap="identity">
                                <Cluster gap="inline" align="center" justify="between">
                                    <Text size="sm" isStrong>
                                        {entry.category}
                                    </Text>
                                    <Badge tone={statusTone}>{entry.statusLabel}</Badge>
                                </Cluster>
                                <Text size="sm" tone="muted">
                                    {entry.blurb}
                                </Text>
                            </Stack>
                        </div>
                    </Cluster>
                    <Section
                        kind="list"
                        ariaLabel={entry.name}
                        empty={null}
                        items={[
                            { id: "brings", title: props.props.words.brings, description: entry.brings },
                            { id: "audience", title: props.props.words.audience, description: entry.audience },
                            ...(entry.needs === ""
                                ? []
                                : [{ id: "needs", title: props.props.words.needs, description: entry.needs }]),
                        ]}
                    />
                    {bodyOf(props, entry)}
                </Stack>
            )}
        </Drawer>
    )
}

/** The feature host supplies the drawers and whether the workspace reads have made them usable. */
interface OverlayHostProps {
    readonly active: boolean
    readonly candidate: ReactNode
}

/** A pure host for the connection drawers; the feature owns their registration and lifecycle. */
export const OverlayHost = (props: OverlayHostProps): ReactNode => (props.active ? props.candidate : null)
