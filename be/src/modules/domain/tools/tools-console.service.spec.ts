import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import { ToolCallLogService } from "@modules/domain/tool-call-log"
import { ToolGrantsService } from "@modules/domain/tool-grants"
import { ToolsErrorCode } from "./errors/tools.error"
import { AgentAccountsService } from "./agent-accounts.service"
import type { ConnectionMember } from "@modules/domain/connections"
import { ToolsConsoleService } from "./tools-console.service"

/** An id from its segments: a retired or malformed id is named on purpose here, never written whole. */

const ACTOR = { principalId: "person-1", workspaceId: "ws-1" }


const build = async () => {
    const grantRows = mock<ToolGrantsService>()
    const callLines = mock<ToolCallLogService>()
    const connections = mock<ConnectionsService>()
    connections.authorize.mockResolvedValue(mock<ConnectionMember>({ role: "owner" }))
    const access = mock<AgentAccountsService>()
    access.board.mockResolvedValue({ providers: [], attachments: [] })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ToolsConsoleService,
            { provide: ToolGrantsService, useValue: grantRows },
            { provide: ToolCallLogService, useValue: callLines },
            { provide: ConnectionsService, useValue: connections },
            { provide: AgentAccountsService, useValue: access },
        ],
    }).compile()
    const admin = moduleRef.get(ToolsConsoleService)
    return { admin, grantRows, callLines, connections, access }
}

describe("ToolsConsoleService reads", () => {
    it("lists the grants of the workspace", async () => {
        const { admin, grantRows } = await build()
        grantRows.listOfWorkspace.mockResolvedValue([
            {
                tool: "nivo.tool.payment.*",
                mode: "auto",
                limit_vnd: null,
                constraints: [],
                agent_id: "a1",
                agent_name: "AI Ke toan",
            },
        ])

        await expect(admin.grants(ACTOR)).resolves.toEqual([
            {
                tool: "nivo.tool.payment.*",
                mode: "auto",
                limitVnd: null,
                constraints: [],
                agentId: "a1",
                agentName: "AI Ke toan",
                constraintsJson: "[]",
            },
        ])
        expect(grantRows.listOfWorkspace).toHaveBeenCalledWith("ws-1")
    })

    it("reads the audit with a bounded page, fifty by default", async () => {
        const { admin, callLines } = await build()
        callLines.latest.mockResolvedValue([])

        await admin.callLog({ actor: ACTOR })
        await admin.callLog({ actor: ACTOR, limit: null })
        await admin.callLog({ actor: ACTOR, limit: 500 })
        await admin.callLog({ actor: ACTOR, limit: 0 })
        await admin.callLog({ actor: ACTOR, limit: 7.4 })

        expect(callLines.latest.mock.calls.map(([page]) => page.limit)).toEqual([50, 50, 200, 1, 7])
        expect(callLines.latest).toHaveBeenCalledWith({ workspaceId: "ws-1", limit: 50 })
    })
})

/** The owner who sets access in these specs. */
const OWNER = { workspaceId: "ws-1", principalId: "owner-1" }

describe("ToolsConsoleService accounts", () => {
    it("reads the board and a module's proposal, for an owner or manager", async () => {
        const { admin, connections, access } = await build()
        access.templateProposal.mockResolvedValue([{ provider: "zalo_oa", connectionId: "conn-oa", accountLabel: "OA", connected: true }])

        await expect(admin.providerBoard(OWNER)).resolves.toEqual({ providers: [], attachments: [] })
        await expect(admin.attachmentProposal(OWNER, "sales")).resolves.toEqual([
            { provider: "zalo_oa", connectionId: "conn-oa", accountLabel: "OA", connected: true },
        ])
        expect(connections.authorize).toHaveBeenCalledWith(OWNER, ["owner", "manager"])
        expect(access.templateProposal).toHaveBeenCalledWith("ws-1", "sales")
    })

    it("attaches and detaches with the person who did it, and throws the reason of a change that was refused", async () => {
        const { admin, access } = await build()
        access.attach.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, reason: "not_connected" })
        access.detach.mockResolvedValue({ ok: false, reason: "not_attached" })
        const wish = { connectionId: "conn-oa" }

        await expect(admin.attachProvider(OWNER, "agent-1", wish)).resolves.toBeUndefined()
        await expect(admin.attachProvider(OWNER, "agent-1", wish)).rejects.toMatchObject({
            code: ToolsErrorCode.AttachmentRefused,
            params: { reason: "not_connected" },
        })
        expect(access.attach).toHaveBeenCalledWith({ workspaceId: "ws-1", agentId: "agent-1" }, wish, "owner-1")
        await expect(admin.detachProvider(OWNER, "agent-1", "conn-oa")).rejects.toMatchObject({
            params: { reason: "not_attached" },
        })
    })

    it("lets a manager attach as an owner does: an attachment carries no mode to cap", async () => {
        const { admin, access, connections } = await build()
        connections.authorize.mockResolvedValue(mock<ConnectionMember>({ role: "manager" }))
        access.attach.mockResolvedValue({ ok: true })
        access.attachByTemplate.mockResolvedValue(["a1"])

        await expect(admin.attachProvider(OWNER, "agent-1", { connectionId: "conn-oa" })).resolves.toBeUndefined()
        await admin.attachByTemplate(OWNER, "conn-tg", ["a1"])
        expect(access.attachByTemplate).toHaveBeenCalledWith("ws-1", "conn-tg", ["a1"], "owner-1")
    })

    it("sets the default account of an agent for an owner or manager, with the person who did it, and throws the reason of a refusal", async () => {
        const { admin, access, connections } = await build()
        access.setDefault.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, reason: "not_attached" })

        await expect(admin.setProviderDefault(OWNER, "agent-1", "conn-live")).resolves.toBeUndefined()
        await expect(admin.setProviderDefault(OWNER, "agent-1", "conn-other")).rejects.toMatchObject({
            code: ToolsErrorCode.AttachmentRefused,
            params: { reason: "not_attached" },
        })

        expect(connections.authorize).toHaveBeenCalledWith(OWNER, ["owner", "manager"])
        expect(access.setDefault).toHaveBeenNthCalledWith(1, { workspaceId: "ws-1", agentId: "agent-1" }, "conn-live", "owner-1")
    })

    it("changes no default for a member who is neither owner nor manager", async () => {
        const { admin, access, connections } = await build()
        connections.authorize.mockRejectedValue(new Error("forbidden"))

        await expect(admin.setProviderDefault(OWNER, "agent-1", "conn-live")).rejects.toThrow("forbidden")

        expect(access.setDefault).not.toHaveBeenCalled()
    })

    it("lists who a template would attach to a newly connected provider, and attaches the listed agents", async () => {
        const { admin, access } = await build()
        const candidate = { agentId: "a1", agentName: "Sales", module: "sales" } as const
        access.templateCandidates.mockResolvedValue([candidate])
        access.attachByTemplate.mockResolvedValue(["a1"])

        await expect(admin.templateCandidates(OWNER, "conn-tg")).resolves.toEqual([candidate])
        await expect(admin.attachByTemplate(OWNER, "conn-tg", ["a1"])).resolves.toEqual(["a1"])
        expect(access.attachByTemplate).toHaveBeenCalledWith("ws-1", "conn-tg", ["a1"], "owner-1")
    })
})
