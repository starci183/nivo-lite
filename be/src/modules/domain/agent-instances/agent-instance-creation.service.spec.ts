import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ChannelOwnersService } from "@modules/domain/agent-connections"
import { AgentIdentityService } from "@modules/domain/agents"
import { AvatarsService } from "@modules/domain/avatars"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { ModuleInstallService, ModulesService } from "@modules/domain/modules"
import type { ModuleDefinition } from "@modules/domain/modules"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember, WorkspaceRole } from "@modules/domain/workspace-members"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { CreateAgentInstanceRequest } from "./agent-instances.contracts"
import { AgentInstanceCreationService } from "./agent-instance-creation.service"
import { AgentSetupCopyService } from "./agent-setup-copy.service"
import { AgentInstancesErrorCode } from "./errors/agent-instances.error"

const SALES = mock<ModuleDefinition>({ key: "sales", multiInstance: true })

const memberOf = (role: WorkspaceRole): WorkspaceMember => ({
    userId: "u1",
    workspaceId: "w1",
    role,
    staffId: null,
    displayName: "Owner",
    status: "active",
})

const connectionOf = (id: string, provider: ConnectionRecord["provider"]): ConnectionRecord =>
    mock<ConnectionRecord>({
        id,
        provider,
        name: `Conn ${id}`,
        status: "connected",
        meta: { bot_username: `${id}_bot` },
    })

/** An installation of the workspace, the sibling a copy reads by default. */
const siblingOf = (overrides: Partial<InstallationRecord> = {}): InstallationRecord =>
    mock<InstallationRecord>({
        id: "inst-lan",
        workspaceId: "w1",
        moduleKey: "sales",
        agentId: "agent-lan",
        status: "ready",
        ...overrides,
    })

const SIBLING = siblingOf()

const REQUEST: CreateAgentInstanceRequest = {
    workspaceId: "w1",
    moduleKey: "sales",
    locale: "vi",
    name: "Minh",
    handle: null,
    avatarPreset: null,
    avatarPath: null,
    connectionIds: [],
    startFrom: "default",
    copyFrom: null,
}

const build = async (role: WorkspaceRole = "owner") => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(memberOf(role))
    members.idOf.mockResolvedValue("m-1")
    const catalog = mock<ModulesService>()
    catalog.find.mockResolvedValue(SALES)
    const install = mock<ModuleInstallService>()
    install.install.mockResolvedValue({ installationId: "inst-minh", agentId: "agent-minh", created: true })
    const installations = mock<InstallationRecordsService>()
    installations.firstOfModule.mockResolvedValue(SIBLING)
    installations.find.mockResolvedValue(SIBLING)
    const identity = mock<AgentIdentityService>()
    const avatars = mock<AvatarsService>()
    const connections = mock<ConnectionsService>()
    connections.list.mockResolvedValue([
        connectionOf("tg1", "telegram"),
        connectionOf("zl1", "zalo_oa"),
        connectionOf("sp1", "sepay"),
    ])
    const grants = mock<ConnectionGrantsService>()
    const owners = mock<ChannelOwnersService>()
    owners.ownersOf.mockResolvedValue([
        {
            connectionId: "tg1",
            agentId: "agent-lan",
            agentName: "Lan",
            module: "sales",
            purpose: "outbound_chat",
            access: "ask",
            grantedAt: new Date("2026-11-01T00:00:00.000Z"),
        },
    ])
    const setupCopy = mock<AgentSetupCopyService>()
    setupCopy.copy.mockResolvedValue({
        copied: {
            fromInstallationId: "inst-lan",
            settings: true,
            contextVersion: true,
            rules: 1,
            graph: "copied",
            knowledgeFacts: 3,
            knowledgeDocuments: 1,
            knowledgeWaiting: 2,
            knowledgeSkipped: 0,
        },
        grants: [{ connectionId: "db1", access: "read" }],
    })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentInstanceCreationService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ModulesService, useValue: catalog },
            { provide: ModuleInstallService, useValue: install },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: AgentIdentityService, useValue: identity },
            { provide: AvatarsService, useValue: avatars },
            { provide: ConnectionsService, useValue: connections },
            { provide: ConnectionGrantsService, useValue: grants },
            { provide: ChannelOwnersService, useValue: owners },
            { provide: AgentSetupCopyService, useValue: setupCopy },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return {
        service: moduleRef.get(AgentInstanceCreationService),
        members,
        install,
        installations,
        identity,
        avatars,
        grants,
        setupCopy,
        logger,
    }
}

describe("AgentInstanceCreationService > channelChoices", () => {
    it("lists the channels a new Sales agent could answer, with the agent that answers each already", async () => {
        const { service, members } = await build("staff")

        const choices = await service.channelChoices("u1", "w1", "sales")

        expect(members.require).toHaveBeenCalledWith("u1", "w1")
        expect(choices.map((choice) => [choice.connectionId, choice.ownerAgentName])).toEqual([
            ["tg1", "Lan"],
            ["zl1", null],
        ])
    })
})

describe("AgentInstanceCreationService > create", () => {
    it("adds another agent of the role with its name and the handle made from it, from the default setup", async () => {
        const { service, members, install, setupCopy, grants } = await build()

        const created = await service.create("u1", REQUEST)

        expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
        expect(install.install).toHaveBeenCalledWith("u1", {
            workspaceId: "w1",
            moduleKey: "sales",
            locale: "vi",
            newInstance: true,
            name: null,
            agent: { name: "Minh", handle: null },
        })
        expect(created).toEqual({ installationId: "inst-minh", agentId: "agent-minh", copied: null, channels: 0 })
        expect(setupCopy.copy).not.toHaveBeenCalled()
        expect(grants.setAgentConnections).not.toHaveBeenCalled()
    })

    it("installs the role as its first agent when the workspace has none yet", async () => {
        const { service, install, installations } = await build()
        installations.firstOfModule.mockResolvedValue(null)

        await service.create("u1", REQUEST)

        expect(install.install).toHaveBeenCalledWith("u1", expect.objectContaining({ newInstance: false }))
    })

    it("dresses the agent in the chosen preset or the uploaded picture", async () => {
        const { service, identity, avatars } = await build()

        await service.create("u1", { ...REQUEST, avatarPreset: "role" })
        await service.create("u1", { ...REQUEST, avatarPath: "agents/p.png" })

        expect(identity.setAvatarPreset).toHaveBeenCalledWith("u1", "w1", "agent-minh", "role")
        expect(avatars.setAgentAvatar).toHaveBeenCalledWith("u1", "w1", "agent-minh", "agents/p.png")
    })

    it("copies the setup of a sibling and grants the free channels with the copied shared connections", async () => {
        const { service, setupCopy, grants } = await build()

        const created = await service.create("u1", {
            ...REQUEST,
            connectionIds: ["zl1"],
            startFrom: "copy",
            copyFrom: "inst-lan",
        })

        expect(setupCopy.copy).toHaveBeenCalledWith(
            SIBLING,
            { installationId: "inst-minh", agentId: "agent-minh" },
            { userId: "u1", memberId: "m-1", role: "owner" },
            "vi",
        )
        expect(grants.setAgentConnections).toHaveBeenCalledWith(
            { principalId: "u1", workspaceId: "w1" },
            "agent-minh",
            [{ connectionId: "zl1" }, { connectionId: "db1", access: "read" }],
        )
        expect(created.copied).toEqual({
            fromInstallationId: "inst-lan",
            settings: true,
            contextVersion: true,
            rules: 1,
            graph: "copied",
            knowledgeFacts: 3,
            knowledgeDocuments: 1,
            knowledgeWaiting: 2,
            knowledgeSkipped: 0,
            connections: 1,
        })
        expect(created.channels).toBe(1)
    })
})

describe("AgentInstanceCreationService > create, channels", () => {
    it("refuses a channel another agent of the role answers, before anything is written", async () => {
        const { service, install } = await build()

        await expect(service.create("u1", { ...REQUEST, connectionIds: ["tg1"] })).rejects.toMatchObject({
            code: AgentInstancesErrorCode.ChannelOwned,
            params: { agent: "Lan", connectionId: "tg1" },
        })
        expect(install.install).not.toHaveBeenCalled()
    })

    it("refuses a connection the role cannot answer", async () => {
        const { service, install } = await build()

        await expect(service.create("u1", { ...REQUEST, connectionIds: ["sp1"] })).rejects.toMatchObject({
            code: AgentInstancesErrorCode.ChannelUnavailable,
        })
        expect(install.install).not.toHaveBeenCalled()
    })

    it("lets a manager create the agent but not give it channels", async () => {
        const { service, install } = await build("manager")

        await expect(service.create("u1", { ...REQUEST, connectionIds: ["zl1"] })).rejects.toMatchObject({
            code: AgentInstancesErrorCode.ChannelsNeedOwner,
        })
        expect(install.install).not.toHaveBeenCalled()
    })

    it("does not grant the copied shared connections for a manager", async () => {
        const { service, grants } = await build("manager")

        const created = await service.create("u1", { ...REQUEST, startFrom: "copy", copyFrom: "inst-lan" })

        expect(grants.setAgentConnections).not.toHaveBeenCalled()
        expect(created.copied?.connections).toBe(0)
    })
})

describe("AgentInstanceCreationService > create, refusals", () => {
    it.each<[string, InstallationRecord | null]>([
        ["of another role", siblingOf({ moduleKey: "chatbot" })],
        ["that was removed", siblingOf({ status: "removed" })],
        ["that is not in the workspace", null],
    ])("refuses to copy the setup of an installation %s", async (_case, source) => {
        const { service, installations, install } = await build()
        installations.find.mockResolvedValue(source)

        await expect(service.create("u1", { ...REQUEST, startFrom: "copy", copyFrom: "inst-x" })).rejects.toMatchObject(
            {
                code: AgentInstancesErrorCode.CopySourceInvalid,
            },
        )
        expect(install.install).not.toHaveBeenCalled()
    })

    it("refuses a name or handle that does not hold", async () => {
        const { service, install } = await build()

        await expect(service.create("u1", { ...REQUEST, name: "x" })).rejects.toMatchObject({
            code: AgentInstancesErrorCode.NameInvalid,
        })
        await expect(service.create("u1", { ...REQUEST, handle: "!!" })).rejects.toMatchObject({
            code: AgentInstancesErrorCode.HandleInvalid,
        })
        expect(install.install).not.toHaveBeenCalled()
    })
})
