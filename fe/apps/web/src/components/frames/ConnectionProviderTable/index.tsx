import { Avatar, Badge, Cluster, DataTable, EmptyNotice, Link, Section, Stack, Text } from "@starci/grammar/common"
import { AgentKindMark } from "@/components/branches/AgentKindMark"
import { isModuleKey } from "@/modules/catalog"
import type { ConnectionAgentUse, ConnectionProviderRow } from "@/modules/types"
import { nivoIconSource } from "@/components/leaves/Icon"

/** The words of the table of a provider's accounts. */
export interface ConnectionProviderTableCopy {
    readonly label: string
    readonly columns: {
        readonly account: string
        readonly status: string
        readonly agents: string
        readonly action: string
    }
    readonly open: string
    /** "No agent uses it yet", when none does. */
    readonly agentsNone: string
    readonly agentsGrant: string
    /** Where an agent is granted a connection: the agents catalogue. */
    readonly agentsHref: string
}

/** The accounts of a provider, their words and whether they are still being read. */
interface ConnectionProviderTableProps {
    readonly rows: ReadonlyArray<ConnectionProviderRow>
    readonly copy: ConnectionProviderTableCopy
    readonly isLoading: boolean
}

/** One agent of the cell: its kind mark, its name and what it uses the account for. */
const AgentUse = (props: { readonly use: ConnectionAgentUse }) => (
    <Cluster gap="inline" align="center" wrap={false}>
        {isModuleKey(props.use.module) ? <AgentKindMark module={props.use.module} /> : null}
        <Stack gap="identity" align="start">
            <Text>{props.use.name}</Text>
            <Text size="xs" tone="muted">
                {props.use.purpose}
            </Text>
        </Stack>
    </Cluster>
)

/** The "Agent dùng" cell: every agent granted the account, or the line that none does with the way to grant it. */
const AgentsCell = (props: { readonly row: ConnectionProviderRow; readonly copy: ConnectionProviderTableCopy }) => {
    if (props.row.uses.length === 0) {
        return (
            <Cluster gap="inline" align="center">
                <Text size="sm" tone="muted">
                    {props.copy.agentsNone}
                </Text>
                <Link variant="head" href={props.copy.agentsHref}>
                    {props.copy.agentsGrant}
                </Link>
            </Cluster>
        )
    }
    return (
        <Stack gap="row" align="start">
            {props.row.uses.map((use) => (
                <AgentUse key={use.id} use={use} />
            ))}
        </Stack>
    )
}

/** The mark, name and what identifies the account. */
const AccountCell = (props: { readonly row: ConnectionProviderRow }) => (
    <Cluster gap="row" align="center" wrap={false}>
        <Avatar
            name={props.row.name}
            shape="square"
            size="md"
            {...(props.row.logo.src === undefined ? {} : { src: props.row.logo.src })}
        />
        <Stack gap="identity" align="start">
            <Text>{props.row.name}</Text>
            <Text size="xs" tone="muted">
                {props.row.description}
            </Text>
        </Stack>
    </Cluster>
)

/** One cell of the table: the account, its state, the agents that use it, or the command that opens it. */
const cellOf = (row: ConnectionProviderRow, columnId: string, copy: ConnectionProviderTableCopy) => {
    if (columnId === "account") return <AccountCell row={row} />
    if (columnId === "status") {
        return (
            <Badge tone={row.status.tone} isDot={row.status.isDot}>
                {row.status.label}
            </Badge>
        )
    }
    if (columnId === "agents") return <AgentsCell row={row} copy={copy} />
    return (
        <Link variant="head" href={row.href}>
            {copy.open}
        </Link>
    )
}

/**
 * The accounts of a provider as a Section head (the label and the count chip) over one native table: the account, its state, the agents
 * bound to it with what each uses it for, and the command that opens it. The state column folds into the row on a narrow container.
 */
export const ConnectionProviderTable = (props: ConnectionProviderTableProps) => (
    <Section
        title={props.copy.label}
        count={props.rows.length}
        isLoading={props.isLoading}
    >
        <DataTable
            label={props.copy.label}
            isLoading={props.isLoading}
            columns={[
                { id: "account", label: props.copy.columns.account },
                { id: "status", label: props.copy.columns.status, priority: "low" },
                { id: "agents", label: props.copy.columns.agents },
                { id: "action", label: props.copy.columns.action, align: "end" },
            ]}
            rows={props.rows}
            renderCell={(row, columnId) => cellOf(row, columnId, props.copy)}
            emptyContent={<EmptyNotice message={props.copy.label} iconSource={nivoIconSource("link", "leading")} />}
        />
    </Section>
)
