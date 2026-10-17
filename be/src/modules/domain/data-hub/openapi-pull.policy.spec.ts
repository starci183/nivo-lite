import type * as SubjectModule from "./openapi-pull.policy"
import { Test } from "@nestjs/testing"
import type { OpenApiOperation, OpenApiPull } from "@modules/integrations/data-sources"
import {
    cursorKey,
    idOf,
    nextLinkOf,
    pageInput,
    pagingOf,
    parseCursor,
    PULL_MAX_PAGES,
    PULL_PAGE_SIZE,
    toRecord,
} from "./openapi-pull.policy"

const SUBJECT = Symbol("openapi-pull.policy")
type Subject = Pick<
    typeof SubjectModule,
    "pagingOf" | "pageInput" | "nextLinkOf" | "idOf" | "toRecord" | "cursorKey" | "parseCursor"
>

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { pagingOf, pageInput, nextLinkOf, idOf, toRecord, cursorKey, parseCursor } },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const pullOf = (overrides: Partial<OpenApiPull> = {}): OpenApiPull => ({
    opId: "list",
    entity: "customer",
    itemsPath: "items",
    idField: "meta.externalId",
    titleField: "meta.label",
    fixedQuery: "",
    ...overrides,
})

const opOf = (params: OpenApiOperation["params"]): OpenApiOperation => ({
    id: "list",
    method: "GET",
    path: "/records",
    summary: "List records",
    params,
    hasBody: false,
})

const base = new URL("https://api.example/v1/records")

describe("pagingOf and pageInput", () => {
    it("prefers a free page parameter over offsets and uses only query parameters", async () => {
        const subject = await buildSubject()

        const paging = subject.pagingOf(
            opOf([
                { in: "path", name: "page", required: true },
                { in: "header", name: "pageNumber", required: false },
                { in: "query", name: "pageIndex", required: false },
                { in: "query", name: "limit", required: false },
                { in: "query", name: "offset", required: false },
            ]),
            pullOf(),
        )

        expect(PULL_PAGE_SIZE).toBe(100)
        expect(PULL_MAX_PAGES).toBe(20)
        expect(paging).toEqual({ pageParam: "pageIndex", limitParam: "limit", offsetParam: undefined, pageStart: 0 })
        expect(subject.pageInput(paging, 0)).toEqual({ limit: 100, pageIndex: 0 })
        expect(subject.pageInput(paging, 3)).toEqual({ limit: 100, pageIndex: 3 })
    })

    it("skips fixed values and selects the next supported pagination name", async () => {
        const subject = await buildSubject()

        const paging = subject.pagingOf(
            opOf([
                { in: "query", name: "page", required: false },
                { in: "query", name: "pageNumber", required: false },
                { in: "query", name: "limit", required: false },
                { in: "query", name: "per_page", required: false },
            ]),
            pullOf({ fixedQuery: "page=8&limit=25" }),
        )

        expect(paging).toEqual({
            pageParam: "pageNumber",
            limitParam: "per_page",
            offsetParam: undefined,
            pageStart: 1,
        })
        expect(subject.pageInput(paging, 2)).toEqual({ per_page: 100, pageNumber: 3 })
    })

    it("uses free offsets without a page parameter and leaves fixed parameters alone", async () => {
        const subject = await buildSubject()

        const op = opOf([
            { in: "query", name: "page", required: false },
            { in: "query", name: "offset", required: false },
            { in: "query", name: "skip", required: false },
        ])
        const paging = subject.pagingOf(op, pullOf({ fixedQuery: "page=5&offset=40" }))

        expect(paging).toEqual({ pageParam: undefined, limitParam: undefined, offsetParam: "skip", pageStart: 1 })
        expect(subject.pageInput(paging, 2)).toEqual({ skip: 200 })
        const noPaging = subject.pagingOf(opOf([]), pullOf())

        expect(noPaging).toEqual({ pageParam: undefined, limitParam: undefined, offsetParam: undefined, pageStart: 1 })
        expect(subject.pageInput(noPaging, 0)).toEqual({})
    })
})

describe("nextLinkOf", () => {
    it.each([
        { next: "?page=2" },
        { links: { next: "?page=2" } },
        { _links: { next: { href: "?page=2" } } },
        { paging: { next: "?page=2" } },
        { pagination: { next: "?page=2" } },
        { meta: { next: "?page=2" } },
        { "@odata": { nextLink: "?page=2" } },
        { nextPage: "?page=2" },
        { next_page_url: "?page=2" },
        { next_url: "?page=2" },
        { next: { href: "?page=2" } },
    ])("resolves body next links against the current page (%p)", async (body) => {
        const subject = await buildSubject()

        expect(subject.nextLinkOf(body, {}, base)?.href).toBe("https://api.example/v1/records?page=2")
    })

    it("skips invalid links and takes the first valid body candidate before the Link header", async () => {
        const subject = await buildSubject()

        expect(
            subject.nextLinkOf(
                { next: "http://[", links: { next: "/page/2" } },
                { link: '</header>; rel="next"' },
                base,
            )?.href,
        ).toBe("https://api.example/page/2")
        expect(subject.nextLinkOf({ next: { href: "http://[" } }, { link: '</page/3>; rel="next"' }, base)?.href).toBe(
            "https://api.example/page/3",
        )
    })

    it("accepts quoted or bare next relations from the Link header", async () => {
        const subject = await buildSubject()

        expect(
            subject.nextLinkOf({}, { link: '</previous>; rel="prev", </records?page=2>; rel="next"' }, base)?.href,
        ).toBe("https://api.example/records?page=2")
        expect(subject.nextLinkOf(null, { link: "<https://api.example/page/4>; REL=next" }, base)?.href).toBe(
            "https://api.example/page/4",
        )
    })

    it("returns null when body values and headers offer no usable next link", async () => {
        const subject = await buildSubject()

        expect(subject.nextLinkOf({ next: "", links: { next: { href: 5 } }, nextPage: false }, {}, base)).toBeNull()
        expect(subject.nextLinkOf(null, { link: '</previous>; rel="prev"' }, base)).toBeNull()
        expect(subject.nextLinkOf({ next: "http://[" }, { link: '<http://[>; rel="next"' }, base)).toBeNull()
    })
})

describe("idOf", () => {
    it("prefers the owner's field over common ids and accepts scalar values", async () => {
        const subject = await buildSubject()

        expect(subject.idOf({ meta: { externalId: "external" }, id: "common" }, pullOf())).toBe("external")
        expect(subject.idOf({ meta: { externalId: 0 } }, pullOf())).toBe("0")
        expect(subject.idOf({ meta: { externalId: false } }, pullOf())).toBe("false")
    })

    it.each([
        ["id", "record"],
        ["_id", "record"],
        ["uuid", "record"],
        ["code", 7],
        ["sku", true],
    ] as const)("falls back to the common %s field", async (field, value) => {
        const subject = await buildSubject()

        expect(subject.idOf({ meta: { externalId: "" }, [field]: value }, pullOf())).toBe(String(value))
    })

    it("hashes object data without scalar identifiers", async () => {
        const subject = await buildSubject()

        expect(subject.idOf({}, pullOf())).toBe("bf21a9e8fbc5a3846fb05b4f")
        expect(subject.idOf({ description: "No id" }, pullOf())).toBe("d1e90e5ee48f912ae58b11b6")
    })

    it.each([
        [undefined, "da39a3ee5e6b4b0d3255bfef"],
        [null, "2be88ca4242c76e8253ac624"],
        [7, "902ba3cda1883801594b6e1b"],
        ["Ada", "b2a92698de5c13d0e9b718b7"],
    ])("hashes scalar or missing items (%p)", async (item, expected) => {
        const subject = await buildSubject()

        expect(subject.idOf(item, pullOf())).toBe(expected)
    })
})

describe("toRecord", () => {
    it("keeps object data and uses configured title and the first valid date", async () => {
        const subject = await buildSubject()

        const item = {
            id: "one",
            meta: { label: "Configured title" },
            name: "Name",
            title: "Title",
            updated_at: "2026-01-02T03:04:05Z",
            updatedAt: "2026-02-03T04:05:06Z",
        }

        expect(subject.toRecord(item, pullOf())).toEqual({
            externalId: "one",
            title: "Configured title",
            occurredAt: "2026-01-02T03:04:05Z",
            data: item,
        })
    })

    it("falls back through name and title and skips malformed dates", async () => {
        const subject = await buildSubject()

        const item = { id: "two", name: "Name", updated_at: "invalid", updatedAt: 7, timestamp: "2026-03-04" }

        expect(subject.toRecord(item, pullOf())).toEqual({
            externalId: "two",
            title: "Name",
            occurredAt: "2026-03-04",
            data: item,
        })
        const titled = { id: "three", name: "", title: 42 }

        expect(subject.toRecord(titled, pullOf())).toEqual({
            externalId: "three",
            title: "42",
            occurredAt: null,
            data: titled,
        })
        expect(subject.toRecord({}, pullOf())).toEqual({
            externalId: "bf21a9e8fbc5a3846fb05b4f",
            title: "",
            occurredAt: null,
            data: {},
        })
    })

    it("wraps a scalar item and leaves its title and occurrence time empty", async () => {
        const subject = await buildSubject()

        expect(subject.toRecord(7, pullOf())).toEqual({
            externalId: "902ba3cda1883801594b6e1b",
            title: "",
            occurredAt: null,
            data: { value: 7 },
        })
    })
})

describe("cursorKey and parseCursor", () => {
    it("names the cursor for its operation", async () => {
        const subject = await buildSubject()

        expect(subject.cursorKey("list.records")).toBe("cursor.list.records")
    })

    it.each([undefined, "", "{", "null", "[]", "{}", '{"page":"1"}', '{"page":1.5}', '{"page":-1}'])(
        "rejects a missing, broken or invalid cursor (%p)",
        async (raw) => {
            const subject = await buildSubject()

            expect(subject.parseCursor(raw)).toBeNull()
        },
    )

    it("reads a zero or positive page and defaults non-string links to empty", async () => {
        const subject = await buildSubject()

        expect(subject.parseCursor('{"page":0}')).toEqual({ page: 0, link: "" })
        expect(subject.parseCursor('{"page":2,"link":5}')).toEqual({ page: 2, link: "" })
        expect(subject.parseCursor('{"page":4,"link":"https://api.example/next"}')).toEqual({
            page: 4,
            link: "https://api.example/next",
        })
    })
})
