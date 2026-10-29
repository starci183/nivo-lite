import { AgentAssignmentsService } from "@modules/domain/agent-profile"
import { ApprovalRequestsService } from "@modules/domain/approval-requests"
import { DecisionsService } from "@modules/domain/decisions"
import { OfficeAuthorityService } from "@modules/domain/member-grants"
import { ModulesService } from "@modules/domain/modules"
import { ThreadFeedService } from "@modules/domain/thread-messages"
import type { ThreadMessage } from "@modules/domain/thread-messages"
import { ThreadWorkService } from "@modules/domain/thread-work"
import { persistOfficeRows, persistStoryLead } from "../../fixtures/builders/office-chain.builder"
import type { OfficeIdentity, OfficeMembers } from "../../fixtures/builders/office-chain.builder"

import { API_APP_MODULES } from "../../world/api-app.options"
import { TestWorldError, TestWorldErrorCode } from "../../world/test-world.error"
import { useTestWorld } from "../../world/use-test-world"
import { expireApprovalRequestNow, workItemsOfThread } from "../../world/office-chain-database.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"

const world = useTestWorld({ modules: API_APP_MODULES })

const identity: OfficeIdentity = {
    workspaceId: world.id(),
    users: { nam: world.id(), minh: world.id(), ha: world.id(), van: world.id(), lan: world.id() },
    agents: { sales: world.id(), accounting: world.id(), care: world.id() },
}
const WS = identity.workspaceId
const LEAD = world.id()

/** What the suite learns once the office is persisted. */
interface StoryState {
    /** The member id of each person of the story. */
    members: OfficeMembers
    /** The thread of the story. */
    threadId: string
}

const story: StoryState = { members: { nam: "", minh: "", ha: "", van: "", lan: "" }, threadId: "" }

/** One work item of the thread as the database holds it. */
const messagesOf = async (): Promise<ReadonlyArray<ThreadMessage>> =>
    (await world.resolve(ThreadFeedService).read(identity.users.nam, WS, story.threadId)).messages

const lastOf = async (): Promise<ThreadMessage> => {
    const messages = await messagesOf()
    const last = messages.at(-1)
    if (last === undefined)
        throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { thread: "empty" } })
    return last
}

const authority = () => ({
    rules: [
        {
            department: "sales",
            action: "give_discount",
            unit: "percent" as const,
            auto_max: 3,
            ask_max: 15,
            approver_group: { roles: ["manager" as const], rooms: ["sales"], members: [] },
            approval_policy: "any" as const,
            timeout_minutes: 30,
            agents: [identity.agents.sales],
            required_fields: ["customer"],
            note: "Giam gia",
        },
        {
            department: "accounting",
            action: "issue_invoice",
            unit: "vnd" as const,
            auto_max: 20_000_000,
            ask_max: 500_000_000,
            approver_group: { roles: [], rooms: ["accounting"], members: [story.members.van] },
            approval_policy: "any" as const,
            timeout_minutes: 30,
            agents: [identity.agents.accounting],
            required_fields: ["customer", "amount_vnd", "tax_code"],
            note: "Xuat hoa don",
        },
        {
            department: "chatbot",
            action: "reply_customer",
            unit: "count" as const,
            auto_max: 1,
            ask_max: 1,
            approver_group: { roles: ["manager" as const], rooms: ["care"], members: [] },
            approval_policy: "any" as const,
            timeout_minutes: 30,
            agents: [identity.agents.care],
            required_fields: [],
            note: "Xac nhan",
        },
    ],
    grants: [
        { member_id: story.members.minh, action: "give_discount", unit: "percent" as const, limit: 15 },
        { member_id: story.members.ha, action: "give_discount", unit: "percent" as const, limit: 10 },
        { member_id: story.members.van, action: "issue_invoice", unit: "vnd" as const, limit: 500_000_000 },
    ],
})

beforeAll(async () => {
    world.cleanup(async () => {
        await removeWorkspace(world.db.primary, WS)
        await removeAuthUsers(world.db.primary, Object.values(identity.users))
    })
    await world.resolve(ModulesService).sync()
    story.members = await persistOfficeRows(world.db.primary, identity)
    await persistStoryLead(world.db.primary, WS, LEAD)
    await world.resolve(OfficeAuthorityService).apply(WS, authority())
})

describe("v0.3.2 video chain in the real api: the agents' turns come from their work", () => {
    it("Lan gives AI Sales the booking with 8% off: AI Sales runs give_discount and asks the managers of Sales", async () => {
        const opened = await world.resolve(AgentAssignmentsService).assign(identity.users.lan, WS, {
            agentId: identity.agents.sales,
            text: "Close the Deluxe room 24-26/10 for Chi Thao, 8% off",
            action: "give_discount",
            amount: 8,
            amountVnd: 6_440_000,
            leadId: LEAD,
        })
        story.threadId = opened.threadId

        const ask = await lastOf()
        expect(ask).toMatchObject({ authorKind: "agent", authorId: identity.agents.sales })
        expect(ask.approval).toMatchObject({ outcome: "pending", policy: "any", amount: 8, unit: "percent" })
        expect(ask.approval?.approvers.map((approver) => approver.memberId)).toEqual(
            expect.arrayContaining([story.members.minh, story.members.ha]),
        )
        expect(ask.approval?.excluded).toEqual([expect.objectContaining({ memberId: story.members.lan })])
    })

    it("anh Minh approves: the discount is done and AI Sales hands the invoice to Ke toan AI, who asks Van for the tax code", async () => {
        const ask = (await messagesOf()).find((message) => message.approval !== null)
        if (ask === undefined)
            throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { card: "none" } })

        await world.resolve(ThreadWorkService).decide({
            workspaceId: WS,
            messageId: ask.id,
            userId: identity.users.minh,
            verdict: "approve",
            locale: "vi",
        })

        const messages = await messagesOf()
        const [handOff, taxCode] = messages.slice(-2)
        expect(handOff).toMatchObject({
            authorId: identity.agents.sales,
            mentions: [expect.objectContaining({ kind: "agent", id: identity.agents.accounting })],
        })
        expect(taxCode).toMatchObject({
            authorId: identity.agents.accounting,
            mentions: [expect.objectContaining({ kind: "member", id: story.members.van })],
        })
    })

    it("Van answers with the tax code: Ke toan AI issues the invoice and hands the confirmation to AI CSKH, who confirms", async () => {
        await world.resolve(ThreadWorkService).post({
            workspaceId: WS,
            threadId: story.threadId,
            userId: identity.users.van,
            body: "0312345678",
            mentions: [],
            quoted: [],
            locale: "vi",
        })

        const [reply, handOff, confirmation] = (await messagesOf()).slice(-3)
        expect(reply).toMatchObject({ authorKind: "member", authorId: story.members.van, body: "0312345678" })
        expect(handOff).toMatchObject({
            authorId: identity.agents.accounting,
            mentions: [expect.objectContaining({ kind: "agent", id: identity.agents.care })],
        })
        expect(confirmation).toMatchObject({ authorId: identity.agents.care, mentions: [], approval: null })
        expect(confirmation?.body).toContain("Chi Thao")
    })
})

describe("v0.3.2 video chain in the real api: what the chain recorded", () => {
    it("the work engine did every step, and the chain reads 6 steps and 2 decisions by people", async () => {
        const items = await workItemsOfThread(world.db.primary, WS, LEAD)
        expect(items).toEqual([
            expect.objectContaining({ action: "give_discount", status: "done", decided_path: "human" }),
            expect.objectContaining({
                action: "issue_invoice",
                status: "done",
                decided_path: "human",
                tax_code: "0312345678",
            }),
            expect.objectContaining({ action: "reply_customer", status: "done", decided_path: "auto" }),
        ])

        const chain = await world.resolve(ThreadFeedService).chain(identity.users.nam, WS, story.threadId)
        expect(chain.summary).toMatchObject({ steps: 6, humanDecisions: 2, state: "complete" })
    })

    it("the decision history names anh Minh and Van for their decisions and NIVO for the policy's", async () => {
        const history = await world
            .resolve(DecisionsService)
            .listDecisionHistory(identity.users.nam, WS, { kind: "all", department: null, limit: 20 })

        const lines = history.map((line) => [line.action, line.outcome, line.decider_kind, line.decided_by])
        expect(lines.filter(([action]) => action === "give_discount")).toHaveLength(1)
        expect(lines).toEqual(
            expect.arrayContaining([
                ["give_discount", "approved", "staff", "Anh Minh"],
                ["issue_invoice", "edited", "staff", "Van"],
                ["reply_customer", "auto_done", "policy", expect.any(String)],
            ]),
        )
    })
})

describe("v0.3.2 decision history: what people decide outside an agent's work and what runs out of time", () => {
    it("lists the task Van completed after Lan tagged her in a thread, under Van's name", async () => {
        const thread = await world.resolve(ThreadFeedService).open({
            workspaceId: WS,
            userId: identity.users.lan,
            title: "Nho kiem tra MST",
            leadId: LEAD,
            orderId: null,
        })
        const work = world.resolve(ThreadWorkService)
        const post = { workspaceId: WS, threadId: thread.id, quoted: [], locale: "vi" as const }
        await work.post({ ...post, userId: identity.users.lan, body: "Em nho chi kiem tra MST", mentions: [] })
        await work.post({
            ...post,
            userId: identity.users.lan,
            body: "@Van kiem tra MST giup",
            mentions: [{ kind: "member", id: story.members.van }],
        })
        await work.post({ ...post, userId: identity.users.van, body: "Da kiem tra", mentions: [] })

        const history = await world
            .resolve(DecisionsService)
            .listDecisionHistory(identity.users.nam, WS, { kind: "human", department: null, limit: 50 })
        expect(history).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ action: "thread_task", outcome: "completed", decided_by: "Van" }),
            ]),
        )
    })

    it("lists a request that ran out of time as NIVO's, by policy", async () => {
        const opened = await world.resolve(AgentAssignmentsService).assign(identity.users.lan, WS, {
            agentId: identity.agents.sales,
            text: "Doan 12 khach, giam 9%",
            action: "give_discount",
            amount: 9,
            amountVnd: 30_000_000,
            leadId: LEAD,
        })
        const card = (
            await world.resolve(ThreadFeedService).read(identity.users.nam, WS, opened.threadId)
        ).messages.find((message) => message.approval !== null)
        await expireApprovalRequestNow(world.db.primary, card?.approval?.requestId ?? "")
        await world.resolve(ApprovalRequestsService).sweep()
        await world.resolve(ThreadWorkService).resumeSettled()

        const history = await world
            .resolve(DecisionsService)
            .listDecisionHistory(identity.users.nam, WS, { kind: "policy", department: "sales", limit: 50 })
        expect(history).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ action: "give_discount", outcome: "expired", decider_kind: "policy" }),
            ]),
        )
    })
})
