import { SdkError } from "../sdk-error"
import { CREATOR, SECRET_IN_ENV, draftOf, leakyGraph, packageOf } from "../tests/fixtures"
import { canonicalJson, hashOfPackage } from "./canonical"
import { leakProblems, previewPackage, suggestionsOf } from "./packager"

/** The value a canonical text holds; a text that is not JSON is a failure of the test subject. */
const readBack = (text: string): unknown => {
    try {
        return JSON.parse(text)
    } catch (error) {
        throw new SdkError("JSON_INVALID", "JSON_INVALID: the canonical text does not parse", error)
    }
}

describe("previewPackage: the allowlist", () => {
    it("keeps the process and leaves out the internal Brain, customer data, people and the secrets of the creator agent", () => {
        const preview = previewPackage(leakyGraph(), draftOf())

        expect(preview.problems).toEqual([])
        const text = JSON.stringify(preview.package)
        for (const forbidden of [
            CREATOR.workspaceId,
            CREATOR.memberId,
            "room-secret",
            "Gia von 40%",
            "Nguyen Van A",
            "0901234567",
            "msg-9",
            "prop-1",
            "fact-1",
            SECRET_IN_ENV,
            "API_KEY",
            "env",
        ]) {
            expect(text).not.toContain(forbidden)
        }
    })

    it("counts what it removed, for the preview the creator reads", () => {
        const { report } = previewPackage(leakyGraph(), draftOf())

        expect(report).toEqual(expect.objectContaining({ rights: 1 }))
        expect(report.brainRefs).toBeGreaterThanOrEqual(2)
        expect(report.privateSources).toBeGreaterThanOrEqual(5)
        expect(report.people).toBeGreaterThanOrEqual(4)
    })

    it("turns the sources of a branch into the template itself, so every branch carries its provenance", () => {
        const pkg = previewPackage(leakyGraph(), draftOf()).package
        const decide = pkg?.graph.nodes.find((node) => node.key === "decide")

        expect(
            decide?.decide?.branches.every(
                (branch) =>
                    branch.sources.length === 0 ||
                    branch.sources.some(
                        (source) =>
                            source.kind === "template" && source.key === "spa-booking-by-linh" && source.version === 1,
                    ),
            ),
        ).toBe(true)
        expect(decide?.sources).toContainEqual({ kind: "template", key: "spa-booking-by-linh", version: 1 })
    })

    it("keeps the roles of an approver and drops its members and rooms, and keeps the label of what a node knows without its reference", () => {
        const pkg = previewPackage(leakyGraph(), draftOf()).package
        const middle = pkg?.graph.nodes
            .find((node) => node.key === "decide")
            ?.decide?.branches.find((branch) => branch.key === "middle")
        const decide = pkg?.graph.nodes.find((node) => node.key === "decide")

        expect(middle?.approver?.group).toEqual({ roles: ["manager"], rooms: [], members: [] })
        expect(decide?.knows).toEqual([{ kind: "brain_fact", ref: "", label: "Gia noi bo" }])
    })

    it("never carries a data right: the rights become proposals the buyer turns on one by one", () => {
        const pkg = previewPackage(leakyGraph(), draftOf()).package

        expect(pkg?.graph.rights).toEqual([])
        expect(pkg?.proposedRights).toEqual([
            { kind: "customers", scope: "workspace", hide: ["cost"], mask: ["phone"] },
        ])
    })

    it("empties the sources of the business half of the contracts and keeps the task and the limits", () => {
        const pkg = previewPackage(leakyGraph(), draftOf()).package

        expect(pkg?.graph.contracts).toEqual([
            {
                intent: "pay_supplier",
                task: "Pay the supplier of {{shop}}",
                limits: [{ text: "Never above {{autoLimit}} without asking", triggers: [], trusts: [], sources: [] }],
                sources: [],
            },
        ])
    })

    it("names the providers to connect and the actions that need a rule, and no credential", () => {
        const pkg = previewPackage(leakyGraph(), draftOf()).package

        expect(pkg?.requiredAuthorityActions).toContain("pay_supplier")
        expect(pkg?.requiredProviders.every((provider) => typeof provider === "string")).toBe(true)
    })

    it("yields a package whose canonical text reads back to the same package and the same hash", () => {
        const made = packageOf()

        expect(readBack(canonicalJson(made))).toEqual(made)
        const { hash, ...body } = made
        expect(hashOfPackage(body)).toBe(hash)
    })
})

describe("canonicalJson", () => {
    it("sorts the keys of objects at any depth, so equal data has one text, and leaves out members that are undefined", () => {
        expect(canonicalJson({ b: 1, a: { d: [3, { y: 1, x: 2 }], c: undefined } })).toBe(
            '{"a":{"d":[3,{"x":2,"y":1}]},"b":1}',
        )
        expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }))
    })

    it("writes null and scalars as JSON does, and a value JSON cannot write as null", () => {
        expect(canonicalJson(null)).toBe("null")
        expect(canonicalJson("x")).toBe('"x"')
        expect(canonicalJson(undefined)).toBe("null")
    })
})

describe("previewPackage: the last scan", () => {
    it("refuses a package whose free text holds an id of the creator, an email address or a secret", () => {
        const graph = leakyGraph()
        const dirty = {
            ...graph,
            nodes: graph.nodes.map((node) =>
                node.key === "decide"
                    ? { ...node, does: `Ask ${CREATOR.agentId} or mail owner@shop.vn, key ${SECRET_IN_ENV}` }
                    : node,
            ),
        }

        const preview = previewPackage(dirty, draftOf())

        expect(preview.package).toBeNull()
        expect(preview.problems.join("\n")).toMatch(/an id/)
    })

    it("catches an email address and a secret alone, and an id the creator named even without a uuid shape", () => {
        expect(leakProblems({ a: "write to boss@shop.vn" }, [])).toEqual(["$.a: an email address"])
        expect(leakProblems({ a: `token ${SECRET_IN_ENV}` }, [])).toEqual(["$.a: a secret"])
        expect(leakProblems({ a: "workspace acme-42 is ours" }, ["acme-42"])).toEqual(["$.a: an id of the creator"])
        expect(leakProblems({ a: "all clear" }, [])).toEqual([])
    })

    it("scans the starter knowledge and the persona too", () => {
        const draft = draftOf({
            starterKnowledge: [{ title: "Lien he", body: "Goi anh Nam qua nam@shop.vn" }],
        })

        expect(previewPackage(leakyGraph(), draft).package).toBeNull()
    })
})

describe("previewPackage: bindings", () => {
    it("refuses a binding that points at a branch or a number that does not exist", () => {
        const draft = draftOf({
            bindings: [
                {
                    parameter: "autoLimit",
                    target: "branch_value",
                    nodeKey: "decide",
                    branchKey: "nowhere",
                    termIndex: 0,
                },
            ],
        })
        const unknown = draftOf({
            bindings: [{ parameter: "ghost", target: "branch_timeout", nodeKey: "decide", branchKey: "middle" }],
        })
        const notNumber = draftOf({
            bindings: [
                { parameter: "autoLimit", target: "branch_value", nodeKey: "decide", branchKey: "else", termIndex: 0 },
            ],
        })

        expect(previewPackage(leakyGraph(), draft).problems.join()).toMatch(/no branch/)
        expect(previewPackage(leakyGraph(), unknown).problems.join()).toMatch(/unknown parameter/)
        expect(previewPackage(leakyGraph(), notNumber).package).toBeNull()
    })

    it("suggests the numbers of the graph a creator could turn into parameters", () => {
        const suggestions = suggestionsOf(leakyGraph())

        expect(suggestions.filter((entry) => entry.target === "branch_value").length).toBeGreaterThanOrEqual(3)
        expect(suggestions.some((entry) => entry.target === "branch_timeout")).toBe(true)
    })
})
