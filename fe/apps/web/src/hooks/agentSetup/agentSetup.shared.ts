import type {
    ContextVersion,
    GateEntry,
    GateEvidence,
    GateStatus,
    SetupFact,
    SetupMessage,
    SetupRevision,
    SetupSession,
} from "@/modules/installations"

/** How often the setup is read again while NIVO is answering. */
export const SETUP_POLL_MS = 2000

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

const GATE_STATUSES: ReadonlyArray<GateStatus> = ["missing", "proposed", "confirmed"]
const SESSION_STATUSES: ReadonlyArray<SetupSession["status"]> = ["draft", "applied", "discarded"]

const toGateEntry = (value: unknown): GateEntry => {
    const record = isRecord(value) ? value : {}
    const confirmedBy = record.confirmed_by
    const confirmedAt = record.confirmed_at
    return {
        status: GATE_STATUSES.find((status) => status === record.status) ?? "missing",
        evidence: textOf(record.evidence),
        ...(typeof confirmedBy === "string" ? { confirmed_by: confirmedBy } : {}),
        ...(typeof confirmedAt === "string" ? { confirmed_at: confirmedAt } : {}),
    }
}

const toGateEvidence = (value: unknown): GateEvidence =>
    isRecord(value) ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toGateEntry(entry)])) : {}

interface SetupSessionWire {
    readonly id: string
    readonly workspaceId: string
    readonly installationId: string
    readonly revision: number
    readonly status: string
    readonly draft: { readonly summary: string; readonly facts: ReadonlyArray<SetupFact> }
    readonly gateEvidence: unknown
    readonly createdAt: string
}

/** The draft session of the setup chat; a status outside the closed set reads as a draft. */
export const toSetupSession = (row: SetupSessionWire): SetupSession => ({
    id: row.id,
    workspaceId: row.workspaceId,
    installationId: row.installationId,
    revision: row.revision,
    status: SESSION_STATUSES.find((status) => status === row.status) ?? "draft",
    draft: { summary: row.draft.summary, facts: row.draft.facts.map((fact) => ({ key: fact.key, text: fact.text })) },
    gateEvidence: toGateEvidence(row.gateEvidence),
    createdAt: row.createdAt,
})

interface SetupMessageWire {
    readonly id: string
    readonly setupSessionId: string
    readonly role: string
    readonly author: string
    readonly body: string
    readonly createdAt: string
}

/** One message of the chat; a role other than the owner reads as NIVO. */
export const toSetupMessage = (row: SetupMessageWire): SetupMessage => ({
    id: row.id,
    setupSessionId: row.setupSessionId,
    role: row.role === "user" ? "user" : "assistant",
    author: row.author,
    body: row.body,
    createdAt: row.createdAt,
})

interface SetupRevisionWire {
    readonly id: string
    readonly revision: number
    readonly status: string
}

/** One revision of the chat. */
export const toSetupRevision = (row: SetupRevisionWire): SetupRevision => ({
    id: row.id,
    revision: row.revision,
    status: SESSION_STATUSES.find((status) => status === row.status) ?? "draft",
})

interface ContextVersionWire {
    readonly id: string
    readonly installationId: string
    readonly version: number
    readonly snapshot: unknown
    readonly appliedBy: string
    readonly appliedAt: string
}

const toFacts = (value: unknown): Array<SetupFact> => {
    const facts: Array<SetupFact> = []
    if (!Array.isArray(value)) return facts
    for (const entry of value) {
        if (isRecord(entry) && typeof entry.key === "string" && typeof entry.text === "string") {
            facts.push({ key: entry.key, text: entry.text })
        }
    }
    return facts
}

/** One applied version of the business context. */
export const toContextVersion = (row: ContextVersionWire): ContextVersion => {
    const snapshot = isRecord(row.snapshot) ? row.snapshot : {}
    return {
        id: row.id,
        installationId: row.installationId,
        version: row.version,
        snapshot: {
            summary: textOf(snapshot.summary),
            facts: toFacts(snapshot.facts),
            gates: toGateEvidence(snapshot.gates),
        },
        appliedBy: row.appliedBy,
        appliedAt: row.appliedAt,
    }
}

/** Orders the messages of a chat, oldest first. */
export const byTime = (a: SetupMessage, b: SetupMessage): number => a.createdAt.localeCompare(b.createdAt)

/** The draft a loading screen stands on: empty, never shown as real. */
export const LOADING_SESSION: SetupSession = {
    id: "",
    workspaceId: "",
    installationId: "",
    revision: 0,
    status: "draft",
    draft: { summary: "", facts: [] },
    gateEvidence: {},
    createdAt: "",
}
