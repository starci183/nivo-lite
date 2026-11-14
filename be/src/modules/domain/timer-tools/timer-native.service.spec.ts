import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { isRecord } from "@modules/platform/primitives"
import { AgentTasksService } from "@modules/domain/agent-work"
import { ConversationContactsService } from "@modules/domain/contacts"
import { ToolsErrorCode, type NativeCaller } from "@modules/domain/tools"
import { TIMER_ARM_SCHEMA, TIMER_CANCEL_SCHEMA } from "./timer-native.schema"
import { TIMER_MANIFEST, TIMER_TOOL, TimerNativeService } from "./timer-native.service"

const NOW = "2026-11-13T03:00:00.000Z"
const RUN: NativeCaller["run"] = { turnId: "run-1", locale: "vi", origin: "customer", memberId: null, handedOffBy: null, contactId: "c-1", leadId: null, stepTools: [] }
const caller = (over: Partial<NativeCaller> = {}): NativeCaller => ({ agentId: "agent-1", conversationId: null, run: RUN, ...over })

const build = async (contactOfConversation: string | null = null) => {
    const tasks = mock<AgentTasksService>()
    tasks.armTimer.mockResolvedValue(undefined)
    tasks.cancelTimer.mockResolvedValue(true)
    const conversations = mock<ConversationContactsService>()
    conversations.contactOf.mockResolvedValue(contactOfConversation)
    const moduleRef = await Test.createTestingModule({
        providers: [
            TimerNativeService,
            { provide: AgentTasksService, useValue: tasks },
            { provide: ConversationContactsService, useValue: conversations },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    const service = moduleRef.get(TimerNativeService)
    return { service, tasks, conversations }
}

const codeOf = (work: Promise<unknown>): Promise<unknown> =>
    work.then(
        () => null,
        (cause: unknown) => (isRecord(cause) ? (cause["code"] ?? cause) : cause),
    )

describe("the timer manifest", () => {
    it("names both tools under nivo.tool, internal only, on no provider", () => {
        expect(TIMER_MANIFEST.tools.map((tool) => tool.domain)).toEqual(["nivo.tool.timer.arm", "nivo.tool.timer.cancel"])
        for (const tool of TIMER_MANIFEST.tools) {
            expect(`${TIMER_MANIFEST.namespace ?? ""}.${tool.name}`).toBe(tool.domain)
            expect(tool.internalOnly).toBe(true)
        }
    })
})

describe("the timer arguments", () => {
    it("takes a ref and exactly one of dueAt and afterMinutes", () => {
        expect(TIMER_ARM_SCHEMA.safeParse({ ref: "a", afterMinutes: 5 }).success).toBe(true)
        expect(TIMER_ARM_SCHEMA.safeParse({ ref: "a", dueAt: "2026-12-01T00:00:00Z" }).success).toBe(true)
        expect(TIMER_ARM_SCHEMA.safeParse({ ref: "a" }).success).toBe(false)
        expect(TIMER_ARM_SCHEMA.safeParse({ ref: "a", afterMinutes: 5, dueAt: "2026-12-01T00:00:00Z" }).success).toBe(false)
    })

    it("bounds the ref (1 to 64), the minutes (1 to a year) and the data (flat, 20 members, 2000 bytes)", () => {
        expect(TIMER_ARM_SCHEMA.safeParse({ ref: "", afterMinutes: 5 }).success).toBe(false)
        expect(TIMER_ARM_SCHEMA.safeParse({ ref: "x".repeat(64), afterMinutes: 5 }).success).toBe(true)
        expect(TIMER_ARM_SCHEMA.safeParse({ ref: "x".repeat(65), afterMinutes: 5 }).success).toBe(false)
        expect(TIMER_ARM_SCHEMA.safeParse({ ref: "a", afterMinutes: 0 }).success).toBe(false)
        expect(TIMER_ARM_SCHEMA.safeParse({ ref: "a", afterMinutes: 525_601 }).success).toBe(false)
        expect(TIMER_ARM_SCHEMA.safeParse({ ref: "a", afterMinutes: 1.5 }).success).toBe(false)
        expect(TIMER_ARM_SCHEMA.safeParse({ ref: "a", afterMinutes: 5, data: { n: 1, s: "x", b: true } }).success).toBe(true)
        expect(TIMER_ARM_SCHEMA.safeParse({ ref: "a", afterMinutes: 5, data: { nested: { a: 1 } } }).success).toBe(false)
        const many = Object.fromEntries(Array.from({ length: 21 }, (_, at) => [`k${String(at)}`, 1]))
        expect(TIMER_ARM_SCHEMA.safeParse({ ref: "a", afterMinutes: 5, data: many }).success).toBe(false)
        const big = Object.fromEntries(Array.from({ length: 10 }, (_, at) => [`k${String(at)}`, "x".repeat(300)]))
        expect(TIMER_ARM_SCHEMA.safeParse({ ref: "a", afterMinutes: 5, data: big }).success).toBe(false)
        expect(TIMER_CANCEL_SCHEMA.safeParse({ ref: "a", extra: 1 }).success).toBe(false)
    })
})

describe("the data keys of a timer", () => {
    it("must be addressable by a trigger path (`data.<key>`): a letter first, then letters, digits, `_` or `-`", () => {
        expect(TIMER_ARM_SCHEMA.safeParse({ ref: "a", afterMinutes: 5, data: { kind: "care", "next-step": 1, tier_2: true } }).success).toBe(true)
        expect(TIMER_ARM_SCHEMA.safeParse({ ref: "a", afterMinutes: 5, data: { "a.b": 1 } }).success).toBe(false)
        expect(TIMER_ARM_SCHEMA.safeParse({ ref: "a", afterMinutes: 5, data: { "9lives": 1 } }).success).toBe(false)
    })
})

describe("TimerNativeService.arm", () => {
    it("stores one task of the agent keyed by contact and ref, due after the minutes, and answers the ref and the moment", async () => {
        const { service, tasks } = await build()
        const answer = await service.invoke("ws-1", TIMER_TOOL.arm, { ref: "pay-check", afterMinutes: 90, data: { tries: 1 } }, caller())
        expect(answer).toEqual({ ref: "pay-check", dueAt: "2026-11-13T04:30:00.000Z" })
        expect(tasks.armTimer).toHaveBeenCalledWith("ws-1", "agent-1", {
            key: "timer:contact:c-1:pay-check",
            title: "timer due 2026-11-13T04:30:00.000Z",
            wakeAt: new Date("2026-11-13T04:30:00.000Z"),
            data: { tries: 1 },
        })
    })

    it("keeps a farther timer's wake seven days ahead while its title keeps the real due instant", async () => {
        const { service, tasks } = await build()
        const answer = await service.invoke("ws-1", TIMER_TOOL.arm, { ref: "r", dueAt: "2027-03-01T00:00:00.000Z" }, caller())
        expect(answer).toEqual({ ref: "r", dueAt: "2027-03-01T00:00:00.000Z" })
        expect(tasks.armTimer).toHaveBeenCalledWith(
            "ws-1",
            "agent-1",
            expect.objectContaining({ title: "timer due 2027-03-01T00:00:00.000Z", wakeAt: new Date("2026-11-20T03:00:00.000Z"), data: null }),
        )
    })

    it("arms the same ref again as the same key: replacing, not adding", async () => {
        const { service, tasks } = await build()
        await service.invoke("ws-1", TIMER_TOOL.arm, { ref: "r", afterMinutes: 10 }, caller())
        await service.invoke("ws-1", TIMER_TOOL.arm, { ref: "r", afterMinutes: 20 }, caller())
        const [first, second] = tasks.armTimer.mock.calls.map((call) => (isRecord(call[2]) ? call[2]["key"] : undefined))
        expect(first).toBe(second)
    })

    it("uses the conversation's contact when the run carries none, then the conversation, then no subject", async () => {
        const viaConversation = await build("c-7")
        await viaConversation.service.invoke("ws-1", TIMER_TOOL.arm, { ref: "r", afterMinutes: 10 }, caller({ conversationId: "v-1", run: undefined }))
        expect(viaConversation.tasks.armTimer).toHaveBeenCalledWith("ws-1", "agent-1", expect.objectContaining({ key: "timer:contact:c-7:r" }))

        const onlyConversation = await build(null)
        await onlyConversation.service.invoke("ws-1", TIMER_TOOL.arm, { ref: "r", afterMinutes: 10 }, caller({ conversationId: "v-1", run: undefined }))
        expect(onlyConversation.tasks.armTimer).toHaveBeenCalledWith("ws-1", "agent-1", expect.objectContaining({ key: "timer:conversation:v-1:r" }))

        const none = await build()
        await none.service.invoke("ws-1", TIMER_TOOL.arm, { ref: "r", afterMinutes: 10 }, caller({ run: undefined }))
        expect(none.tasks.armTimer).toHaveBeenCalledWith("ws-1", "agent-1", expect.objectContaining({ key: "timer:none:-:r" }))
    })

    it("keeps the conversation of the arming run beside the contact in the task's title, so the due wake carries both", async () => {
        const { service, tasks } = await build()
        await service.invoke("ws-1", TIMER_TOOL.arm, { ref: "r", afterMinutes: 90 }, caller({ conversationId: "v-1" }))
        expect(tasks.armTimer).toHaveBeenCalledWith(
            "ws-1",
            "agent-1",
            expect.objectContaining({ key: "timer:contact:c-1:r", title: "timer due 2026-11-13T04:30:00.000Z in v-1" }),
        )
    })

    it("refuses a moment outside the bounds (past, under a minute, over 365 days) as invalid arguments and stores nothing", async () => {
        const { service, tasks } = await build()
        for (const args of [
            { ref: "r", dueAt: "2026-11-13T02:59:00.000Z" },
            { ref: "r", dueAt: "2026-11-13T03:00:30.000Z" },
            { ref: "r", dueAt: "2027-11-14T03:00:00.000Z" },
        ]) {
            expect(await codeOf(service.invoke("ws-1", TIMER_TOOL.arm, args, caller()))).toBe(ToolsErrorCode.InvalidArguments)
        }
        expect(await codeOf(service.invoke("ws-1", TIMER_TOOL.arm, { ref: "r" }, caller()))).toBe(ToolsErrorCode.InvalidArguments)
        expect(tasks.armTimer).not.toHaveBeenCalled()
    })
})

describe("TimerNativeService.cancel", () => {
    it("cancels the task of the same key and answers whether one was armed", async () => {
        const { service, tasks } = await build()
        await expect(service.invoke("ws-1", TIMER_TOOL.cancel, { ref: "pay-check" }, caller())).resolves.toEqual({ cancelled: true })
        expect(tasks.cancelTimer).toHaveBeenCalledWith("agent-1", "timer:contact:c-1:pay-check")
        tasks.cancelTimer.mockResolvedValueOnce(false)
        await expect(service.invoke("ws-1", TIMER_TOOL.cancel, { ref: "none" }, caller())).resolves.toEqual({ cancelled: false })
    })

    it("answers an unknown tool as unknown", async () => {
        const { service } = await build()
        expect(await codeOf(service.invoke("ws-1", "timer.nothing", {}, caller()))).toBe(ToolsErrorCode.UnknownTool)
    })
})
