import { Test } from "@nestjs/testing"
import type { ModuleContactBlock } from "@nivo-lite/agent-sdk/module"
import { CONTACT_BLOCK_ROWS_MAX, contactBlockViewOf as realContactBlockViewOf } from "./contact-blocks.policy"

const SUBJECT = Symbol("contact-blocks.policy")

interface Subject {
    readonly contactBlockViewOf: typeof realContactBlockViewOf
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { contactBlockViewOf: realContactBlockViewOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const BLOCK: ModuleContactBlock = {
    id: "orders",
    title: { vi: "title-vi", en: "title-en" },
    read: "blocks-core.sales.api.order.of-contact",
    block: { id: "core.record-list", slot: "rows", props: { label: "x" } },
}

const rowsOf = (count: number, cursor: string | null = null): string =>
    JSON.stringify({ rows: Array.from({ length: count }, (_, at) => ({ id: `r${at}` })), cursor })

describe("contactBlockViewOf", () => {
    let contactBlockViewOf: Subject["contactBlockViewOf"]

    beforeEach(async () => {
        ;({ contactBlockViewOf } = await build())
    })

    it("gives the title in the viewer's language, the node bound to the contact and the rows as they came", () => {
        expect(contactBlockViewOf(BLOCK, "c-1", "en", rowsOf(2))).toEqual({
            id: "orders",
            title: "title-en",
            nodeJson: JSON.stringify({
                id: "orders",
                block: "core.record-list",
                props: { label: "x" },
                bind: { rows: { read: BLOCK.read, variables: { contactId: "c-1" } } },
            }),
            dataJson: rowsOf(2),
            count: 2,
            hasMore: false,
        })
        expect(contactBlockViewOf(BLOCK, "c-1", "vi", rowsOf(0)).title).toBe("title-vi")
    })

    it("keeps the first rows only and says there are more when the rows pass the bound", () => {
        expect(contactBlockViewOf(BLOCK, "c-1", "vi", rowsOf(CONTACT_BLOCK_ROWS_MAX + 1))).toMatchObject({
            count: CONTACT_BLOCK_ROWS_MAX,
            hasMore: true,
            dataJson: rowsOf(CONTACT_BLOCK_ROWS_MAX),
        })
    })

    it("says there are more when the read has a next page, and drops the cursor from what it answers", () => {
        expect(contactBlockViewOf(BLOCK, "c-1", "vi", rowsOf(2, "next-1"))).toMatchObject({
            count: 2,
            hasMore: true,
            dataJson: rowsOf(2),
        })
    })

    it("draws no row for an answer that is no page of rows", () => {
        for (const data of ["not json", JSON.stringify({ rows: "none" }), JSON.stringify(null)])
            expect(contactBlockViewOf(BLOCK, "c-1", "vi", data)).toMatchObject({ count: 0, hasMore: false, dataJson: rowsOf(0) })
    })

    it("leaves out the props of a block that declares none", () => {
        const bare: ModuleContactBlock = { ...BLOCK, block: { id: "core.record-list", slot: "rows" } }

        expect(contactBlockViewOf(bare, "c-1", "vi", rowsOf(0)).nodeJson).not.toContain("props")
    })
})
