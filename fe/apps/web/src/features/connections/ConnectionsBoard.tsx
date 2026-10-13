import { useTranslations } from "next-intl"
import { Badge, ListRow, SurfaceListCard } from "@starci/grammar/common"
import { ConnectionAddButton } from "@/components/blocks/ConnectionAddButton"
import { ConnectionRow } from "@/components/blocks/ConnectionRow"
import { ProviderLogo } from "@/components/leaves/ProviderLogo"
import { ConnectionWizardOverlay } from "@/features/overlays/ConnectionWizardOverlay"
import { PROVIDER_GROUPS, PROVIDER_LOGO, PROVIDERS, providerKey } from "@/hooks/connection-providers"
import { sortRows } from "@/hooks/connections"
import type { AgentOption, Connection, Provider, ProviderGroup } from "@/modules/types"
import { connectionsBoardClassNames } from "./classNames"

/** Props for {@link ConnectionsBoard}. */
export type ConnectionsBoardProps = {
    readonly items: ReadonlyArray<Connection>
    readonly agentNames: Readonly<Record<string, string>>
    readonly agents: ReadonlyArray<AgentOption>
    readonly localOnly: boolean
    readonly ownerEmail: string
    /** The provider groups to show (default: all). */
    readonly groups?: ReadonlyArray<ProviderGroup>
    /** Always true: this board only draws the embedded variant (kept so the developers page compiles unchanged). */
    readonly isEmbedded?: boolean
    /** The workspace owner adds, changes and removes connections and decides which agents use them. Others read. */
    readonly canManage?: boolean
}

type ProviderTitle = { readonly provider: Provider; readonly title: string }

type EmbeddedBoardViewProps = {
    readonly items: ReadonlyArray<Connection>
    readonly agents: ReadonlyArray<AgentOption>
    readonly agentNames: Readonly<Record<string, string>>
    readonly localOnly: boolean
    readonly ownerEmail: string
    readonly canManage: boolean
    readonly groups: ReadonlyArray<{
        readonly id: string
        readonly used: ReadonlyArray<ProviderTitle & { readonly fact: string }>
        readonly unused: ReadonlyArray<ProviderTitle & { readonly blurb: string; readonly isEarly: boolean }>
    }>
    readonly notConnected: string
    readonly earlyAccess: string
}

const EmbeddedBoardView = (props: EmbeddedBoardViewProps) => {
    const namesFor = (connection: Connection) =>
        connection.agentIds.map((id) => props.agentNames[id]).filter((name): name is string => name !== undefined)
    return (
        <>
            {props.groups.map((group) => (
                <section key={group.id} className={connectionsBoardClassNames.group}>
                    {group.used.map((card) => (
                        <div key={card.provider} data-guide={`connections.${card.provider}`}>
                            <SurfaceListCard
                                label={card.title}
                                headingLevel={3}
                                fact={card.fact}
                                {...(props.canManage
                                    ? { labelEnd: <ConnectionAddButton provider={card.provider} kind="add" /> }
                                    : {})}
                            >
                                {sortRows(props.items.filter((item) => item.provider === card.provider)).map(
                                    (connection) => (
                                        <ConnectionRow
                                            key={connection.id}
                                            connection={connection}
                                            agentNames={namesFor(connection)}
                                            localOnly={props.localOnly}
                                            ownerEmail={props.ownerEmail}
                                            agents={props.agents}
                                            canManage={props.canManage}
                                        />
                                    ),
                                )}
                            </SurfaceListCard>
                        </div>
                    ))}
                    {group.unused.length === 0 ? null : (
                        <SurfaceListCard label={props.notConnected} headingLevel={3}>
                            {group.unused.map((card) => (
                                <ListRow
                                    key={card.provider}
                                    leading={
                                        <ProviderLogo
                                            glyph="email"
                                            {...(PROVIDER_LOGO[card.provider] === undefined
                                                ? {}
                                                : { src: PROVIDER_LOGO[card.provider] })}
                                        />
                                    }
                                    title={<span data-guide={`connections.${card.provider}`}>{card.title}</span>}
                                    {...(card.isEarly
                                        ? { badges: <Badge tone="neutral">{props.earlyAccess}</Badge> }
                                        : {})}
                                    description={card.blurb}
                                    {...(props.canManage
                                        ? { actions: <ConnectionAddButton provider={card.provider} kind="connect" /> }
                                        : {})}
                                />
                            ))}
                        </SurfaceListCard>
                    )}
                </section>
            ))}
            <ConnectionWizardOverlay items={props.items} agents={props.agents} ownerEmail={props.ownerEmail} />
        </>
    )
}

/**
 * The provider lists of the Connections page for a page that embeds them (the developers page shows the webhook group): connected
 * providers as their own list with its rows, the rest in one compact "Not connected" list, and the wizard drawer. The Connections
 * page itself no longer uses it; it composes the same blocks on the server.
 */
export const ConnectionsBoard = (props: ConnectionsBoardProps) => {
    const t = useTranslations("connections")
    const groups = (props.groups ?? PROVIDER_GROUPS).map((group) => {
        const used = group.providers.filter((provider) => props.items.some((item) => item.provider === provider))
        return {
            id: group.id,
            used: used.map((provider) => ({
                provider,
                title: t(providerKey(provider, "title")),
                fact: t("connectionCount", { count: props.items.filter((item) => item.provider === provider).length }),
            })),
            unused: group.providers
                .filter((provider) => !used.includes(provider))
                .map((provider) => ({
                    provider,
                    title: t(providerKey(provider, "title")),
                    blurb: t(providerKey(provider, "blurb")),
                    isEarly: PROVIDERS[provider].earlyAccess === true,
                })),
        }
    })
    return (
        <EmbeddedBoardView
            items={props.items}
            agents={props.agents}
            agentNames={props.agentNames}
            localOnly={props.localOnly}
            ownerEmail={props.ownerEmail}
            canManage={props.canManage ?? false}
            groups={groups}
            notConnected={t("notConnected")}
            earlyAccess={t("earlyAccess")}
        />
    )
}
