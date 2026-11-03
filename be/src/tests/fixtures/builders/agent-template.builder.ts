import { builder } from "@starci/jest-preset"
import type { AgentTemplatePackage, PackageDraft, TemplateParameter } from "@modules/domain/agent-templates"
import { previewPackage } from "@modules/domain/agent-templates"
import type { GraphDocument } from "@modules/domain/agent-graphs"
import {
    AMOUNT_FACT,
    OWNER_EXAMPLE,
    amountIs,
    approverOf,
    branchOf,
    decideOf,
    graphOf,
    nodeOf,
} from "./agent-graph.builder"

/** The ids of the creator's own workspace, which must not appear anywhere in a package. */
export const CREATOR = {
    workspaceId: "11111111-1111-4111-8111-111111111111",
    agentId: "22222222-2222-4222-8222-222222222222",
    memberId: "33333333-3333-4333-8333-333333333333",
    accountId: "44444444-4444-4444-8444-444444444444",
    versionId: "55555555-5555-4555-8555-555555555555",
} as const

/** A secret that sits in the environment of the creator's agent. */
export const SECRET_IN_ENV = "sk-live-9f8e7d6c5b4a39281716"

/** The settings of the buyer: the limit of an amount that runs alone, and the wait of the approver. */
export const PARAMETERS: ReadonlyArray<TemplateParameter> = [
    {
        key: "autoLimit",
        kind: "number",
        label: { vi: "Mức tự chạy", en: "Auto limit" },
        hint: null,
        min: 1_000_000,
        max: 50_000_000,
        required: true,
        default: 5_000_000,
    },
    {
        key: "waitMinutes",
        kind: "number",
        label: { vi: "Chờ duyệt", en: "Wait" },
        hint: null,
        min: 5,
        max: 2_880,
        required: false,
        default: 240,
    },
    {
        key: "shop",
        kind: "text",
        label: { vi: "Tên shop", en: "Shop name" },
        hint: null,
        min: null,
        max: null,
        required: false,
        default: "Spa Linh",
    },
]

/** A graph of the creator full of what must never leave: Brain references, customer chats, people, an id and a secret. */
export const leakyGraph = (): GraphDocument => {
    const base = graphOf(OWNER_EXAMPLE)
    const nodes = base.nodes.map((node) => {
        if (node.key === "decide") {
            return {
                ...node,
                knows: [{ kind: "brain_fact" as const, ref: `fact-${CREATOR.workspaceId}`, label: "Giá nội bộ" }],
                sources: [
                    { kind: "brain" as const, factId: "fact-1", passage: "Giá vốn 40%", valueHash: "h" },
                    { kind: "chat" as const, messageId: "msg-9", quote: "Khách Nguyễn Văn A 0901234567" },
                ],
                decide: {
                    intent: "pay_supplier",
                    facts: [AMOUNT_FACT],
                    branches: OWNER_EXAMPLE.map((branch) =>
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
        }
        return node
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
                        sources: [{ kind: "chat", messageId: "msg-9", quote: "Khách Nguyễn Văn A" }],
                    },
                ],
                sources: [{ kind: "owner", memberId: CREATOR.memberId }],
            },
        ],
    }
}

/** What the creator gives to package version 1 of the template. */
export const draftOf = builder<PackageDraft>({
    key: "spa-booking-by-linh",
    version: 1,
    publisher: { creatorId: CREATOR.accountId, displayName: "Linh" },
    baseModule: "accounting",
    requiresPlugins: [],
    listing: {
        name: { vi: "Đặt lịch spa", en: "Spa booking" },
        summary: { vi: "Quy trình của Linh", en: "Linh's process" },
        points: [],
        category: "operations",
    },
    parameters: PARAMETERS,
    bindings: [
        { parameter: "autoLimit", target: "branch_value", nodeKey: "decide", branchKey: "small", termIndex: 0 },
        { parameter: "waitMinutes", target: "branch_timeout", nodeKey: "decide", branchKey: "middle" },
    ],
    starterKnowledge: [{ title: "Giờ mở cửa", body: "Spa mở cửa từ 9 giờ đến 21 giờ mỗi ngày." }],
    persona: { soul: "Thân thiện, ngắn gọn.", likeness: null },
    forbidden: [CREATOR.workspaceId, CREATOR.agentId, CREATOR.memberId, CREATOR.versionId, CREATOR.accountId],
})

/** The package of the clean graph, as the packager makes it; throws nothing, so a spec on a refused package builds its own draft. */
export const packageOf = (
    graph: GraphDocument = leakyGraph(),
    draft: PackageDraft = draftOf(),
): AgentTemplatePackage => {
    const preview = previewPackage(graph, draft)
    if (preview.package === null) throw new Error(`the builder graph is refused: ${preview.problems.join("; ")}`)
    return preview.package
}

/** A small graph with one more branch, as the creator would add in version 2. */
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

/** Re-exports the node and decide builders the template specs share. */
export { decideOf, nodeOf }
