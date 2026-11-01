import type {
    DataKind,
    DataRight,
    DataRightVerdict,
    GatewayCaller,
    GatewayJson,
    OptionalDataKind,
    OptionalDataRights,
} from "./mcp-gateway.contracts"

/** The kind of data each native connector's read tools reach. A connector with no kind here reads nothing the store holds. */
const KIND_OF_CONNECTOR: Readonly<Record<string, DataKind>> = {
    brain: "brain",
    dossier: "customers",
    drive: "documents",
    sepay: "payments",
    zalo: "channels",
    telegram: "channels",
    einvoice: "invoices",
}

/** The kind of data a tool reads, from the connector in front of its name, or null when it reads none the store holds. */
export const dataKindOfTool = (tool: string): OptionalDataKind => KIND_OF_CONNECTOR[tool.split(".", 1).join("")] ?? null

/**
 * The data rights of one native read, default deny. No governed agent: the read passes as before. A tool with no data kind is
 * refused, since its reach cannot be judged; a kind the agent holds no right on is refused; and an agent that faces outsiders is
 * always narrow, because a customer can talk it into repeating what it can read: whatever its right says, it reads only the rows
 * of the conversation the call serves, and a call with no conversation reads nothing.
 */
export const judgeDataRight = (rights: OptionalDataRights, tool: string, caller: GatewayCaller): DataRightVerdict => {
    if (rights === null) return { kind: "open" }
    const kind = dataKindOfTool(tool)
    if (kind === null) return { kind: "deny", reason: "no_kind" }
    const right = rights.find((entry) => entry.kind === kind)
    if (right === undefined) return { kind: "deny", reason: "no_right" }
    const outsider = caller.audience === "customer" || caller.conversationId !== null
    if (!outsider) return { kind: "narrow", right }
    if (caller.conversationId === null) return { kind: "deny", reason: "no_conversation" }
    return { kind: "narrow", right: { ...right, scope: "conversation" } }
}

/** A value shown masked: its ends stay when it is long enough to hide a middle, else nothing of it shows. */
export const maskedValue = (value: unknown): unknown => {
    if (typeof value !== "string") return value === null || value === undefined ? value : "***"
    return value.length >= 6 ? `${value.slice(0, 1)}***${value.slice(-2)}` : "***"
}

const objectOf = (value: object, right: DataRight): GatewayJson =>
    Object.fromEntries(
        Object.entries(value)
            .filter(([name]) => !right.hide.includes(name))
            .map(([name, member]): [string, unknown] => [
                name,
                right.mask.includes(name) ? maskedValue(member) : fieldsOf(member, right),
            ]),
    )

const fieldsOf = (value: unknown, right: DataRight): unknown => {
    if (Array.isArray(value)) return value.map((item: unknown) => fieldsOf(item, right))
    return typeof value === "object" && value !== null ? objectOf(value, right) : value
}

/** The answer of a read with the fields the right hides dropped and the fields it masks shown masked, at any depth. */
export const applyFields = (value: GatewayJson, right: DataRight): GatewayJson => objectOf(value, right)
