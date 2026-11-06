import { Test } from "@nestjs/testing"
import type { ListedRecord } from "@nivo-lite/agent-sdk/entity/port"
import { candidateOf, onePerCustomer, profileDueQuery, profileValues, triedValues } from "./chat-profile.policy"

/** The members of the subject under test. */
interface Subject {
    readonly candidateOf: typeof candidateOf
    readonly onePerCustomer: typeof onePerCustomer
    readonly profileDueQuery: typeof profileDueQuery
    readonly profileValues: typeof profileValues
    readonly triedValues: typeof triedValues
}

const SUBJECT = Symbol("chat-profile.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { candidateOf, onePerCustomer, profileDueQuery, profileValues, triedValues },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const listed = (id: string, data: Record<string, unknown>): Pick<ListedRecord, "row"> => ({
    row: { id, workspaceId: "w", version: "1", createdAt: "", updatedAt: "", data: { ...data } },
})

const AT = new Date("2026-11-07T10:00:00.000Z")

describe("profileDueQuery", () => {
    it("asks for the zalo conversations of the connection never read or read before the cut, and not tried since the retry cut, newest first", async () => {
        const subject = await build()
        const query = subject.profileDueQuery({
            connectionId: "c-1",
            refreshedBefore: new Date("2026-10-31T10:00:00.000Z"),
            triedBefore: new Date("2026-11-07T09:00:00.000Z"),
            limit: 10,
        })

        expect(query).toEqual({
            from: "chat.conversation",
            select: ["externalId"],
            where: {
                op: "and",
                of: [
                    { op: "eq", field: "channel", value: "zalo" },
                    { op: "eq", field: "connectionId", value: "c-1" },
                    { op: "notNull", field: "externalId" },
                    {
                        op: "or",
                        of: [
                            { op: "isNull", field: "profileAt" },
                            { op: "lt", field: "profileAt", value: "2026-10-31T10:00:00.000Z" },
                        ],
                    },
                    {
                        op: "or",
                        of: [
                            { op: "isNull", field: "profileTriedAt" },
                            { op: "lt", field: "profileTriedAt", value: "2026-11-07T09:00:00.000Z" },
                        ],
                    },
                ],
            },
            order: [
                ["lastAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: 10 },
        })
    })
})

describe("candidateOf", () => {
    it("names the conversation and its customer id, and none for a record without a customer id", async () => {
        const subject = await build()

        expect(subject.candidateOf(listed("a", { externalId: "u-1" }))).toEqual([{ id: "a", externalId: "u-1" }])
        expect(subject.candidateOf(listed("b", { externalId: "" }))).toEqual([])
        expect(subject.candidateOf(listed("c", { externalId: null }))).toEqual([])
    })
})

describe("onePerCustomer", () => {
    it("keeps the first conversation of each customer id", async () => {
        const subject = await build()

        expect(
            subject.onePerCustomer([
                { id: "a", externalId: "u-1" },
                { id: "b", externalId: "u-2" },
                { id: "c", externalId: "u-1" },
            ]),
        ).toEqual([
            { id: "a", externalId: "u-1" },
            { id: "b", externalId: "u-2" },
        ])
    })
})

describe("profileValues and triedValues", () => {
    it("writes the name, the picture and the moment of a read", async () => {
        const subject = await build()

        expect(subject.profileValues({ name: "Minh", avatarUrl: "https://zalo.test/a.png" }, AT)).toEqual({
            name: "Minh",
            avatarUrl: "https://zalo.test/a.png",
            profileAt: "2026-11-07T10:00:00.000Z",
            profileTriedAt: "2026-11-07T10:00:00.000Z",
        })
    })

    it("leaves the name as it is when the channel gave none, and clears a picture it no longer gives", async () => {
        const subject = await build()

        expect(subject.profileValues({ name: "", avatarUrl: "" }, AT)).toEqual({
            avatarUrl: null,
            profileAt: "2026-11-07T10:00:00.000Z",
            profileTriedAt: "2026-11-07T10:00:00.000Z",
        })
    })

    it("writes only the moment of a failed try", async () => {
        const subject = await build()

        expect(subject.triedValues(AT)).toEqual({ profileTriedAt: "2026-11-07T10:00:00.000Z" })
    })
})
