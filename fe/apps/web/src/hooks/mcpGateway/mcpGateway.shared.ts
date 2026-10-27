import type { useQueryMcpConnectorsSwr } from "@/hooks/swr"
import type { useFormatter, useTranslations } from "next-intl"
import type { McpConnectorCommands } from "./useMcpConnectorCommands"

/** One gateway connector as the `mcpConnectors` read answers it. */
type McpConnectorType = NonNullable<ReturnType<typeof useQueryMcpConnectorsSwr>["data"]>[number]

/** The tones a gateway badge may take. */
export type McpTone = "success" | "warning" | "accent" | "neutral" | "danger"

/** One badge of a gateway row. */
export interface McpBadgeView {
    readonly label: string
    readonly tone: McpTone
}

/** One command button of a connector row. */
interface McpActionView {
    readonly id: string
    readonly label: string
    readonly isPending: boolean
    readonly isDisabled: boolean
    readonly onPress: () => void
}

/** One pinned tool of a connector: its name, scope, description and whether it is approved. */
export interface McpToolRowView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly badges: ReadonlyArray<McpBadgeView>
}

/** One connector row: its state, its pinned tools and, for a remote connector, its credential, Test, Approve and Check. */
interface McpConnectorRowView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly badges: ReadonlyArray<McpBadgeView>
    readonly actions: ReadonlyArray<McpActionView>
    readonly tools: { readonly label: string; readonly rows: ReadonlyArray<McpToolRowView> }
}

/** The words of the gateway region (the `mcpGateway` catalog). */
export type McpTranslator = ReturnType<typeof useTranslations<"mcpGateway">>
/** The reader-locale formatter of dates and numbers. */
export type McpFormatter = ReturnType<typeof useFormatter>

const STATUS_TONE: ReadonlyMap<string, McpTone> = new Map([
    ["active", "success"],
    ["degraded", "warning"],
])
const SCOPES: ReadonlySet<string> = new Set(["read", "write"])

/** The catalog key of a tool id (`sepay.transactions.list` reads `tool_sepay-transactions-list`). */
const toolKeyOf = (id: string): string => `tool_${id.replaceAll(".", "-")}`

/** The status words of a connector: the catalog word of a known status, else the status as the gateway named it. */
const statusOf = (t: McpTranslator, status: string): string =>
    t.has(`status_${status}`) ? t(`status_${status}`) : status

/**
 * What a tool does, in the reader locale: the catalog text of a native tool, keyed by its id; a remote tool shows the description its
 * server sent. The description the gateway sends stays the one the agents read.
 */
const toolDescriptionOf = (t: McpTranslator, id: string, description: string): string =>
    t.has(toolKeyOf(id)) ? t(toolKeyOf(id)) : description

/** The title of a connector: the catalog name of a native connector, else the name it was registered with. */
const connectorTitleOf = (t: McpTranslator, key: string, name: string): string =>
    t.has(`connector_${key}`) ? t(`connector_${key}`) : name

/** A time the gateway recorded, short date and time in the reader locale. */
const stampOf = (format: McpFormatter, iso: string): string =>
    format.dateTime(new Date(iso), { dateStyle: "short", timeStyle: "short" })

/** The scope words of a tool: the catalog word for read or write, else the scope as the connector named it. */
const scopeOf = (t: McpTranslator, scope: string): string => (SCOPES.has(scope) ? t(`scope_${scope}`) : scope)

/** The pinned tools of a connector, each with an approved or not-approved badge. */
const toolRowsOf = (t: McpTranslator, connector: McpConnectorType): ReadonlyArray<McpToolRowView> =>
    connector.tools.map((tool) => ({
        id: tool.name,
        title: tool.name,
        description: [scopeOf(t, tool.scope), toolDescriptionOf(t, tool.name, tool.description)]
            .filter(Boolean)
            .join(" · "),
        badges: [
            tool.approved
                ? { label: t("toolApproved"), tone: "success" }
                : { label: t("toolNotApproved"), tone: "warning" },
        ],
    }))

/** When the connector was approved, last checked and, for a remote one with a credential, when that was set, in words. */
const timesOf = (t: McpTranslator, format: McpFormatter, connector: McpConnectorType): string =>
    [
        ...(connector.credentialSetAt === null
            ? []
            : [t("credentialSetAt", { time: stampOf(format, connector.credentialSetAt) })]),
        connector.approvedAt === null
            ? t("neverApproved")
            : t("approvedAt", { time: stampOf(format, connector.approvedAt) }),
        connector.checkedAt === null
            ? t("neverChecked")
            : t("checkedAt", { time: stampOf(format, connector.checkedAt) }),
    ].join(" · ")

/** The credential badge of a remote connector: set, still needed, or nothing when the server takes none. */
const credentialBadgesOf = (t: McpTranslator, connector: McpConnectorType): ReadonlyArray<McpBadgeView> => {
    if (connector.credentialState === "set") return [{ label: t("credentialSet"), tone: "success" }]
    if (connector.credentialState === "needed") return [{ label: t("credentialNeeded"), tone: "warning" }]
    return []
}

/**
 * Set or rotate the credential, Test the connection (reads the live tool list), Approve and Check of a remote connector; a native
 * connector is part of NIVO and has none. The credential is never shown: the button only says whether one is set.
 */
const actionsOf = (
    t: McpTranslator,
    connector: McpConnectorType,
    commands: McpConnectorCommands,
    openCredential: (key: string) => void,
): ReadonlyArray<McpActionView> => {
    if (connector.kind !== "remote") return []
    const isBusy = commands.busyKey === connector.key
    const isLocked = commands.busyKey !== null
    return [
        {
            id: "credential",
            label: connector.credentialState === "set" ? t("rotateCredential") : t("setCredential"),
            isPending: false,
            isDisabled: isLocked,
            onPress: () => {
                openCredential(connector.key)
            },
        },
        {
            id: "test",
            label: t("test"),
            isPending: isBusy,
            isDisabled: isLocked || connector.credentialState === "needed",
            onPress: () => void commands.test(connector.key),
        },
        {
            id: "approve",
            label: t("approve"),
            isPending: isBusy,
            isDisabled: isLocked || connector.tools.every((tool) => tool.approved),
            onPress: () => void commands.approve(connector.key),
        },
        {
            id: "check",
            label: t("check"),
            isPending: isBusy,
            isDisabled: isLocked,
            onPress: () => void commands.check(connector.key),
        },
    ]
}

/** The connector rows of the gateway region: status, kind, pinned tools with their approval, times and commands. */
export const connectorRowsOf = (
    t: McpTranslator,
    format: McpFormatter,
    connectors: ReadonlyArray<McpConnectorType>,
    commands: McpConnectorCommands,
    openCredential: (key: string) => void,
): ReadonlyArray<McpConnectorRowView> =>
    connectors.map((connector) => ({
        id: connector.key,
        title: connectorTitleOf(t, connector.key, connector.name),
        description: `${connector.key}.* · ${timesOf(t, format, connector)}`,
        badges: [
            { label: statusOf(t, connector.status), tone: STATUS_TONE.get(connector.status) ?? "neutral" },
            { label: connector.kind === "native" ? t("native") : t("remote"), tone: "accent" },
            {
                label: t("tools", { count: connector.tools.length, version: connector.contractVersion }),
                tone: "neutral",
            },
            ...credentialBadgesOf(t, connector),
        ],
        actions: actionsOf(t, connector, commands, openCredential),
        tools: {
            label: t("toolsOf", { name: connectorTitleOf(t, connector.key, connector.name) }),
            rows: toolRowsOf(t, connector),
        },
    }))
