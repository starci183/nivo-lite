import { Test } from "@nestjs/testing"
import { HttpSecurityErrorCode } from "@modules/platform/http-security"
import type { CreatedPageRow, PageQueryParameters } from "./pagination.contracts"
import { normalizePage, pageQueryParameters, readConnection, toConnection } from "./pagination.policy"

const SUBJECT = Symbol("pagination.policy")
const SCOPE = "leadBoard:workspace-one"
const POSITION = { createdAt: "2026-10-24T12:30:00.000123+00:00", id: "00000000-0000-0000-0000-000000000001" }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { normalizePage, pageQueryParameters, readConnection, toConnection } },
        ],
    }).compile()
    return moduleRef.get<
        Pick<
            typeof import("./pagination.policy"),
            "normalizePage" | "pageQueryParameters" | "readConnection" | "toConnection"
        >
    >(SUBJECT)
}

const encoded = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString("base64url")
const cursor = (overrides: object = {}): string => encoded({ v: 1, scope: SCOPE, ...POSITION, ...overrides })

describe("normalizePage", () => {
    it.each([{}, { first: null, after: null }])("defaults omitted or null values: %p", async (request) => {
        const subject = await build()

        expect(subject.normalizePage(request, SCOPE)).toEqual({ first: 50, after: null })
    })

    it.each([1, 100])("accepts the page size boundary %p", async (first) => {
        const subject = await build()

        expect(subject.normalizePage({ first }, SCOPE)).toEqual({ first, after: null })
    })

    it.each([0, -1, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects the invalid size %p", async (first) => {
        const subject = await build()

        expect(() => subject.normalizePage({ first }, SCOPE)).toThrow(HttpSecurityErrorCode.RequestInvalid)
    })

    it("retains the microseconds and exclusive id of a valid cursor", async () => {
        const subject = await build()

        expect(subject.normalizePage({ first: 2, after: cursor() }, SCOPE)).toEqual({ first: 2, after: POSITION })
    })

    it.each([
        "",
        "raw-id",
        "a".repeat(2049),
        `${cursor()}=`,
        "ab",
        Buffer.from("{broken-json").toString("base64url"),
        encoded(null),
        encoded([]),
        cursor({ v: 2 }),
        cursor({ scope: "leadBoard:workspace-two" }),
        cursor({ scope: "salesOrders:workspace-one" }),
        cursor({ createdAt: null }),
        cursor({ id: null }),
        cursor({ id: "not-a-uuid" }),
        cursor({ createdAt: "not-a-date" }),
        cursor({ createdAt: "0000-01-01T00:00:00Z" }),
        cursor({ createdAt: "2026-13-01T00:00:00Z" }),
        cursor({ createdAt: "2026-02-30T00:00:00Z" }),
        cursor({ createdAt: "2026-10-24T25:00:00Z" }),
    ])("rejects an invalid or foreign cursor (%#)", async (after) => {
        const subject = await build()

        expect(() => subject.normalizePage({ after }, SCOPE)).toThrow(HttpSecurityErrorCode.RequestInvalid)
    })
})

describe("toConnection", () => {
    it("uses the lookahead only for hasNextPage and resumes from the last returned node", async () => {
        const subject = await build()
        const next = { ...POSITION, id: "00000000-0000-0000-0000-000000000002" }

        const page = subject.toConnection([next, POSITION], 1, SCOPE, (node) => node)

        expect(page.nodes).toEqual([next])
        expect(page.pageInfo.hasNextPage).toBe(true)
        expect(subject.normalizePage({ after: page.pageInfo.endCursor }, SCOPE).after).toEqual(next)
    })

    it("answers a cursor with no next page when the result exactly fits", async () => {
        const subject = await build()

        const page = subject.toConnection([POSITION], 1, SCOPE, (node) => node)

        expect(page.nodes).toEqual([POSITION])
        expect(page.pageInfo).toEqual({ endCursor: cursor(), hasNextPage: false })
    })

    it("answers no cursor and no next page when the query found nothing", async () => {
        const subject = await build()

        expect(subject.toConnection([], 50, SCOPE, () => POSITION)).toEqual({
            nodes: [],
            pageInfo: { endCursor: null, hasNextPage: false },
        })
    })
})

describe("pageQueryParameters", () => {
    it("requests a bounded lookahead without a seek position on the first page", async () => {
        const subject = await build()

        expect(subject.pageQueryParameters(subject.normalizePage({}, SCOPE))).toEqual([null, null, 51])
    })

    it("retains the full timestamp and id when continuing a page", async () => {
        const subject = await build()

        expect(subject.pageQueryParameters(subject.normalizePage({ first: 2, after: cursor() }, SCOPE))).toEqual([
            POSITION.createdAt,
            POSITION.id,
            3,
        ])
    })
})

describe("readConnection", () => {
    it("reads the validated lookahead and encodes the exact database row position", async () => {
        const subject = await build()
        const row: CreatedPageRow = { id: POSITION.id, created_at: POSITION.createdAt }
        const read = jest.fn<Promise<ReadonlyArray<CreatedPageRow>>, [PageQueryParameters]>().mockResolvedValue([row])

        await expect(subject.readConnection({ first: 1 }, SCOPE, read)).resolves.toEqual({
            nodes: [row],
            pageInfo: { endCursor: cursor(), hasNextPage: false },
        })
        expect(read).toHaveBeenCalledWith([null, null, 2])
    })

    it("rejects an invalid cursor before calling the database reader", async () => {
        const subject = await build()
        const read = jest.fn<Promise<ReadonlyArray<CreatedPageRow>>, [PageQueryParameters]>().mockResolvedValue([])

        await expect(subject.readConnection({ after: "invalid-cursor" }, SCOPE, read)).rejects.toThrow(
            HttpSecurityErrorCode.RequestInvalid,
        )
        expect(read).not.toHaveBeenCalled()
    })
})
