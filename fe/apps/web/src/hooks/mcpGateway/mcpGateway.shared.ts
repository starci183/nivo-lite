import type { useQueryMcpCallLogSwr, useQueryMcpConnectorsSwr, useQueryMcpToolGrantsSwr } from "@/hooks/swr"
import type { useFormatter, useTranslations } from "next-intl"
import type { McpConnectorCommands } from "./useMcpConnectorCommands"

/** One gateway connector as the `mcpConnectors` read answers it. */
type McpConnectorType = NonNullable<ReturnType<typeof useQueryMcpConnectorsSwr>["data"]>[number]

/** The tones a gateway badge may take. */
type McpTone = "success" | "warning" | "accent" | "neutral" | "danger"

/** One badge of a gateway row. */
interface McpBadgeView {
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
interface McpToolRowView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly badges: ReadonlyArray<McpBadgeView>
}

/** One connector row: its state, its pinned tools and, for a remote connector, Approve and Check. */
interface McpConnectorRowView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly badges: ReadonlyArray<McpBadgeView>
    readonly actions: ReadonlyArray<McpActionView>
    readonly tools: { readonly label: string; readonly rows: ReadonlyArray<McpToolRowView> }
}

type Translator = ReturnType<typeof useTranslations<"mcpGateway">>
type Formatter = ReturnType<typeof useFormatter>

const STATUS_TONE: ReadonlyMap<string, McpTone> = new Map([
    ["active", "success"],
    ["degraded", "warning"],
])
const SCOPES: ReadonlySet<string> = new Set(["read", "write"])

/** A time the gateway recorded, short date and time in the reader locale. */
const stampOf = (format: Formatter, iso: string): string =>
    format.dateTime(new Date(iso), { dateStyle: "short", timeStyle: "short" })

/** The scope words of a tool: the catalog word for read or write, else the scope as the connector named it. */
const scopeOf = (t: Translator, scope: string): string => (SCOPES.has(scope) ? t(`scope_${scope}`) : scope)

/** The pinned tools of a connector, each with an approved or not-approved badge. */
const toolRowsOf = (t: Translator, connector: McpConnectorType): ReadonlyArray<McpToolRowView> =>
    connector.tools.map((tool) => ({
        id: tool.name,
        title: tool.name,
        description: [scopeOf(t, tool.scope), tool.description].filter(Boolean).join(" · "),
        badges: [
            tool.approved
                ? { label: t("toolApproved"), tone: "success" }
                : { label: t("toolNotApproved"), tone: "warning" },
        ],
    }))

/** When the connector was approved and last checked, in words. */
const timesOf = (t: Translator, format: Formatter, connector: McpConnectorType): string =>
    [
        connector.approvedAt === null
            ? t("neverApproved")
            : t("approvedAt", { time: stampOf(format, connector.approvedAt) }),
        connector.checkedAt === null
            ? t("neverChecked")
            : t("checkedAt", { time: stampOf(format, connector.checkedAt) }),
    ].join(" · ")

/** Approve and Check of a remote connector; a native connector is part of NIVO and has neither. */
const actionsOf = (
    t: Translator,
    connector: McpConnectorType,
    commands: McpConnectorCommands,
): ReadonlyArray<McpActionView> => {
    if (connector.kind !== "remote") return []
    const isBusy = commands.busyKey === connector.key
    const isLocked = commands.busyKey !== null
    return [
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
    t: Translator,
    format: Formatter,
    connectors: ReadonlyArray<McpConnectorType>,
    commands: McpConnectorCommands,
): ReadonlyArray<McpConnectorRowView> =>
    connectors.map((connector) => ({
        id: connector.key,
        title: connector.name,
        description: `${connector.key}.* · ${timesOf(t, format, connector)}`,
        badges: [
            { label: connector.status, tone: STATUS_TONE.get(connector.status) ?? "neutral" },
            { label: connector.kind === "native" ? t("native") : t("remote"), tone: "accent" },
            {
                label: t("tools", { count: connector.tools.length, version: connector.contractVersion }),
                tone: "neutral",
            },
        ],
        actions: actionsOf(t, connector, commands),
        tools: { label: t("toolsOf", { name: connector.name }), rows: toolRowsOf(t, connector) },
    }))

/** One agent's grant of a gateway tool, as the `mcpToolGrants` read answers it. */
type McpGrantType = NonNullable<ReturnType<typeof useQueryMcpToolGrantsSwr>["data"]>[number]
/** One audited gateway call, as the `mcpCallLog` read answers it. */
type McpCallType = NonNullable<ReturnType<typeof useQueryMcpCallLogSwr>["data"]>[number]

const MODE_TONE: ReadonlyMap<string, McpTone> = new Map([
    ["auto", "success"],
    ["ask", "warning"],
])
const OUTCOME_TONE: ReadonlyMap<string, McpTone> = new Map([
    ["ok", "success"],
    ["approval", "warning"],
])

/** A neutral badge. */
const plain = (label: string): McpBadgeView => ({ label, tone: "neutral" })

/** Each agent's grants of gateway tools: the mode, the data constraints and the money limit. */
export const grantRowsOf = (
    t: Translator,
    format: Formatter,
    grants: ReadonlyArray<McpGrantType>,
): ReadonlyArray<McpToolRowView> =>
    grants.map((grant) => ({
        id: `${grant.agentId}:${grant.tool}`,
        title: grant.tool,
        description: grant.agentName,
        badges: [
            { label: grant.mode, tone: MODE_TONE.get(grant.mode) ?? "neutral" },
            ...(grant.constraintsJson === "[]" ? [] : [plain(grant.constraintsJson)]),
            ...(grant.limitVnd === null ? [] : [plain(t("limitVnd", { amount: format.number(grant.limitVnd) }))]),
        ],
    }))

/** The latest audited calls: when, the masked arguments, who approved, the outcome and how long it took. */
export const logRowsOf = (
    t: Translator,
    format: Formatter,
    lines: ReadonlyArray<McpCallType>,
): ReadonlyArray<McpToolRowView> =>
    lines.map((line) => ({
        id: line.id,
        title: `${line.tool} · ${line.agentName}`,
        description: [
            format.dateTime(new Date(line.at), { dateStyle: "short", timeStyle: "medium" }),
            line.argsMasked,
            line.approvedBy === null ? "" : t("approvedBy", { name: line.approvedBy }),
        ]
            .filter(Boolean)
            .join(" · "),
        badges: [
            {
                label: line.errorCode === null ? line.outcome : `${line.outcome}: ${line.errorCode}`,
                tone: OUTCOME_TONE.get(line.outcome) ?? "danger",
            },
            plain(t("duration", { ms: line.durationMs })),
        ],
    }))
