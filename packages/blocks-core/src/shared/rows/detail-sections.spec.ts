import { detailSectionsOf } from "./detail-sections"

const CONTEXT = { locale: "en", currency: "USD", timeZone: "UTC" }
const RECORD = { name: "Mai", total: 1200, status: "open", since: "2026-11-05" }

describe("detailSectionsOf", () => {
    it("lists the first facts without a heading, then each titled group", () => {
        const sections = detailSectionsOf(
            RECORD,
            {
                items: [{ term: { key: "name" }, path: "name" }],
                sections: [
                    {
                        title: { key: "money" },
                        items: [
                            { term: { key: "total" }, path: "total", format: "money" },
                            { term: { key: "since" }, path: "since", format: "date" },
                        ],
                    },
                    { items: [{ term: { key: "status" }, path: "status", format: "badge" }] },
                ],
            },
            CONTEXT,
        )
        expect(sections).toEqual([
            { id: "facts", title: null, items: [{ id: "0:name", term: { key: "name" }, text: "Mai" }] },
            {
                id: "section-0",
                title: { key: "money" },
                items: [
                    { id: "0:total", term: { key: "total" }, text: "$1,200.00" },
                    { id: "1:since", term: { key: "since" }, text: "Nov 5, 2026" },
                ],
            },
            { id: "section-1", title: null, items: [{ id: "0:status", term: { key: "status" }, text: "open" }] },
        ])
    })

    it("draws a fact in the words its path is given", () => {
        const label = (path: string, raw: string): string => (path === "status" ? `status:${raw}` : raw)
        const sections = detailSectionsOf(
            RECORD,
            { items: [{ term: { key: "status" }, path: "status", format: "badge" }] },
            { ...CONTEXT, label },
        )
        expect(sections[0]?.items[0]?.text).toBe("status:open")
    })

    it("draws no first group without facts, and an empty value where the record holds none", () => {
        expect(detailSectionsOf(RECORD, { items: [] }, CONTEXT)).toEqual([])
        const [only] = detailSectionsOf(RECORD, { items: [{ term: { key: "x" }, path: "missing" }] }, CONTEXT)
        expect(only?.items[0]?.text).toBe("")
    })
})
