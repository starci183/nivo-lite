import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ChatReplyService } from "@modules/domain/chatreply"
import { DecisionsService, WorkDecisionService, WorkPlacementService } from "@modules/domain/decisions"
import { StaffService } from "@modules/domain/staff"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { AuthorityChatService } from "./authority-chat.service"
import { FlowEngineErrorCode } from "./errors/flow-engine.error"
import { FlowEngineService } from "./flow-engine.service"
import { OwnerChatService } from "./owner-chat.service"

const registerDecisionCommands = () => {
    it("decides a work item as the member and answers the item", async () => {
        const { service, decide } = await build()

        const result = await service.run({
            kind: "decide",
            workspaceId: "ws-1",
            member,
            payload: { workItemId: "item-1", decision: "approved", edits: { fields: { amount_vnd: 5 } }, locale: "en" },
        })

        expect(result.data).toEqual({ id: "item-1", status: "done" })
        expect(decide).toHaveBeenCalledWith("user-1", "ws-1", {
            workItemId: "item-1",
            decision: "approved",
            edits: { fields: [{ name: "amount_vnd", number: 5 }] },
            note: undefined,
            basis: undefined,
            locale: "en",
        })
    })

    it("refuses a decision without a verdict", async () => {
        const { service, decide } = await build()

        await expect(
            service.run({ kind: "decide", workspaceId: "ws-1", member, payload: { workItemId: "item-1" } }),
        ).rejects.toMatchObject({ code: FlowEngineErrorCode.InvalidPayload })
        expect(decide).not.toHaveBeenCalled()
    })

    it("hands a rule to the decisions capability, which checks it against the catalogue", async () => {
        const { service, saveRule } = await build()
        const payload = { department: "sales", action: "send_quote", mode: "ask" }

        await service.run({ kind: "save_rule", workspaceId: "ws-1", member, payload })

        expect(saveRule).toHaveBeenCalledWith(
            "user-1",
            "ws-1",
            expect.objectContaining({ action: "send_quote", mode: "ask", required_fields: [] }),
        )
    })

    it("takes a conversation over and answers who handles it", async () => {
        const { service, setHandling } = await build()

        const result = await service.run({
            kind: "take_over",
            workspaceId: "ws-1",
            member,
            payload: { conversationId: "conv-1", take: true },
        })

        expect(setHandling).toHaveBeenCalledWith("user-1", "ws-1", "conv-1", true, "vi")
        expect(result.data).toEqual({ conversation_id: "conv-1", handled_by: "An" })
    })
}

const registerOfficeCommands = () => {
    it("hands an Office message to the owner chat", async () => {
        const { service, reply } = await build()

        const result = await service.run({
            kind: "owner_chat",
            workspaceId: "ws-1",
            member,
            payload: { text: "@nivo ok" },
        })

        expect(reply).toHaveBeenCalledWith(member, "@nivo ok", "vi")
        expect(result.data).toEqual({ handled: true, reply: "ok", posted: false })
    })

    it("saves the mapped authority patch as the requesting member", async () => {
        const { service, updateAuthority } = await build()

        const result = await service.run({
            kind: "save_authority",
            workspaceId: "ws-1",
            member,
            payload: { policies: "check limits", goal_revenue_vnd: 100.6 },
        })

        expect(updateAuthority).toHaveBeenCalledWith("user-1", "ws-1", {
            policies: "check limits",
            goal_revenue_vnd: 101,
        })
        expect(result).toEqual({ data: { policies: "check limits" } })
    })

    it("saves a staff member in the command workspace", async () => {
        const { service, save } = await build()

        const result = await service.run({
            kind: "save_staff",
            workspaceId: "ws-2",
            member,
            payload: { name: "An", active: false },
        })

        expect(save).toHaveBeenCalledWith({
            workspaceId: "ws-2",
            id: null,
            name: "An",
            role: "",
            email: null,
            active: false,
        })
        expect(result).toEqual({ data: { id: "staff-1", name: "An" } })
    })
}

const registerPlacementCommands = () => {
    it.each([
        { payload: { note: "wait", locale: "en" }, note: "wait", locale: "en" },
        { payload: {}, note: "", locale: "vi" },
    ])("holds work with optional note and selected locale %p", async ({ payload, note, locale }) => {
        const { service, hold } = await build()

        const result = await service.run({
            kind: "hold",
            workspaceId: "ws-1",
            member,
            payload: { workItemId: "item-1", ...payload },
        })

        expect(hold).toHaveBeenCalledWith("user-1", "ws-1", { workItemId: "item-1", note, locale })
        expect(result).toEqual({ data: { id: "item-1", status: "waiting_decision" } })
    })

    it("assigns the work item through placement", async () => {
        const { service, assign } = await build()

        const result = await service.run({
            kind: "assign",
            workspaceId: "ws-1",
            member,
            payload: { work_item_id: "item-1", staff_id: "staff-1", locale: "en" },
        })

        expect(assign).toHaveBeenCalledWith("user-1", "ws-1", {
            workItemId: "item-1",
            staffId: "staff-1",
            locale: "en",
        })
        expect(result).toEqual({ data: { id: "item-1", assigned_staff_id: "staff-1" } })
    })

    it("requests a human reply using the legacy conversation and text names", async () => {
        const { service, requestReply } = await build()

        const result = await service.run({
            kind: "send_as_human",
            workspaceId: "ws-1",
            member,
            payload: { conversation_id: "conv-1", body: "Thanks", locale: "en" },
        })

        expect(requestReply).toHaveBeenCalledWith("user-1", "ws-1", {
            conversationId: "conv-1",
            body: "Thanks",
            locale: "en",
        })
        expect(result).toEqual({ data: { id: "reply-1", status: "queued" } })
    })

    it("applies authority chat with the member in the command workspace", async () => {
        const { service, apply } = await build()

        const result = await service.run({
            kind: "authority_from_chat",
            workspaceId: "ws-2",
            member,
            payload: { text: "Ask before quoting", locale: "en" },
        })

        expect(apply).toHaveBeenCalledWith({ ...member, workspaceId: "ws-2" }, "Ask before quoting", "en")
        expect(result).toEqual({ data: { summary: "saved", authority: null, rules: [] } })
    })
}

const member = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "An",
    status: "active",
})()

const build = async () => {
    const decide = jest.fn().mockResolvedValue({ id: "item-1", status: "done" })
    const hold = jest.fn().mockResolvedValue({ id: "item-1", status: "waiting_decision" })
    const saveRule = jest.fn().mockResolvedValue({ action: "send_quote", mode: "ask" })
    const setHandling = jest.fn().mockResolvedValue({ conversationId: "conv-1", handledBy: "An" })
    const reply = jest.fn().mockResolvedValue({ handled: true, reply: "ok", posted: false })
    const updateAuthority = jest.fn().mockResolvedValue({ policies: "check limits" })
    const save = jest.fn().mockResolvedValue({ id: "staff-1", name: "An" })
    const assign = jest.fn().mockResolvedValue({ id: "item-1", assigned_staff_id: "staff-1" })
    const requestReply = jest.fn().mockResolvedValue({ id: "reply-1", status: "queued" })
    const apply = jest.fn().mockResolvedValue({ summary: "saved", authority: null, rules: [] })
    const decisions = mock<DecisionsService>({ saveRule, updateAuthority })
    const work = mock<WorkDecisionService>({ decide })
    const placement = mock<WorkPlacementService>({ hold, assign })
    const staff = mock<StaffService>({ save })
    const chats = mock<ChatReplyService>({ setHandling, requestReply })
    const authorityChat = mock<AuthorityChatService>({ apply })
    const ownerChat = mock<OwnerChatService>({ reply })
    const moduleRef = await Test.createTestingModule({
        providers: [
            FlowEngineService,
            { provide: DecisionsService, useValue: decisions },
            { provide: WorkDecisionService, useValue: work },
            { provide: WorkPlacementService, useValue: placement },
            { provide: StaffService, useValue: staff },
            { provide: ChatReplyService, useValue: chats },
            { provide: AuthorityChatService, useValue: authorityChat },
            { provide: OwnerChatService, useValue: ownerChat },
        ],
    }).compile()
    return {
        service: moduleRef.get(FlowEngineService),
        decide,
        hold,
        saveRule,
        setHandling,
        reply,
        updateAuthority,
        save,
        assign,
        requestReply,
        apply,
    }
}

describe("FlowEngineService", () => {
    registerDecisionCommands()
    registerOfficeCommands()
    registerPlacementCommands()
})
