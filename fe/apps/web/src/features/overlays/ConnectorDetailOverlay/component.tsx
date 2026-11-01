import { Alert, Badge, Button, Drawer, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import { ConnectionInterestButton } from "@/components/blocks/ConnectionInterestButton"
import { ConnectionRow } from "@/components/blocks/ConnectionRow"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import type { AgentOption, Connection, ConnectorGlyph, Provider } from "@/modules/types"
import { connectorDetailClassNames as classNames } from "./classNames"

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
        readonly agents: ReadonlyArray<AgentOption>
        readonly localOnly: boolean
        readonly ownerEmail: string
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
            <Text size="sm">
                <Text as="span" size="sm" weight="semibold">
                    {detail.words.needs}:{" "}
                </Text>
                {entry.needs}
            </Text>
            {detail.rows.length === 0 ? (
                <Text size="sm" tone="muted">
                    {detail.words.none}
                </Text>
            ) : (
                <SurfaceListCard label={detail.words.yours} headingLevel={3} fact={detail.words.yoursFact}>
                    {detail.rows.map((row) => (
                        <ConnectionRow
                            key={row.connection.id}
                            connection={row.connection}
                            agentNames={row.agentNames}
                            localOnly={detail.localOnly}
                            ownerEmail={detail.ownerEmail}
                            agents={detail.agents}
                            canManage={detail.canManage}
                        />
                    ))}
                </SurfaceListCard>
            )}
            {detail.canConnect ? (
                <div>
                    <Button intent="commit" onPress={() => props.on.add(provider)}>
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
                <div className={classNames.detail}>
                    <ListRow
                        leading={
                            <ProviderLogo
                                glyph={entry.glyph}
                                {...(entry.logo === undefined ? {} : { src: entry.logo })}
                            />
                        }
                        title={entry.category}
                        badges={<Badge tone={entry.isOfficial ? "success" : "neutral"}>{entry.statusLabel}</Badge>}
                        description={entry.blurb}
                    />
                    <Text size="sm">
                        <Text as="span" size="sm" weight="semibold">
                            {props.props.words.brings}:{" "}
                        </Text>
                        {entry.brings}
                    </Text>
                    <Text size="sm">
                        <Text as="span" size="sm" weight="semibold">
                            {props.props.words.audience}:{" "}
                        </Text>
                        {entry.audience}
                    </Text>
                    {bodyOf(props, entry)}
                </div>
            )}
        </Drawer>
    )
}
