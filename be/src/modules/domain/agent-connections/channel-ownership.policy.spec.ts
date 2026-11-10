import { Test } from "@nestjs/testing"
import type { ChannelHolder } from "./agent-connections.contracts"
import {
    answersChannel as answersChannelImplementation,
    channelOwnerOf as channelOwnerOfImplementation,
    isChannelPurpose as isChannelPurposeImplementation,
    ownersByConnection as ownersByConnectionImplementation,
    ownershipConflictOf as ownershipConflictOfImplementation,
} from "./channel-ownership.policy"

const SUBJECT = Symbol("channel-ownership.policy")
type Subject = {
    answersChannel: typeof answersChannelImplementation
    channelOwnerOf: typeof channelOwnerOfImplementation
    isChannelPurpose: typeof isChannelPurposeImplementation
    ownersByConnection: typeof ownersByConnectionImplementation
    ownershipConflictOf: typeof ownershipConflictOfImplementation
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    answersChannel: answersChannelImplementation,
                    channelOwnerOf: channelOwnerOfImplementation,
                    isChannelPurpose: isChannelPurposeImplementation,
                    ownersByConnection: ownersByConnectionImplementation,
                    ownershipConflictOf: ownershipConflictOfImplementation,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const holderOf = (overrides: Partial<ChannelHolder> = {}): ChannelHolder => ({
    connectionId: "c1",
    agentId: "s1",
    agentName: "Sales Lan",
    module: "sales",
    purpose: "outbound_chat",
    grantedAt: new Date("2026-11-01T00:00:00.000Z"),
    ...overrides,
})

describe("channel ownership policy", () => {
    it("treats inbound chat, outbound chat and lead sources as channel purposes, nothing else", async () => {
        const subject = await buildSubject()

        expect(["inbound_chat", "outbound_chat", "lead_source"].map(subject.isChannelPurpose)).toEqual([
            true,
            true,
            true,
        ])
        expect(["bank_feed", "data_source", "tool", "nope"].map(subject.isChannelPurpose)).toEqual([
            false,
            false,
            false,
            false,
        ])
    })

    it("counts every binding of a channel purpose as answering the channel (rights live in attachments)", async () => {
        const subject = await buildSubject()

        expect(subject.answersChannel("inbound_chat")).toBe(true)
        expect(subject.answersChannel("outbound_chat")).toBe(true)
        expect(subject.answersChannel("lead_source")).toBe(true)
        expect(subject.answersChannel("bank_feed")).toBe(false)
    })
})

describe("channel ownership policy > the owner", () => {
    it("makes the agent of the role granted first the owner, and ignores other roles", async () => {
        const subject = await buildSubject()

        const owner = subject.channelOwnerOf(
            [
                holderOf({ agentId: "c1", module: "chatbot", grantedAt: new Date("2026-10-01T00:00:00.000Z") }),
                holderOf({ agentId: "s2", grantedAt: new Date("2026-11-05T00:00:00.000Z") }),
                holderOf({ agentId: "s1", grantedAt: new Date("2026-11-01T00:00:00.000Z") }),
            ],
            "sales",
        )

        expect(owner?.agentId).toBe("s1")
    })

    it("breaks a tie of the same moment by the agent id, so the owner never flips", async () => {
        const subject = await buildSubject()

        expect(
            subject.channelOwnerOf([holderOf({ agentId: "s9" }), holderOf({ agentId: "s3" })], "sales")?.agentId,
        ).toBe("s3")
    })

    it("answers no owner for a role that has none on the channel", async () => {
        const subject = await buildSubject()

        expect(subject.channelOwnerOf([holderOf()], "chatbot")).toBeNull()
        expect(subject.channelOwnerOf([], "sales")).toBeNull()
    })
})

describe("channel ownership policy > conflicts and owners", () => {
    it("finds the conflict a second agent of the role would make, and none for the owner itself", async () => {
        const subject = await buildSubject()
        const holders = [holderOf()]

        expect(
            subject.ownershipConflictOf(holders, {
                agentId: "s2",
                module: "sales",
                purpose: "outbound_chat",
            })?.agentName,
        ).toBe("Sales Lan")
        expect(
            subject.ownershipConflictOf(holders, {
                agentId: "s1",
                module: "sales",
                purpose: "outbound_chat",
            }),
        ).toBeNull()
        expect(
            subject.ownershipConflictOf(holders, {
                agentId: "b1",
                module: "booking",
                purpose: "inbound_chat",
            }),
        ).toBeNull()
    })

    it("lists one owner per connection for a role", async () => {
        const subject = await buildSubject()

        const owners = subject.ownersByConnection(
            [
                holderOf({ connectionId: "c1", agentId: "s1" }),
                holderOf({ connectionId: "c2", agentId: "s2" }),
                holderOf({ connectionId: "c2", agentId: "s3", grantedAt: new Date("2026-11-09T00:00:00.000Z") }),
                holderOf({ connectionId: "c3", agentId: "b1", module: "booking" }),
            ],
            "sales",
        )

        expect(owners.map((owner) => [owner.connectionId, owner.agentId])).toEqual([
            ["c1", "s1"],
            ["c2", "s2"],
        ])
    })
})
