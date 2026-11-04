import { previewPackage } from "../../template/packager"
import type { AgentTemplatePackage, PackageDraft, TemplateParameter } from "../../template/format.types"
import type { GraphDocument } from "../../template/graph.types"
import { FixtureError } from "./fixture-error"
import { AMOUNT_FACT, OWNER_BRANCHES, amountIs, approverOf, branchOf, graphOf } from "./graph"

/** The ids of the creator's own workspace, which must not appear anywhere in a package. */
export const CREATOR = {
    workspaceId: "11111111-1111-4111-8111-111111111111",
    agentId: "22222222-2222-4222-8222-222222222222",
    memberId: "33333333-3333-4333-8333-333333333333",
    accountId: "44444444-4444-4444-8444-444444444444",
    versionId: "55555555-5555-4555-8555-555555555555",
} as const

/** A secret that sits in the environment of the creator's agent. */
export const SECRET_IN_ENV: string = "sk-live-9f8e7d6c5b4a39281716"

/** The settings of the buyer: the limit of an amount that runs alone, and the wait of the approver. */
export const PARAMETERS: ReadonlyArray<TemplateParameter> = [
    {
        key: "autoLimit",
        kind: "number",
        label: { vi: "Muc tu chay", en: "Auto limit" },
        hint: null,
        min: 1_000_000,
        max: 50_000_000,
        required: true,
        default: 5_000_000,
    },
    {
        key: "waitMinutes",
        kind: "number",
        label: { vi: "Cho duyet", en: "Wait" },
        hint: null,
        min: 5,
        max: 2_880,
        required: false,
        default: 240,
    },
    {
        key: "shop",
        kind: "text",
        label: { vi: "Ten shop", en: "Shop name" },
        hint: null,
        min: null,
        max: null,
        required: false,
        default: "Spa Linh",
    },
]

/** A graph of the creator full of what must never leave: Brain references, customer chats, people, an id and a secret. */
export const leakyGraph = (): GraphDocument => {
    const base = graphOf()
    const nodes = base.nodes.map((node) => {
        if (node.key !== "decide") return node
        return {
            ...node,
            knows: [{ kind: "brain_fact" as const, ref: `fact-${CREATOR.workspaceId}`, label: "Gia noi bo" }],
            sources: [
                { kind: "brain" as const, factId: "fact-1", passage: "Gia von 40%", valueHash: "h" },
                { kind: "chat" as const, messageId: "msg-9", quote: "Khach Nguyen Van A 0901234567" },
            ],
            decide: {
                intent: "pay_supplier",
                facts: [AMOUNT_FACT],
                branches: OWNER_BRANCHES.map((branch) =>
                    branchOf({
                        ...branch,
                        approver:
                            branch.approver === null
                                ? null
                                : approverOf({
                                      group: {
                                          roles: ["manager"],
                                          rooms: ["room-secret"],
                                          members: [CREATOR.memberId],
                                      },
                                  }),
                        sources: [
                            { kind: "learned" as const, proposalId: "prop-1" },
                            { kind: "owner" as const, memberId: CREATOR.memberId },
                        ],
                    }),
                ),
            },
        }
    })
    const withEnv = Object.assign({}, nodes[0], { env: { API_KEY: SECRET_IN_ENV } })
    return {
        nodes: [withEnv, ...nodes.slice(1)],
        rights: [{ kind: "customers", scope: "workspace", hide: ["cost"], mask: ["phone"] }],
        contracts: [
            {
                intent: "pay_supplier",
                task: "Pay the supplier of {{shop}}",
                limits: [
                    {
                        text: "Never above {{autoLimit}} without asking",
                        triggers: [],
                        trusts: [],
                        sources: [{ kind: "chat", messageId: "msg-9", quote: "Khach Nguyen Van A" }],
                    },
                ],
                sources: [{ kind: "owner", memberId: CREATOR.memberId }],
            },
        ],
    }
}

/** What the creator gives to package version 1 of the template. */
export const draftOf = (over: Partial<PackageDraft> = {}): PackageDraft => ({
    key: "spa-booking-by-linh",
    version: 1,
    publisher: { creatorId: CREATOR.accountId, displayName: "Linh" },
    baseModule: "accounting",
    requiresPlugins: [],
    listing: {
        name: { vi: "Dat lich spa", en: "Spa booking" },
        summary: { vi: "Quy trinh cua Linh", en: "Linh process" },
        points: [],
        category: "operations",
    },
    parameters: PARAMETERS,
    bindings: [
        { parameter: "autoLimit", target: "branch_value", nodeKey: "decide", branchKey: "small", termIndex: 0 },
        { parameter: "waitMinutes", target: "branch_timeout", nodeKey: "decide", branchKey: "middle" },
    ],
    starterKnowledge: [{ title: "Gio mo cua", body: "Spa mo cua tu 9 gio den 21 gio moi ngay." }],
    persona: { soul: "Than thien, ngan gon.", likeness: null },
    forbidden: [CREATOR.workspaceId, CREATOR.agentId, CREATOR.memberId, CREATOR.versionId, CREATOR.accountId],
    ...over,
})

/** The package of a graph as the packager makes it; throws when the graph is refused, so a spec on a refusal builds its own draft. */
export const packageOf = (
    graph: GraphDocument = leakyGraph(),
    draft: PackageDraft = draftOf(),
): AgentTemplatePackage => {
    const preview = previewPackage(graph, draft)
    if (preview.package === null)
        throw new FixtureError("FIXTURE_REFUSED", `the builder graph is refused: ${preview.problems.join("; ")}`)
    return preview.package
}

/** A graph with one more branch, as the creator would add in version 2. */
export const withExtraBranch = (graph: GraphDocument): GraphDocument => ({
    ...graph,
    nodes: graph.nodes.map((node) =>
        node.decide === undefined
            ? node
            : {
                  ...node,
                  decide: {
                      ...node.decide,
                      branches: [
                          branchOf({ key: "tiny", when: amountIs("lt", 100_000), then: "auto", next: "act" }),
                          ...node.decide.branches,
                      ],
                  },
              },
    ),
})
