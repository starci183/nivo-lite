import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentWorkHandlersService } from "@modules/domain/agent-work"
import {
    InternalProposalSettlerService,
    InternalTurnContextService,
    RuntimeAgentService,
} from "@modules/domain/agent-turns"
import { AgentDirectoryService } from "@modules/domain/agents"
import type { AgentHeader } from "@modules/domain/agents"
import { ChatTypingService } from "@modules/domain/chat-typing"
import { MessagesReadService, OfficeLinesService } from "@modules/domain/messages"
import type { OfficeThreadLine } from "@modules/domain/messages"
import { InstallationDirectoryService } from "@modules/domain/modules"
import { ThreadTagHandlerService } from "@modules/domain/thread-work"
import { WorkspaceMemberDirectoryService } from "@modules/domain/workspace-members"
import type { MemberDirectoryEntry } from "@modules/domain/workspace-members"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import {
    cardOutcome,
    KE_TOAN,
    lineOf,
    OWNER,
    settled,
    STAFF,
    turnOf,
    WAKE_AT,
} from "@tests/fixtures/builders/office-tag-handler.builder"
import { OfficeCommandService } from "./office-command.service"
import { OfficeTagHandlerService } from "./office-tag-handler.service"
import type { ProposeOutcome } from "./office-command-candidates.contracts"

interface Setup {
    readonly agent?: AgentHeader | null
    readonly installation?: { readonly id: string; readonly activeContextVersionId: string | null } | null
    readonly member?: MemberDirectoryEntry | null
    readonly page?: ReadonlyArray<OfficeThreadLine>
    readonly propose?: ProposeOutcome
}

const build = async (setup: Setup = {}) => {
    const handlers = mock<AgentWorkHandlersService>()
    const context = mock<InternalTurnContextService>({ messageOf: jest.fn().mockResolvedValue("THE PROMPT") })
    const settler = mock<InternalProposalSettlerService>({ settle: jest.fn().mockResolvedValue(settled()) })
    const runtime = mock<RuntimeAgentService>({ agentFor: jest.fn().mockResolvedValue("runtime-1") })
    const agents = mock<AgentDirectoryService>({
        headOf: jest.fn().mockResolvedValue(setup.agent === undefined ? KE_TOAN : setup.agent),
    })
    const installations = mock<InstallationDirectoryService>({
        ofAgent: jest
            .fn()
            .mockResolvedValue(
                setup.installation === undefined ? { id: "inst-1", activeContextVersionId: "v1" } : setup.installation,
            ),
    })
    const members = mock<WorkspaceMemberDirectoryService>({
        find: jest.fn().mockResolvedValue(setup.member === undefined ? OWNER : setup.member),
    })
    const commands = mock<OfficeCommandService>({
        propose: jest.fn().mockResolvedValue(setup.propose ?? { kind: "chat" }),
    })
    const reader = mock<MessagesReadService>({
        page: jest.fn().mockResolvedValue(setup.page ?? [lineOf("msg-1", { body: "@ke-toan how much?" })]),
        textOf: jest.fn().mockResolvedValue(undefined),
    })
    const lines = mock<OfficeLinesService>({ post: jest.fn().mockResolvedValue(undefined) })
    const typing = mock<ChatTypingService>({ setAgent: jest.fn().mockResolvedValue(undefined) })
    const threads = mock<ThreadTagHandlerService>({
        talkOf: jest.fn().mockResolvedValue({
            before: [{ id: "t0", author: "An", body: "earlier" }],
            tagged: { id: "msg-1", author: "Lan", body: "@ke-toan look" },
        }),
        sessionOf: jest.fn().mockReturnValue("thread:th-1"),
        say: jest.fn().mockResolvedValue(undefined),
    })
    const catalog = mock<MessageCatalog>({
        get: jest.fn((key: string, params: Record<string, unknown>) => `${key}:${String(params.handle)}`),
    })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            OfficeTagHandlerService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: AgentWorkHandlersService, useValue: handlers },
            { provide: InternalTurnContextService, useValue: context },
            { provide: InternalProposalSettlerService, useValue: settler },
            { provide: RuntimeAgentService, useValue: runtime },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: InstallationDirectoryService, useValue: installations },
            { provide: WorkspaceMemberDirectoryService, useValue: members },
            { provide: OfficeCommandService, useValue: commands },
            { provide: MessagesReadService, useValue: reader },
            { provide: OfficeLinesService, useValue: lines },
            { provide: ChatTypingService, useValue: typing },
            { provide: ThreadTagHandlerService, useValue: threads },
        ],
    }).compile()
    return {
        handler: moduleRef.get(OfficeTagHandlerService),
        handlers,
        context,
        settler,
        runtime,
        agents,
        installations,
        members,
        commands,
        reader,
        lines,
        typing,
        threads,
        logger,
    }
}


describe("OfficeTagHandlerService > registration", () => {
    it("takes the tag source of the drain when the module starts", async () => {
        const { handler, handlers } = await build()

        handler.onModuleInit()

        expect(handlers.add).toHaveBeenCalledWith(handler)
        expect(handler.sources).toEqual(["tag"])
    })

    it("keeps the talk of one room in one session of the runtime", async () => {
        const { handler } = await build()

        expect(handler.sessionOf(turnOf())).toBe("office:main")
        expect(handler.sessionOf(turnOf({ room: "sales" }))).toBe("office:sales")
    })
})

describe("OfficeTagHandlerService > prepare: no turn", () => {
    it("skips a wake whose agent is gone, without a word", async () => {
        const { handler, lines } = await build({ agent: null })

        await expect(handler.prepare(turnOf())).resolves.toEqual({
            kind: "end",
            ending: { status: "skipped", reason: "agent_gone", outcome: null },
        })
        expect(lines.post).not.toHaveBeenCalled()
    })

    it("tells the room a paused agent cannot answer and skips", async () => {
        const { handler, lines } = await build({ agent: { ...KE_TOAN, status: "paused" } })

        await expect(handler.prepare(turnOf({ room: "accounting" }))).resolves.toEqual({
            kind: "end",
            ending: { status: "skipped", reason: "agent_paused", outcome: null },
        })
        expect(lines.post.mock.calls).toEqual([
            [
                { workspaceId: "ws-1" },
                {
                    body: "office.tagPaused:ke-toan",
                    lead_id: null,
                    work_item_id: null,
                    room: "accounting",
                    unlessSaidSince: WAKE_AT,
                },
            ],
        ])
    })

    it("tells the room an agent with no applied setup cannot answer and skips", async () => {
        const { handler, lines, reader } = await build({ installation: { id: "inst-1", activeContextVersionId: null } })

        await expect(handler.prepare(turnOf())).resolves.toEqual({
            kind: "end",
            ending: { status: "skipped", reason: "not_applied", outcome: null },
        })
        expect(lines.post.mock.calls.map(([, line]) => line.body)).toEqual(["office.tagNotApplied:ke-toan"])
        expect(reader.page).not.toHaveBeenCalled()
    })

    it("skips a wake whose line no longer exists", async () => {
        const { handler, context } = await build({ page: [] })

        await expect(handler.prepare(turnOf())).resolves.toEqual({
            kind: "end",
            ending: { status: "skipped", reason: "message_gone", outcome: null },
        })
        expect(context.messageOf).not.toHaveBeenCalled()
    })

    it("skips a wake that names no line", async () => {
        const { handler } = await build()

        const turn = { ...turnOf(), context: { locale: "vi" as const } }

        await expect(handler.prepare(turn)).resolves.toMatchObject({ ending: { reason: "message_gone" } })
    })

    it.each<ProposeOutcome["kind"]>(["card", "reply"])(
        "ends with no turn when the command reader answers a %s to an owner",
        async (kind) => {
            const outcome: ProposeOutcome =
                kind === "reply" ? { kind: "reply", body: "I need the order" } : { kind: "chat" }
            const { handler, commands, context } = await build({ propose: kind === "card" ? cardOutcome() : outcome })

            await expect(handler.prepare(turnOf())).resolves.toEqual({
                kind: "end",
                ending: { status: "done", reason: null, outcome: { command: kind } },
            })
            expect(commands.propose).toHaveBeenCalledWith("user-1", "ws-1", { messageId: "msg-1", locale: "vi" })
            expect(context.messageOf).not.toHaveBeenCalled()
        },
    )
})



describe("OfficeTagHandlerService > prepare: a turn", () => {
    it("builds the context from the talk and plans a 60 second turn in the session of the room", async () => {
        const page = [
            lineOf("msg-1", { body: "@ke-toan how much is due?", author_name: "Lan" }),
            lineOf("msg-0", { body: "good morning", author_name: "An" }),
            lineOf("nivo-1", { author_kind: "system", author_name: "NIVO", body: "a note" }),
            lineOf("other-room", { room: "sales", body: "elsewhere" }),
        ]
        const { handler, context, runtime, typing, commands, reader } = await build({ page })

        await expect(handler.prepare(turnOf())).resolves.toEqual({
            kind: "run",
            plan: {
                module: "accounting",
                runtimeAgentId: "runtime-1",
                threadKey: "agent:runtime-1:office:main",
                message: "THE PROMPT",
                timeoutMs: 60_000,
            },
        })

        expect(reader.page).toHaveBeenCalledWith("ws-1", { room: null, before: null, size: 13 })
        expect(commands.propose).toHaveBeenCalledTimes(1)
        expect(runtime.agentFor).toHaveBeenCalledWith("ws-1", "accounting", { id: "inst-1", activeContextVersionId: "v1" })
        expect(context.messageOf).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-kt",
            source: "tag",
            locale: "vi",
            text: "An: good morning\n-> Lan: @ke-toan how much is due?",
        })
        expect(typing.setAgent).toHaveBeenCalledWith("ws-1", { room: null, conversationId: null }, KE_TOAN, true)
    })

    it("reads the line from its own table when it has scrolled out of the page", async () => {
        const { handler, reader, context } = await build({ page: [lineOf("later", { body: "newer", room: "accounting" })] })
        reader.textOf.mockResolvedValue({ id: "msg-1", author_kind: "human", body: "@ke-toan old question" })

        await handler.prepare(turnOf({ room: "accounting" }))

        expect(reader.page).toHaveBeenCalledWith("ws-1", { room: "accounting", before: null, size: 13 })
        expect(context.messageOf).toHaveBeenCalledWith(
            expect.objectContaining({ text: "Lan: newer\n-> : @ke-toan old question" }),
        )
    })

    it("does not offer a command card to a staff member, and goes on to a turn", async () => {
        const { handler, commands } = await build({ member: STAFF })

        await expect(handler.prepare(turnOf())).resolves.toMatchObject({ kind: "run" })
        expect(commands.propose).not.toHaveBeenCalled()
    })

    it("does not offer a command card when the author is unknown", async () => {
        const { handler, commands, members } = await build()

        const turn = { ...turnOf(), actorMemberId: null }
        await expect(handler.prepare(turn)).resolves.toMatchObject({ kind: "run" })
        expect(members.find).not.toHaveBeenCalled()
        expect(commands.propose).not.toHaveBeenCalled()
    })

    it("runs on the internal agent of the workspace when the agent has no installation", async () => {
        const { handler, runtime } = await build({ installation: null })

        await expect(handler.prepare(turnOf())).resolves.toMatchObject({ kind: "run" })
        expect(runtime.agentFor).toHaveBeenCalledWith("ws-1", "accounting", null)
    })

    it("does not fail the turn when the typing hint cannot be published", async () => {
        const { handler, typing, logger } = await build()
        typing.setAgent.mockRejectedValue(new Error("realtime down"))

        await expect(handler.prepare(turnOf())).resolves.toMatchObject({ kind: "run" })
        expect(logger.error).toHaveBeenCalledTimes(1)
    })
})

describe("OfficeTagHandlerService > prepare: other doors", () => {
    it("reads a thread tag from the thread, in the thread's session, with no card and no typing hint", async () => {
        const { handler, threads, commands, typing, reader, context } = await build()
        const turn = turnOf({ threadId: "th-1" })

        await expect(handler.prepare(turn)).resolves.toEqual({
            kind: "run",
            plan: {
                module: "accounting",
                runtimeAgentId: "runtime-1",
                threadKey: "agent:runtime-1:thread:th-1",
                message: "THE PROMPT",
                timeoutMs: 60_000,
            },
        })
        expect(threads.talkOf).toHaveBeenCalledWith(turn)
        expect(reader.page).not.toHaveBeenCalled()
        expect(commands.propose).not.toHaveBeenCalled()
        expect(typing.setAgent).not.toHaveBeenCalled()
        expect(context.messageOf).toHaveBeenCalledWith(
            expect.objectContaining({ text: "An: earlier\n-> Lan: @ke-toan look" }),
        )
    })

    it("answers in English when the wake says so", async () => {
        const { handler, context } = await build()

        await handler.prepare(turnOf({ locale: "en" }))

        expect(context.messageOf).toHaveBeenCalledWith(expect.objectContaining({ locale: "en" }))
    })

    it("answers in Vietnamese when the wake says nothing", async () => {
        const { handler, context } = await build()

        const turn = { ...turnOf(), context: { messageId: "msg-1" } }
        await handler.prepare(turn)

        expect(context.messageOf).toHaveBeenCalledWith(expect.objectContaining({ locale: "vi" }))
    })
})



describe("OfficeTagHandlerService > settle", () => {
    it("settles as the member who tagged and says the reply in the room as the agent, then clears the hint", async () => {
        const { handler, settler, lines, typing } = await build()
        const turn = turnOf({ room: "accounting" })

        await expect(handler.settle(turn, { text: "raw" })).resolves.toEqual({
            status: "done",
            reason: null,
            outcome: { replied: true, tasks: 1, actions: 0, needsHuman: false, workItemId: null },
        })

        expect(settler.settle).toHaveBeenCalledWith(turn, { text: "raw" }, {
            module: "accounting",
            actorName: "Lan",
            locale: "vi",
            installationId: "inst-1",
        })
        expect(lines.post.mock.calls).toEqual([
            [
                { workspaceId: "ws-1" },
                {
                    body: "It is 5tr.",
                    lead_id: null,
                    work_item_id: null,
                    room: "accounting",
                    unlessSaidSince: WAKE_AT,
                    agent_id: "agent-kt",
                },
            ],
        ])
        expect(typing.setAgent).toHaveBeenCalledWith(
            "ws-1",
            { room: "accounting", conversationId: null },
            KE_TOAN,
            false,
        )
    })

    it("says nothing when the proposal has no reply", async () => {
        const { handler, settler, lines } = await build()
        settler.settle.mockResolvedValue(settled({ reply: "", needsHuman: true, actions: [
                    { index: 0, action: "x", outcome: "dropped", reason: "r" },
                    { index: 1, action: "y", outcome: "requested", workItemId: "item-9" },
                ],
            }),
        )

        await expect(handler.settle(turnOf(), {})).resolves.toEqual({
            status: "done",
            reason: null,
            outcome: { replied: false, tasks: 1, actions: 2, needsHuman: true, workItemId: "item-9" },
        })
        expect(lines.post).not.toHaveBeenCalled()
    })

    it("holds a wake whose lease had moved on, and writes nothing", async () => {
        const { handler, settler, lines, typing } = await build()
        settler.settle.mockResolvedValue({ kind: "stale" })

        await expect(handler.settle(turnOf(), {})).resolves.toEqual({ status: "held", reason: "stale", outcome: null })
        expect(lines.post).not.toHaveBeenCalled()
        expect(typing.setAgent).toHaveBeenCalledTimes(1)
    })
})

describe("OfficeTagHandlerService > settle: edges", () => {
    it("acts as the agent when the author is not a member any more, and as no installation when it has none", async () => {
        const { handler, settler } = await build({ member: null, installation: null })

        await handler.settle(turnOf(), {})

        expect(settler.settle).toHaveBeenCalledWith(
            expect.anything(),
            {},
            { module: "accounting", actorName: "Ke toan", locale: "vi", installationId: null },
        )
    })

    it("skips a wake whose agent is gone", async () => {
        const { handler, settler } = await build({ agent: null })

        await expect(handler.settle(turnOf(), {})).resolves.toEqual({ status: "skipped", reason: "agent_gone", outcome: null })
        expect(settler.settle).not.toHaveBeenCalled()
    })

    it("answers in the thread through the thread half and clears nothing in the room", async () => {
        const { handler, threads, lines, typing } = await build()
        const turn = turnOf({ threadId: "th-1" })

        await handler.settle(turn, {})

        expect(threads.say).toHaveBeenCalledWith(turn, KE_TOAN, "It is 5tr.", "agent")
        expect(lines.post).not.toHaveBeenCalled()
        expect(typing.setAgent).not.toHaveBeenCalled()
    })

    it("clears the hint even when settling fails", async () => {
        const { handler, settler, typing } = await build()
        const failure = new Error("engine down")
        settler.settle.mockRejectedValue(failure)

        await expect(handler.settle(turnOf(), {})).rejects.toBe(failure)
        expect(typing.setAgent).toHaveBeenCalledWith("ws-1", { room: null, conversationId: null }, KE_TOAN, false)
    })
})

describe("OfficeTagHandlerService > holdOver", () => {
    it.each([
        ["quota", "skipped", "office.tagQuota:ke-toan"],
        ["openclaw_not_configured", "skipped", "office.tagBusy:ke-toan"],
        ["killed", "held", "office.tagWorkOff:ke-toan"],
        ["whatever", "skipped", "office.tagFailed:ke-toan"],
    ])("answers %s with an ending %s and one note", async (reason, status, body) => {
        const { handler, lines, typing } = await build()

        await expect(handler.holdOver(turnOf(), reason)).resolves.toEqual({ status, reason, outcome: null })

        expect(lines.post.mock.calls.map(([, line]) => line.body)).toEqual([body])
        expect(lines.post.mock.calls[0]?.[1]).not.toHaveProperty("agent_id")
        expect(typing.setAgent).toHaveBeenCalledWith("ws-1", { room: null, conversationId: null }, KE_TOAN, false)
    })

    it("skips a wake whose agent is gone", async () => {
        const { handler, lines } = await build({ agent: null })

        await expect(handler.holdOver(turnOf(), "quota")).resolves.toEqual({
            status: "skipped",
            reason: "agent_gone",
            outcome: null,
        })
        expect(lines.post).not.toHaveBeenCalled()
    })
})
