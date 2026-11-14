import { Test } from "@nestjs/testing"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { bindNodeProviders } from "@modules/domain/tools"
import { nodeProvidersOf, positionedOf, type AgentAttachment, type BindableNode } from "./node-accounts.policy"

/**
 * The binding at RUN TIME (nivo-frame `rights`; nothing is written at install): a node's providers in its order (`nodeProvidersOf`,
 * both graph forms: `@1` `{ kind, provider | null, connectionId | null, operations }` and a template step's provider entry), each bound
 * by `bindNodeProviders` to the agent's one attached account of it; of several, the workspace's default account of its kind, else none
 * (`needs_pick`, never a guess).
 */

/** The members of the subject under test. */
interface Subject {
    readonly bind: typeof bindNodeProviders
    readonly providers: typeof nodeProvidersOf
    readonly positioned: typeof positionedOf
}

const SUBJECT = Symbol("node-accounts.binding")

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { bind: bindNodeProviders, providers: nodeProvidersOf, positioned: positionedOf },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const SEND = TOOL.customerMessageSend
const zalo = (connectionId: string): AgentAttachment => ({ connectionId, provider: "zalo_oa" })
const telegram = (connectionId: string): AgentAttachment => ({ connectionId, provider: "telegram" })

/** A send node listing two providers in order (provider entries, as a template step's providers are read). */
const sendV2: BindableNode = {
    key: "say",
    accounts: [
        { provider: "zalo_oa", operations: { [SEND]: "auto" } },
        { provider: "telegram", operations: { [SEND]: "auto" } },
    ],
}

/** The same request in `@1`, provider by provider. */
const sendV1: BindableNode = {
    key: "say",
    accounts: [
        { kind: "messaging", provider: "zalo_oa", connectionId: null, operations: { [SEND]: "auto" } },
        { kind: "messaging", provider: "telegram", connectionId: null, operations: { [SEND]: "auto" } },
    ],
}

/** The providers of a node in its order. */
const providerKeysOf = (subject: Subject, node: BindableNode): ReadonlyArray<string> =>
    subject.providers(node).map((wanted) => wanted.provider)

const NO_DEFAULT = (): string | null => null

interface Case {
    readonly name: string
    readonly attachments: ReadonlyArray<AgentAttachment>
    readonly defaultOf?: (provider: string) => string | null
    readonly expected: ReadonlyArray<AgentAttachment>
}

const CASES: ReadonlyArray<Case> = [
    { name: "no account of either provider: nothing binds (both not_attached)", attachments: [], expected: [] },
    {
        name: "one account of the second provider only: it alone binds",
        attachments: [telegram("t1")],
        expected: [telegram("t1")],
    },
    {
        name: "one account of each: bound in the node's order, whatever the attachments' order",
        attachments: [telegram("t1"), zalo("z1")],
        expected: [zalo("z1"), telegram("t1")],
    },
    {
        name: "two accounts of one provider and no default account: no guess, that provider binds nothing (needs_pick)",
        attachments: [zalo("z1"), zalo("z2"), telegram("t1")],
        expected: [telegram("t1")],
    },
    {
        name: "two accounts of one provider, the workspace default account of its kind is one of them: that one",
        attachments: [zalo("z1"), zalo("z2")],
        defaultOf: (provider) => (provider === "zalo_oa" ? "z2" : null),
        expected: [zalo("z2")],
    },
    {
        name: "a default account the agent is not attached to is no pick",
        attachments: [zalo("z1"), zalo("z2")],
        defaultOf: () => "z9",
        expected: [],
    },
    {
        name: "a single attached account binds whatever the default account is",
        attachments: [zalo("z1")],
        defaultOf: () => "z9",
        expected: [zalo("z1")],
    },
]

describe("bindNodeProviders over a node's providers", () => {
    it.each(CASES.map((one) => [one.name, one] as const))("%s", async (_name, one) => {
        const subject = await build()
        expect(subject.bind(providerKeysOf(subject, sendV2), one.attachments, one.defaultOf ?? NO_DEFAULT)).toEqual(
            one.expected,
        )
    })

    it("@1 gives the same providers, positions and binding as provider entries", async () => {
        const subject = await build()
        expect(subject.providers(sendV1)).toEqual(subject.providers(sendV2))
        expect(subject.providers(sendV1).map((wanted) => [wanted.provider, wanted.position])).toEqual([
            ["zalo_oa", 0],
            ["telegram", 1],
        ])
        expect(subject.bind(providerKeysOf(subject, sendV1), [telegram("t1"), zalo("z1")], NO_DEFAULT)).toEqual([
            zalo("z1"),
            telegram("t1"),
        ])
    })

    it("@1 kind-wide entry: every provider of the kind, bound in the node's order where attached", async () => {
        const subject = await build()
        const node: BindableNode = {
            key: "say",
            accounts: [{ kind: "messaging", provider: null, connectionId: null, operations: { [SEND]: "auto" } }],
        }
        const keys = providerKeysOf(subject, node)
        expect([...keys].sort()).toEqual(["meta", "telegram", "zalo_oa"])
        expect(subject.bind(keys, [zalo("z1"), telegram("t1")], NO_DEFAULT).map((one) => one.provider)).toEqual(
            keys.filter((key) => key !== "meta"),
        )
    })

    it("@1 entry pinning an account: the provider carries the pin", async () => {
        const subject = await build()
        const node: BindableNode = {
            key: "a",
            accounts: [{ kind: "messaging", provider: "zalo_oa", connectionId: "z2", operations: { [SEND]: "auto" } }],
        }
        expect(subject.providers(node).map((wanted) => [wanted.provider, wanted.pinned])).toEqual([["zalo_oa", "z2"]])
    })

    it("narrowing kept: a step that drops a provider binds exactly the one it keeps", async () => {
        const subject = await build()
        const node: BindableNode = { key: "say", accounts: [{ provider: "telegram", operations: { [SEND]: "auto" } }] }
        expect(subject.bind(providerKeysOf(subject, node), [zalo("z1"), telegram("t1")], NO_DEFAULT)).toEqual([
            telegram("t1"),
        ])
    })

    it("nivo has no account to bind; a node with no accounts or [] lists no provider", async () => {
        const subject = await build()
        expect(subject.bind(["nivo"], [zalo("z1")], NO_DEFAULT)).toEqual([])
        expect(subject.providers({ key: "old" })).toEqual([])
        expect(subject.providers({ key: "own", accounts: [] })).toEqual([])
    })

    it("one provider named twice keeps its first place", async () => {
        const subject = await build()
        const node: BindableNode = {
            key: "say",
            accounts: [
                { provider: "zalo_oa", operations: { [SEND]: "auto" } },
                { provider: "telegram", operations: { [SEND]: "auto" } },
                { provider: "zalo_oa", operations: { [SEND]: "auto" } },
            ],
        }
        expect(subject.providers(node).map((wanted) => [wanted.provider, wanted.position])).toEqual([
            ["zalo_oa", 0],
            ["telegram", 1],
        ])
        expect(subject.bind(["zalo_oa", "telegram", "zalo_oa"], [telegram("t1"), zalo("z1")], NO_DEFAULT)).toEqual([
            zalo("z1"),
            telegram("t1"),
        ])
    })
})

describe("positionedOf", () => {
    it("places each record by its workflow's node and its account's provider; one it cannot place, or placed first, is left as it is", async () => {
        const { positioned } = await build()
        const graphs = new Map([["w1", { nodes: [sendV2] }]])
        const records = [
            { workflowId: "w1", nodeKey: "say", connectionId: "t1" },
            { workflowId: "w1", nodeKey: "say", connectionId: "z1" },
            { workflowId: "w2", nodeKey: "say", connectionId: "t1", position: 3 },
            { workflowId: "w1", nodeKey: "say", connectionId: "unknown" },
        ]
        const placed = positioned(records, (id) => graphs.get(id), [telegram("t1"), zalo("z1")])
        expect(placed.map((record) => record.position)).toEqual([1, undefined, 3, undefined])
    })
})
