import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { ModulesService } from "@modules/domain/modules"
import type { ModuleDefinition } from "@modules/domain/modules"
import { AgentAccountsService } from "@modules/domain/tools"
import { WorkspaceEnterpriseService, WorkspacesService } from "@modules/domain/workspaces"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentInstanceCreationService } from "./agent-instance-creation.service"
import { AgentInstancesLogEvent } from "./agent-instances.log-events"
import { ChannelFrontDoorService } from "./channel-front-door.service"
import { AgentInstancesError, AgentInstancesErrorCode } from "./errors/agent-instances.error"

const ACTOR = { principalId: "manager-1", workspaceId: "w1" }

const connectionOf = (provider: ConnectionRecord["provider"], id = "c1"): ConnectionRecord => ({
    id,
    workspaceId: "w1",
    provider,
    name: "Channel",
    meta: {},
    status: "connected",
    lastError: null,
    environment: "live",
    sandbox: false,
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "owner-1",
    createdAt: "2026-11-01T00:00:00.000Z",
})

const installationOf = (moduleKey: string, agentId: string | null): InstallationRecord => ({
    id: `inst-${moduleKey}`,
    workspaceId: "w1",
    moduleKey,
    name: moduleKey,
    isMulti: false,
    agentId,
    status: "ready",
    operatingMode: "autopilot",
    liveEnabled: true,
    activeContextVersionId: null,
    settings: {},
    createdAt: "2026-11-01T00:00:00.000Z",
})

/** The parts of the catalogue entry the front door reads: the label its agent is named by. */
const moduleOf = (key: string): ModuleDefinition =>
    mock<ModuleDefinition>({
        key,
        agent: mock<ModuleDefinition["agent"]>({ label: { vi: `Agent ${key}`, en: `Agent ${key}` } }),
    })

interface Held {
    readonly installed?: ReadonlyArray<InstallationRecord>
    readonly provider?: ConnectionRecord["provider"]
    readonly opens?: (module: string) => boolean
    readonly ownerId?: string | null
    /** The agent that already holds the connection's inbound binding. */
    readonly holder?: string | null
}

const build = async (held: Held = {}) => {
    const connections = mock<ConnectionsService>()
    connections.get.mockResolvedValue(connectionOf(held.provider ?? "telegram"))
    connections.patch.mockResolvedValue(undefined)
    const installations = mock<InstallationRecordsService>()
    installations.list.mockResolvedValue([...(held.installed ?? [])])
    const catalog = mock<ModulesService>()
    catalog.find.mockImplementation((key: string) => Promise.resolve(moduleOf(key)))
    const creation = mock<AgentInstanceCreationService>()
    creation.create.mockResolvedValue({ installationId: "inst-new", agentId: "agent-new", copied: null, channels: 1 })
    const workspaces = mock<WorkspacesService>()
    workspaces.ownerIdOf.mockResolvedValue(held.ownerId === undefined ? "owner-1" : held.ownerId)
    const enterprise = mock<WorkspaceEnterpriseService>()
    enterprise.opens.mockImplementation((_workspaceId: string, module: string) =>
        Promise.resolve((held.opens ?? (() => true))(module)),
    )
    const grants = mock<ConnectionGrantsService>()
    grants.setGrant.mockResolvedValue(undefined)
    const bindings = mock<AgentBindingsService>()
    bindings.owningAgentOf.mockResolvedValue(held.holder ?? null)
    const abilities = mock<AgentAccountsService>()
    abilities.attachDefaults.mockResolvedValue({ ok: true, attached: [] })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelFrontDoorService,
            { provide: ConnectionsService, useValue: connections },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: ModulesService, useValue: catalog },
            { provide: AgentInstanceCreationService, useValue: creation },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: WorkspaceEnterpriseService, useValue: enterprise },
            { provide: ConnectionGrantsService, useValue: grants },
            { provide: AgentBindingsService, useValue: bindings },
            { provide: AgentAccountsService, useValue: abilities },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return {
        service: moduleRef.get(ChannelFrontDoorService),
        connections,
        creation,
        workspaces,
        logger,
        enterprise,
        grants,
        bindings,
        abilities,
    }
}

describe("ChannelFrontDoorService > ensureForConnection", () => {
    it("installs the front door of the channel as the owner and attaches the connection when the workspace holds none", async () => {
        const { service, creation, workspaces } = await build()

        const outcome = await service.ensureForConnection(ACTOR, "c1")

        expect(workspaces.ownerIdOf).toHaveBeenCalledWith("w1")
        expect(creation.create).toHaveBeenCalledTimes(1)
        expect(creation.create).toHaveBeenCalledWith(
            "owner-1",
            expect.objectContaining({ workspaceId: "w1", connectionIds: ["c1"], startFrom: "default", copyFrom: null }),
        )
        expect(outcome).toEqual(
            expect.objectContaining({ kind: "installed", agentId: "agent-new", installationId: "inst-new" }),
        )
    })

    it("names the installed agent by the label its module declares", async () => {
        const { service, creation } = await build()

        const outcome = await service.ensureForConnection(ACTOR, "c1")

        const [, request] = creation.create.mock.calls[0] ?? []
        expect(outcome.kind === "installed" && request?.name).toBe(
            `Agent ${outcome.kind === "installed" ? outcome.module : ""}`,
        )
        expect(request?.moduleKey).toBe(outcome.kind === "installed" ? outcome.module : "")
    })

    it("attaches the front door the workspace already holds to a new connection, with the inbound binding and the provider rights", async () => {
        const { service, creation, grants, abilities } = await build({ installed: [installationOf("chatbot", "agent-held")] })

        const outcome = await service.ensureForConnection(ACTOR, "c1")

        expect(outcome).toEqual({ kind: "attached", module: "chatbot", agentId: "agent-held" })
        expect(creation.create).not.toHaveBeenCalled()
        expect(grants.setGrant).toHaveBeenCalledWith({ principalId: "owner-1", workspaceId: "w1" }, "c1", "agent-held", true)
        expect(abilities.attachDefaults).toHaveBeenCalledWith(
            { workspaceId: "w1", agentId: "agent-held", moduleKey: "chatbot" },
            null,
            "owner-1",
        )
    })

    it("is idempotent: a connection that already has its front door is left as it is", async () => {
        const { service, creation, grants, connections } = await build({
            installed: [installationOf("chatbot", "agent-held")],
            holder: "agent-held",
        })

        const outcome = await service.ensureForConnection(ACTOR, "c1")

        expect(outcome).toEqual({ kind: "held", module: "chatbot", agentId: "agent-held" })
        expect(creation.create).not.toHaveBeenCalled()
        expect(grants.setGrant).not.toHaveBeenCalled()
        expect(connections.patch).not.toHaveBeenCalled()
    })

    it("never gives a stream a second front door: another agent that holds the connection stays its front door", async () => {
        const { service, grants } = await build({ installed: [installationOf("chatbot", "agent-held")], holder: "agent-other" })

        await expect(service.ensureForConnection(ACTOR, "c1")).resolves.toEqual({
            kind: "held",
            module: "chatbot",
            agentId: "agent-other",
        })
        expect(grants.setGrant).not.toHaveBeenCalled()
    })

    it("attaches the best of several front doors the workspace holds and none of the others", async () => {
        const { service, grants } = await build({
            provider: "zalo_oa",
            installed: [installationOf("chatbot", "agent-chatbot"), installationOf("webdesk", "agent-webdesk")],
        })

        const outcome = await service.ensureForConnection(ACTOR, "c1")

        expect(outcome).toEqual({ kind: "attached", module: "webdesk", agentId: "agent-webdesk" })
        expect(grants.setGrant).toHaveBeenCalledTimes(1)
        expect(grants.setGrant).toHaveBeenCalledWith(expect.anything(), "c1", "agent-webdesk", true)
    })

    it("fails the connect loudly and marks the connection in error when the install fails", async () => {
        const { service, creation, connections, logger } = await build()
        const cause = new Error("workflows refused")
        creation.create.mockRejectedValue(cause)

        const failure = await service.ensureForConnection(ACTOR, "c1").catch((error: unknown) => error)

        expect(failure).toBeInstanceOf(AgentInstancesError)
        expect(failure instanceof AgentInstancesError && failure.code).toBe(AgentInstancesErrorCode.FrontDoorFailed)
        expect(connections.patch).toHaveBeenCalledWith("w1", "c1", {
            status: "error",
            lastError: AgentInstancesErrorCode.FrontDoorFailed,
        })
        expect(logger.error).toHaveBeenCalledWith(AgentInstancesLogEvent.FrontDoorFailed, cause, expect.anything())
    })

    it("still throws the install failure when marking the connection fails too", async () => {
        const { service, creation, connections } = await build()
        creation.create.mockRejectedValue(new Error("boom"))
        connections.patch.mockRejectedValue(new Error("db down"))

        await expect(service.ensureForConnection(ACTOR, "c1")).rejects.toBeInstanceOf(AgentInstancesError)
    })

    it("fails when the workspace has no owner to install for", async () => {
        const { service, creation } = await build({ ownerId: null })

        await expect(service.ensureForConnection(ACTOR, "c1")).rejects.toBeInstanceOf(AgentInstancesError)
        expect(creation.create).not.toHaveBeenCalled()
    })

    it("installs the chatbot as the front door of a Meta connection (its Facebook and Instagram triggers)", async () => {
        const { service, creation } = await build({ provider: "meta" })

        const outcome = await service.ensureForConnection(ACTOR, "c1")

        expect(outcome).toEqual(expect.objectContaining({ kind: "installed", module: "chatbot" }))
        expect(creation.create).toHaveBeenCalledWith("owner-1", expect.objectContaining({ connectionIds: ["c1"] }))
    })

    it("installs nothing for a connection that is no customer channel", async () => {
        const { service, creation } = await build({ provider: "sepay" })

        await expect(service.ensureForConnection(ACTOR, "c1")).resolves.toEqual({ kind: "none" })
        expect(creation.create).not.toHaveBeenCalled()
    })

    it("does not install a front door the workspace may not hold", async () => {
        const { service, creation } = await build({ opens: () => false })

        await expect(service.ensureForConnection(ACTOR, "c1")).resolves.toEqual({ kind: "none" })
        expect(creation.create).not.toHaveBeenCalled()
    })

    it("makes a company's own front door own its Zalo stream: webdesk is installed and the shared chatbot is not", async () => {
        const { service, creation } = await build({ provider: "zalo_oa" })

        const outcome = await service.ensureForConnection(ACTOR, "c1")

        expect(outcome).toEqual(expect.objectContaining({ kind: "installed", module: "webdesk" }))
        expect(creation.create).toHaveBeenCalledTimes(1)
        expect(creation.create).toHaveBeenCalledWith("owner-1", expect.objectContaining({ moduleKey: "webdesk" }))
    })

    it("installs the shared chatbot on Zalo in an ordinary workspace, where the company's template is not open", async () => {
        const { service, creation } = await build({ provider: "zalo_oa", opens: (module) => module !== "webdesk" })

        const outcome = await service.ensureForConnection(ACTOR, "c1")

        expect(outcome).toEqual(expect.objectContaining({ kind: "installed", module: "chatbot" }))
        expect(creation.create).toHaveBeenCalledWith("owner-1", expect.objectContaining({ moduleKey: "chatbot" }))
    })

    it("fails the connect loudly when attaching the existing front door fails", async () => {
        const { service, grants, connections } = await build({ installed: [installationOf("chatbot", "agent-held")] })
        grants.setGrant.mockRejectedValue(new Error("refused"))

        await expect(service.ensureForConnection(ACTOR, "c1")).rejects.toBeInstanceOf(AgentInstancesError)
        expect(connections.patch).toHaveBeenCalledWith("w1", "c1", {
            status: "error",
            lastError: AgentInstancesErrorCode.FrontDoorFailed,
        })
    })
})

describe("ChannelFrontDoorService > ensureForWebsite", () => {
    it("installs the website's front door with no connection to attach", async () => {
        const { service, creation } = await build()

        const outcome = await service.ensureForWebsite(ACTOR)

        expect(outcome.kind).toBe("installed")
        expect(creation.create).toHaveBeenCalledWith("owner-1", expect.objectContaining({ connectionIds: [] }))
    })

    it("leaves a workspace that holds the website's front door alone and writes no connection status", async () => {
        const first = await build()
        const once = await first.service.ensureForWebsite(ACTOR)
        if (once.kind !== "installed") throw new Error("expected an install")
        const { service, creation, connections } = await build({
            installed: [installationOf(once.module, "agent-held")],
        })

        await expect(service.ensureForWebsite(ACTOR)).resolves.toEqual({
            kind: "held",
            module: once.module,
            agentId: "agent-held",
        })
        expect(creation.create).not.toHaveBeenCalled()
        expect(connections.get).not.toHaveBeenCalled()
    })

    it("fails the save when the install fails, with no connection to mark", async () => {
        const { service, creation, connections } = await build()
        creation.create.mockRejectedValue(new Error("boom"))

        await expect(service.ensureForWebsite(ACTOR)).rejects.toBeInstanceOf(AgentInstancesError)
        expect(connections.patch).not.toHaveBeenCalled()
    })
})
