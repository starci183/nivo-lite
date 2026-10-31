import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import type { RoleReadiness } from "@modules/domain/mcp-gateway"
import { ContextVersionsService } from "@modules/domain/module-context-versions"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { SetupSessionsService } from "@modules/domain/module-setup-sessions"
import type { SetupSessionRecord } from "@modules/domain/module-setup-sessions"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { ACCOUNTING_MODULE } from "./accounting.contracts"
import { CHATBOT_MODULE } from "./chatbot.contracts"
import { ModulesErrorCode } from "./errors/modules.error"
import { ModuleReadinessService } from "./module-readiness.service"
import { ModulesService } from "./modules.service"

const recordOf = builder<InstallationRecord>({
    id: "inst-1",
    workspaceId: "ws-1",
    moduleKey: "accounting",
    name: "Accounting",
    isMulti: false,
    agentId: "agent-1",
    status: "live",
    operatingMode: "assist",
    liveEnabled: true,
    activeContextVersionId: "version-1",
    settings: {},
    createdAt: "2026-10-20T00:00:00.000Z",
})

const readinessOf = builder<RoleReadiness>({
    ready: false,
    missing: ["payment.credits.list"],
    providers: {
        "identity.find": [],
        "identity.upsert": [],
        "receivable.find": [],
        "receivable.recordPayment": [],
        "payment.credits.list": ["SePay"],
        "payment.debits.list": [],
        "invoice.list": [],
    },
})

const sessionOf = builder<SetupSessionRecord>({
    id: "session-1",
    workspaceId: "ws-1",
    installationId: "inst-1",
    revision: 1,
    status: "draft",
    draft: { summary: "", facts: [] },
    gateEvidence: {},
    createdAt: "2026-10-20T00:00:00.000Z",
})

const build = async () => {
    const installations = mock<InstallationRecordsService>()
    installations.find.mockResolvedValue(recordOf())
    installations.settleConnection.mockResolvedValue(null)
    const catalog = mock<ModulesService>()
    catalog.find.mockImplementation((key) => Promise.resolve(key === "accounting" ? ACCOUNTING_MODULE : CHATBOT_MODULE))
    const gateway = mock<McpGatewayService>()
    gateway.readiness.mockResolvedValue(readinessOf())
    const agents = mock<AgentDirectoryService>()
    agents.identitiesOf.mockResolvedValue([
        { id: "agent-1", name: "AI Accounting", handle: "accounting", avatarUrl: "https://cdn.test/a.png" },
    ])
    const versions = mock<ContextVersionsService>()
    versions.numbersOf.mockResolvedValue([{ id: "version-1", version: 3 }])
    const sessions = mock<SetupSessionsService>()
    sessions.latest.mockResolvedValue(null)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ModuleReadinessService,
            { provide: InstallationRecordsService, useValue: installations },
            { provide: ModulesService, useValue: catalog },
            { provide: McpGatewayService, useValue: gateway },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: ContextVersionsService, useValue: versions },
            { provide: SetupSessionsService, useValue: sessions },
        ],
    }).compile()
    return {
        readiness: moduleRef.get(ModuleReadinessService),
        installations,
        catalog,
        gateway,
        agents,
        versions,
        sessions,
    }
}

describe("ModuleReadinessService.needsOf", () => {
    it("answers the missing required roles of a module with their providers", async () => {
        const { readiness, gateway } = await build()

        await expect(readiness.needsOf("ws-1", "accounting")).resolves.toEqual([
            { role: "payment.credits.list", providers: ["SePay"] },
        ])
        expect(gateway.readiness).toHaveBeenCalledWith("ws-1", ["payment.credits.list"])
    })

    it("needs nothing when the required roles are ready or the module requires none", async () => {
        const { readiness, gateway } = await build()
        gateway.readiness.mockResolvedValue(readinessOf({ ready: true, missing: [] }))

        await expect(readiness.needsOf("ws-1", "accounting")).resolves.toEqual([])
        await expect(readiness.needsOf("ws-1", "chatbot")).resolves.toEqual([])
        expect(gateway.readiness).toHaveBeenCalledTimes(1)
    })

    it("needs nothing for a module that declares no roles", async () => {
        const { readiness, catalog, gateway } = await build()
        catalog.find.mockResolvedValue({ ...CHATBOT_MODULE, requires: { capabilities: [], connections: [] } })

        await expect(readiness.needsOf("ws-1", "chatbot")).resolves.toEqual([])
        expect(gateway.readiness).not.toHaveBeenCalled()
    })

    it("shows an installation with its agent, its version number and what it still needs connected", async () => {
        const { readiness, agents, versions } = await build()

        await expect(readiness.withNeeds(recordOf())).resolves.toEqual({
            ...recordOf(),
            agentName: "AI Accounting",
            agentHandle: "accounting",
            agentAvatarUrl: "https://cdn.test/a.png",
            activeVersion: 3,
            connectionNeeds: [{ role: "payment.credits.list", providers: ["SePay"] }],
            lifecycle: "needs_connection",
            setupProgress: { confirmed: 0, total: ACCOUNTING_MODULE.gates.length },
        })
        expect(agents.identitiesOf).toHaveBeenCalledWith("ws-1", ["agent-1"])
        expect(versions.numbersOf).toHaveBeenCalledWith(["version-1"])
    })

    it("shows an installation without an agent or an applied version under the module's own handle", async () => {
        const { readiness, agents, versions } = await build()
        agents.identitiesOf.mockResolvedValue([])
        versions.numbersOf.mockResolvedValue([])

        await expect(
            readiness.withNeeds(recordOf({ agentId: null, activeContextVersionId: null })),
        ).resolves.toMatchObject({
            agentName: "",
            agentHandle: "accounting",
            agentAvatarUrl: null,
            activeVersion: null,
        })
        expect(agents.identitiesOf).toHaveBeenCalledWith("ws-1", [])
        expect(versions.numbersOf).toHaveBeenCalledWith([])
    })
})

describe("ModuleReadinessService.withNeeds setup progress", () => {
    it("counts the gates the newest draft confirms, and none it only proposes", async () => {
        const { readiness, sessions } = await build()
        const [first, second, third] = CHATBOT_MODULE.gates
        sessions.latest.mockResolvedValue(
            sessionOf({
                gateEvidence: {
                    [first?.key ?? "a"]: {
                        status: "confirmed",
                        evidence: "Tea",
                        confirmed_by: "Lan",
                        confirmed_at: "2026-10-20T00:00:00.000Z",
                    },
                    [second?.key ?? "b"]: {
                        status: "confirmed",
                        evidence: "8-5",
                        confirmed_by: "Lan",
                        confirmed_at: "2026-10-20T00:00:00.000Z",
                    },
                    [third?.key ?? "c"]: { status: "proposed", evidence: "warm" },
                },
            }),
        )

        await expect(readiness.withNeeds(recordOf({ moduleKey: "chatbot" }))).resolves.toMatchObject({
            setupProgress: { confirmed: 2, total: CHATBOT_MODULE.gates.length },
        })
        expect(sessions.latest).toHaveBeenCalledWith("inst-1")
    })
})

describe("ModuleReadinessService.settle", () => {
    it("moves a live installation without its connections to needs_connection", async () => {
        const { readiness, installations } = await build()
        installations.settleConnection.mockResolvedValue("needs_connection")

        await expect(readiness.settle("ws-1", "inst-1")).resolves.toBe("needs_connection")
        expect(installations.settleConnection).toHaveBeenCalledWith("ws-1", "inst-1", false)
    })

    it("asks to resume a waiting installation once its connections are ready, and keeps a status nothing moved", async () => {
        const { readiness, installations, gateway } = await build()
        gateway.readiness.mockResolvedValue(readinessOf({ ready: true, missing: [] }))
        installations.find.mockResolvedValue(recordOf({ status: "paused" }))

        await expect(readiness.settle("ws-1", "inst-1")).resolves.toBe("paused")
        expect(installations.settleConnection).toHaveBeenCalledWith("ws-1", "inst-1", true)
    })

    it("refuses an installation that is not of the workspace", async () => {
        const { readiness, installations } = await build()
        installations.find.mockResolvedValue(null)

        await expect(readiness.settle("ws-1", "inst-9")).rejects.toMatchObject({
            code: ModulesErrorCode.InstallationNotFound,
        })
        expect(installations.settleConnection).not.toHaveBeenCalled()
    })
})
