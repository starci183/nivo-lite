import { installed } from "@/modules/plugin-registry"
import vi from "@/modules/i18n/messages/vi.json"
import { chatAnswerOf } from "./chat"
import viewer from "./viewer.json"
import { PROTOTYPE_WORKSPACE_ID } from "@/modules/config"
import type { ConsoleSessionView } from "@/modules/types"

/** The variables of one operation. */
type Variables = Readonly<Record<string, unknown>>

/** One fixture answer: the data an operation returns. */
type FixtureAnswer = (variables: Variables) => Record<string, unknown>

/** The id of the fixture installation of a module. */
const fixtureInstallationId = (module: string): string => `fixture-${module}`

/** The key of every declared module. */
const MODULE_KEYS: ReadonlyArray<string> = installed.modules.map((declaration) => declaration.key)

/** The department name of an agent in the product copy (Vietnamese); the key when the copy has none. */
const departmentOf = (key: string): string => {
    const names: Readonly<Record<string, string>> = vi.governance
    return names[`dept_${key}`] ?? key
}

/** Every installed agent of the fixture workspace: one per declared module, named from the product copy. */
const installations = (): ReadonlyArray<Record<string, unknown>> =>
    MODULE_KEYS.map((key) => ({
        __typename: "ModuleInstallation",
        id: fixtureInstallationId(key),
        workspaceId: PROTOTYPE_WORKSPACE_ID,
        moduleKey: key,
        name: departmentOf(key),
        isMulti: false,
        agentId: `agent-${key}`,
        agentName: departmentOf(key),
        agentAvatarUrl: null,
        agentAvatarPreset: null,
        agentHandle: key,
        status: "live",
        lifecycle: "running",
        connectionNeeds: [],
        operatingMode: "assist",
        liveEnabled: true,
        activeContextVersionId: null,
        activeVersion: 1,
        settings: {},
        createdAt: "2026-11-01T08:00:00.000Z",
        setupProgress: { confirmed: 1, total: 1 },
    }))

/** The fixture answers by operation name; an operation nobody wrote one for is answered with an error, never invented data. */
const ANSWERS: Readonly<Record<string, FixtureAnswer>> = {
    ModuleInstallations: () => ({ moduleInstallations: installations() }),
    ModulesCatalog: () => ({
        modulesCatalog: {
            __typename: "ModulesCatalog",
            categories: [],
            modules: MODULE_KEYS.map((key) => ({
                __typename: "ModuleCatalogEntry",
                key,
                name: { __typename: "Bilingual", vi: departmentOf(key), en: departmentOf(key) },
                shortName: { __typename: "Bilingual", vi: departmentOf(key), en: departmentOf(key) },
                description: { __typename: "Bilingual", vi: departmentOf(key), en: departmentOf(key) },
                points: { __typename: "BilingualList", vi: [], en: [] },
                gates: [],
                authorityActions: [],
            })),
        },
    }),
    Connections: () => ({
        connections: [
            { provider: "zalo", name: "Zalo" },
            { provider: "telegram", name: "Telegram" },
            { provider: "website", name: "Website" },
        ].map((connection) => ({
            __typename: "Connection",
            id: `fixture-${connection.provider}`,
            workspaceId: PROTOTYPE_WORKSPACE_ID,
            provider: connection.provider,
            name: connection.name,
            meta: null,
            status: "connected",
            lastError: null,
            environment: "live",
            isDefault: true,
            lastEventAt: null,
            firstEvent: null,
            agentIds: MODULE_KEYS.map((key) => `agent-${key}`),
        })),
    }),
    BrainTodo: () => ({
        brainTodo: { __typename: "BrainTodo", facts: 0, questions: 0, proposals: 0, total: 0 },
    }),
    WorkspaceAgentWork: () => ({
        workspaceAgentWork: {
            __typename: "WorkspaceAgentWork",
            agentsOff: 0,
            heldWakes: 0,
            pendingWakes: 0,
            road: "open",
            workEnabled: true,
        },
    }),
    WorkspaceShell: () => ({
        workspaceShell: {
            __typename: "WorkspaceShell",
            agents: installations().map((row) => ({
                __typename: "ShellAgent",
                id: row.id,
                module: row.moduleKey,
                name: row.agentName,
                status: "live",
            })),
            approvals: [],
            exceptions: [],
            hasChatbot: true,
            isFoundingMember: false,
            leadCount: 5,
            openResponsibilityCount: 3,
            pendingDecisions: 2,
        },
    }),
}

/** The data the fixture gives an operation, or null when there is none. */
export const fixtureAnswerOf = (operationName: string, variables: Variables): Record<string, unknown> | null =>
    ANSWERS[operationName]?.(variables) ?? chatAnswerOf(operationName, variables)

/** The session of the fixture viewer: the owner of the fixture workspace, with a name that has an initial. */
export const fixtureSession = (workspaceId: string): ConsoleSessionView => ({
    member: { workspaceId, userId: "fixture-user", name: viewer.name, role: "owner", staffId: null },
    workspaceName: viewer.workspaceName,
    userName: viewer.name,
    email: viewer.email,
    workspaces: [{ id: workspaceId, name: viewer.workspaceName, role: "owner" }],
    currentWorkspaceId: workspaceId,
})
