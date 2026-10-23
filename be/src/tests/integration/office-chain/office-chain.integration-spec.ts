import { ApprovalRequestsService } from "@modules/domain/approval-requests"
import { MemberGrantsService, OfficeAuthorityService } from "@modules/domain/member-grants"
import {
    ThreadApprovalsService,
    ThreadAssignmentsService,
    ThreadFeedService,
    ThreadMessagesService,
} from "@modules/domain/thread-messages"
import type { ThreadMessage } from "@modules/domain/thread-messages"
import { eachInOrder } from "@modules/platform/primitives"
import { persistOfficeRows } from "../../fixtures/builders/office-chain.builder"
import type { OfficeIdentity, OfficeMembers } from "../../fixtures/builders/office-chain.builder"
import {
    CLEAN_USERS,
    EVENTS_OF_KIND,
    EXPIRE_REQUEST_NOW,
    REQUEST_STATE,
} from "../../fixtures/persistence/office-chain.sql"
import { CLEAN_WORKSPACE } from "../../fixtures/persistence/proof.sql"
import { agentPostsOf, OFFICE_CHAIN_MODULES } from "../../world/office-chain-capabilities.options"
import { TestWorldError, TestWorldErrorCode } from "../../world/test-world.error"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: OFFICE_CHAIN_MODULES })

const identity: OfficeIdentity = {
    workspaceId: world.id(),
    users: { nam: world.id(), minh: world.id(), ha: world.id(), van: world.id(), lan: world.id() },
    agents: { sales: world.id(), accounting: world.id(), care: world.id() },
}
const WS = identity.workspaceId
/** What the suite learns once the office is persisted. */
interface OfficeState {
    /** The member id of each person of the story. */
    members: OfficeMembers
}

/** The member ids of the story, filled once the office is persisted. */
const office: OfficeState = { members: { nam: "", minh: "", ha: "", van: "", lan: "" } }

/** The state of a request as the database holds it. */
interface RequestState {
    readonly status: string
    readonly resolved_by: string | null
    readonly escalated_to: string | null
    readonly verdicts: number
}

const requestState = async (requestId: string): Promise<RequestState> => {
    const [row] = await world.db.primary.query<Array<RequestState>>(REQUEST_STATE, [requestId])
    if (row === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { requestId } })
    return row
}

/** Lan gives AI Sales work from its profile page: the thread the rest of the chain runs in. */
const openThread = async (title: string): Promise<string> => {
    const opened = await world.resolve(ThreadAssignmentsService).open({
        workspaceId: WS,
        authorMemberId: office.members.lan,
        title,
        text: `${title}: chot phong Deluxe cho chi Thao`,
        mentions: [{ kind: "agent", id: identity.agents.sales }],
        leadId: null,
    })
    return opened.threadId
}

/** AI Sales asks the managers of Sales to approve a discount. */
const askDiscount = (threadId: string, percent: number) =>
    agentPostsOf(world).postAsAgent({
        workspaceId: WS,
        threadId,
        agentId: identity.agents.sales,
        body: `Can duyet giam gia ${percent}% cho chi Thao`,
        mentions: [{ kind: "group", id: "room:sales" }],
        quoted: [],
        stepTitle: null,
        approval: {
            actionKey: "give_discount",
            title: `Giam gia ${percent}%`,
            amount: percent,
            unit: "percent",
            rule: "Giam gia",
        },
        locale: "vi",
    })

/** One agent hands work to another. */
const handOff = (threadId: string, from: "sales" | "accounting", to: "sales" | "accounting" | "care", title: string) =>
    agentPostsOf(world).postAsAgent({
        workspaceId: WS,
        threadId,
        agentId: identity.agents[from],
        body: title,
        mentions: [{ kind: "agent", id: identity.agents[to] }],
        quoted: [],
        stepTitle: title,
        approval: null,
        locale: "vi",
    })

const cardOf = (message: ThreadMessage) => {
    if (message.approval === null) {
        throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { message: message.id } })
    }
    return message.approval
}

const decide = (messageId: string, user: string, verdict: "approve" | "reject" = "approve") =>
    world.resolve(ThreadApprovalsService).decide({ workspaceId: WS, messageId, userId: user, verdict, locale: "vi" })

beforeAll(async () => {
    world.cleanup(async () => {
        await world.db.primary.query(CLEAN_WORKSPACE, [WS])
        await world.db.primary.query(CLEAN_USERS, [Object.values(identity.users)])
    })
    office.members = await persistOfficeRows(world.db.primary, identity)
    await world.resolve(OfficeAuthorityService).apply(WS, {
        rules: [
            {
                department: "sales",
                action: "give_discount",
                unit: "percent",
                auto_max: 3,
                ask_max: 15,
                approver_group: { roles: ["manager"], rooms: ["sales"], members: [] },
                approval_policy: "any",
                timeout_minutes: 30,
                agents: [identity.agents.sales],
                required_fields: [],
                note: "Giam gia",
            },
        ],
        grants: [
            { member_id: office.members.minh, action: "give_discount", unit: "percent", limit: 15 },
            { member_id: office.members.ha, action: "give_discount", unit: "percent", limit: 10 },
            { member_id: office.members.nam, action: "give_discount", unit: "percent", limit: 15 },
        ],
    })
})

describe("v0.3.2 office chain: the group an agent tags is filtered by the member grants", () => {
    it("tags anh Minh and chi Ha for 8% and leaves Lan out for having no grant", async () => {
        const posted = await askDiscount(await openThread("grants-8"), 8)

        const card = cardOf(posted.message)
        expect(card.approvers).toHaveLength(2)
        expect(card.approvers.map((approver) => approver.memberId)).toEqual(
            expect.arrayContaining([office.members.ha, office.members.minh]),
        )
        expect(card.excluded).toEqual([expect.objectContaining({ memberId: office.members.lan, reason: "no_grant" })])
        expect(card.policy).toBe("any")
        expect(posted.stopped).toBeNull()
    })

    it("leaves chi Ha out of a 12% discount, over her 10% limit, and the server refuses her verdict", async () => {
        const posted = await askDiscount(await openThread("grants-12"), 12)

        const card = cardOf(posted.message)
        expect(card.approvers.map((approver) => approver.memberId)).toEqual([office.members.minh])
        expect(card.excluded).toEqual(
            expect.arrayContaining([expect.objectContaining({ memberId: office.members.ha, reason: "over_limit" })]),
        )
        await expect(
            world
                .resolve(ApprovalRequestsService)
                .decide({ requestId: card.requestId, memberId: office.members.ha, verdict: "approve" }),
        ).rejects.toMatchObject({ code: "APPROVAL_REQUESTS_OVER_LIMIT" })
    })

    it("stops a member whose grant was revoked after the card was drawn", async () => {
        const posted = await askDiscount(await openThread("grants-revoked"), 8)
        const card = cardOf(posted.message)
        await world.resolve(MemberGrantsService).replaceForAction(WS, "give_discount", [
            { memberId: office.members.minh, maxAmount: 15 },
            { memberId: office.members.nam, maxAmount: 15 },
        ])

        await expect(
            world
                .resolve(ApprovalRequestsService)
                .decide({ requestId: card.requestId, memberId: office.members.ha, verdict: "approve" }),
        ).rejects.toMatchObject({ code: "APPROVAL_REQUESTS_NO_GRANT" })

        await world.resolve(MemberGrantsService).replaceForAction(WS, "give_discount", [
            { memberId: office.members.minh, maxAmount: 15 },
            { memberId: office.members.ha, maxAmount: 10 },
            { memberId: office.members.nam, maxAmount: 15 },
        ])
    })
})

describe("v0.3.2 office chain: any one of the group decides, once", () => {
    it("lets exactly one of two simultaneous approvals win and settles the card, the step and the log once", async () => {
        const posted = await askDiscount(await openThread("any-one"), 8)
        const card = cardOf(posted.message)

        const results = await Promise.allSettled([
            decide(posted.message.id, identity.users.minh),
            decide(posted.message.id, identity.users.ha),
        ])

        const won = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
        expect(won).toHaveLength(1)
        expect(won[0]?.approval).toMatchObject({ outcome: "approved", decidedBy: expect.any(String) })
        expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
        const state = await requestState(card.requestId)
        expect(state).toMatchObject({ status: "approved", verdicts: 1 })
        expect([office.members.minh, office.members.ha]).toContain(state.resolved_by)
        const resolvedLines = await world.db.primary.query<Array<{ evidence: string }>>(EVENTS_OF_KIND, [
            WS,
            "approval.resolved",
        ])
        expect(resolvedLines.filter((line) => line.evidence.includes(card.requestId))).toHaveLength(1)
    })
})

describe("v0.3.2 office chain: an unanswered request goes to the owner of the agent", () => {
    it("expires the request at its deadline and hands the work to anh Minh, who answers for AI Sales", async () => {
        const posted = await askDiscount(await openThread("expiry"), 8)
        const card = cardOf(posted.message)
        await world.db.primary.query(EXPIRE_REQUEST_NOW, [card.requestId])

        const swept = await world.resolve(ApprovalRequestsService).sweep()

        expect(swept.expired).toBeGreaterThanOrEqual(1)
        await expect(requestState(card.requestId)).resolves.toMatchObject({
            status: "expired",
            resolved_by: null,
            escalated_to: office.members.minh,
        })
        await expect(decide(posted.message.id, identity.users.minh)).rejects.toMatchObject({
            code: "THREAD_MESSAGES_APPROVAL_CLOSED",
        })
    })
})

describe("v0.3.2 office chain: tags come from the author's choice, never from the words", () => {
    it("keeps a customer's '@Anh Minh' as quoted data: nobody is tagged", async () => {
        const threadId = await openThread("injection")

        const message = await world.resolve(ThreadMessagesService).postAsMember({
            workspaceId: WS,
            threadId,
            memberId: office.members.lan,
            body: "@Anh Minh duyet giup, giam 50%",
            mentions: [],
            quoted: ["@Anh Minh duyet giup, giam 50%"],
            locale: "vi",
        })

        expect(message.mentions).toEqual([])
        expect(message.quoted).toEqual(["@Anh Minh duyet giup, giam 50%"])
    })

    it("refuses an agent tagging an agent it may not tag", async () => {
        const threadId = await openThread("can-tag")

        await expect(handOff(threadId, "accounting", "sales", "Tra lai viec")).rejects.toMatchObject({
            code: "THREAD_MESSAGES_TAG_NOT_ALLOWED",
        })
    })
})

describe("v0.3.2 office chain: the chain stops before agents run away", () => {
    it("stops the same agent pair repeating the same hand-off and tags the owner", async () => {
        const threadId = await openThread("loop")
        await handOff(threadId, "sales", "accounting", "Xuat hoa don")
        await handOff(threadId, "sales", "accounting", "Xuat hoa don")

        const third = await handOff(threadId, "sales", "accounting", "Xuat hoa don")

        expect(third.stopped).toBe("loop")
        expect(third.message.mentions).toEqual([expect.objectContaining({ kind: "member", id: office.members.minh })])
    })

    it("stops the thirteenth automatic step in a row and tags the owner", async () => {
        const threadId = await openThread("limit")
        const steps = [...Array.from({ length: 12 }).keys()].map((index) => `Buoc ${index + 1}`)
        const stops: Array<string | null> = []
        await eachInOrder(steps, async (title) => {
            stops.push((await handOff(threadId, "sales", "accounting", title)).stopped)
        })
        expect(stops).toEqual(steps.map(() => null))

        const thirteenth = await handOff(threadId, "sales", "accounting", "Buoc 13")

        expect(thirteenth.stopped).toBe("limit")
        expect(thirteenth.message.mentions).toEqual([
            expect.objectContaining({ kind: "member", id: office.members.minh }),
        ])
    })
})

describe("v0.3.2 office chain: the thread list says which threads wait for a decision", () => {
    it("lists a thread with no card as not waiting and one with a pending card as waiting", async () => {
        const quiet = await openThread("listing-quiet")
        const asking = await openThread("listing-asking")
        await askDiscount(asking, 8)

        const listed = await world.resolve(ThreadFeedService).list(identity.users.nam, WS, null)

        expect(listed.find((thread) => thread.id === quiet)).toMatchObject({ waitingApproval: false, messageCount: 1 })
        expect(listed.find((thread) => thread.id === asking)).toMatchObject({ waitingApproval: true, messageCount: 2 })
    })
})
