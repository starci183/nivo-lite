import { builder } from "@starci/jest-preset"
import type { InstallationRecord } from "@modules/domain/module-installations"
import type { SetupSessionRecord } from "@modules/domain/module-setup-sessions"

/** The workspace and the owner every workspace-seed spec seeds into. */
export const SEED_WS = "11111111-1111-4111-8111-111111111111"
/** The authenticated owner of SEED_WS. */
export const SEED_OWNER = "22222222-2222-4222-8222-222222222222"

/** One wire account of the private ensure input, named after its email. */
const accountOf = (email: string) => ({ email, name: email.slice(0, email.indexOf("@")), password: "private" })

type EnsureWireOfResultStaffShape = {
    email: string
    name: string
    password: string
}

type EnsureWireOfResultShape = {
    schema: string
    action: string
    workspaceName: string
    owner: EnsureWireOfResultStaffShape
    manager: EnsureWireOfResultStaffShape
    staff: EnsureWireOfResultStaffShape
}

/** The private ensure input naming a workspace and its owner, as the target runner sends it. */
export const ensureWireOf = (workspaceName: string, owner = "owner@example.test"): EnsureWireOfResultShape => ({
    schema: "starci/app-workspace-input@1",
    action: "ensure",
    workspaceName,
    owner: accountOf(owner),
    manager: accountOf("manager@example.test"),
    staff: accountOf("staff@example.test"),
})

type RoleWireShape = {
    schema: string
    action: string
    workspaceId: string
    memberId: string
    role: string
    principalToken: string
}

/** A private role-change input, which a profile run refuses. */
export const ROLE_WIRE: RoleWireShape = {
    schema: "starci/app-workspace-input@1",
    action: "role",
    workspaceId: SEED_WS,
    memberId: SEED_OWNER,
    role: "staff",
    principalToken: "token",
}

type OwnedSeedReportShape = {
    schema: "starci/app-workspace-access@1"
    ok: true
    action: "ensure"
    workspaceId: string
    publicReadback: true
    consumerVerified: false
    authentication: "password-session"
    sessionCleanup: "acknowledged"
}

type OwnedSeedShape = {
    report: OwnedSeedReportShape
    ownerId: string
}

/** What an ensure of SEED_WS answers to a profile run: the public receipt and the authenticated owner. */
export const OWNED_SEED: OwnedSeedShape = {
    report: {
        schema: "starci/app-workspace-access@1" as const,
        ok: true as const,
        action: "ensure" as const,
        workspaceId: SEED_WS,
        publicReadback: true as const,
        consumerVerified: false as const,
        authentication: "password-session" as const,
        sessionCleanup: "acknowledged" as const,
    },
    ownerId: SEED_OWNER,
}

/** The endpoint the private profile input gives the profile's connector. */
export const CONNECTOR_URL = "https://mcp.example.test/mcp"

type ProfileWireOfResultConnectorsPart1Shape = {
    url: string
}

type ProfileWireOfResultConnectorsShape = {
    [x: string]: ProfileWireOfResultConnectorsPart1Shape
}

type ProfileWireOfResultShape = {
    schema: string
    connectors: ProfileWireOfResultConnectorsShape
}

/** A private profile input with the endpoint of a connector of the given key. */
export const profileWireOf = (key: string, url: string = CONNECTOR_URL): ProfileWireOfResultShape => ({
    schema: "nivo/workspace-profile-input@1",
    connectors: { [key]: { url } },
})

/** A remote connector a run registers, with its endpoint. */
export const REMOTE_CONNECTOR = {
    key: "remote-a",
    name: "Remote A",
    needsCredential: true,
    contractVersion: "remote-a@1",
    url: "https://a.example.test/mcp",
}

/** An installation of SEED_WS a profile run keeps, still in setup before its first applied version. */
export const seedInstallationOf: (overrides?: Partial<InstallationRecord>) => InstallationRecord =
    builder<InstallationRecord>({
        id: "i1",
        workspaceId: SEED_WS,
        moduleKey: "chatbot",
        name: "ai-sales",
        isMulti: true,
        agentId: "a1",
        status: "setup",
        operatingMode: "assist",
        liveEnabled: false,
        activeContextVersionId: null,
        settings: {},
        createdAt: "2026-10-21T00:00:00.000Z",
    })

/** The open setup draft of that installation, with no gate answered yet. */
export const seedDraftOf: (overrides?: Partial<SetupSessionRecord>) => SetupSessionRecord = builder<SetupSessionRecord>(
    {
        id: "s1",
        workspaceId: SEED_WS,
        installationId: "i1",
        revision: 1,
        status: "draft",
        draft: { summary: "", facts: [] },
        gateEvidence: {},
        createdAt: "2026-10-21T00:00:00.000Z",
    },
)
