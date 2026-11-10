import { LIST, STACK } from "../spec/spec.fixture"
import { entityOf, jobOf, moduleOf, nodeOf } from "./installation.fixture"
import { registryLinesOf } from "./registry-lines"

describe("registryLinesOf", () => {
    it("writes one `<kind>:<id>@<version>` line per installed thing, sorted by code unit", () => {
        const lines = registryLinesOf([
            { modules: [moduleOf("sales")], blocks: [STACK] },
            { nodes: [nodeOf("nivo.lead.ensure")], jobs: [jobOf("sales.notice")], entities: [entityOf("sales.lead")] },
        ])
        expect(lines).toEqual([
            "action:sales.open@0",
            "block:test.stack@0",
            "entity:sales.lead@0",
            "job:sales.notice@0",
            "module:sales@0",
            "node:nivo.lead.ensure@0",
            "read:sales.people@0",
        ])
    })

    it("takes the version a definition declares, and 0 for one that declares none or a non-number", () => {
        const versioned = { ...LIST, version: 3 }
        const textual = { ...STACK, version: "2" }
        expect(registryLinesOf([{ blocks: [versioned, textual] }])).toEqual(["block:test.list@3", "block:test.stack@0"])
    })

    it("gives the same lines whatever the order of the parts and of the lists", () => {
        const one = registryLinesOf([{ blocks: [STACK, LIST] }, { jobs: [jobOf("a.b")] }])
        const other = registryLinesOf([{ jobs: [jobOf("a.b")] }, { blocks: [LIST, STACK] }])
        expect(one).toEqual(other)
    })

    it("keeps equal lines side by side, so a repeated id shows in the text", () => {
        expect(registryLinesOf([{ jobs: [jobOf("a.b")] }, { jobs: [jobOf("a.b")] }])).toEqual([
            "job:a.b@0",
            "job:a.b@0",
        ])
    })

    it("gives no lines for no parts or empty parts", () => {
        expect(registryLinesOf([])).toEqual([])
        expect(registryLinesOf([{}])).toEqual([])
    })
})
