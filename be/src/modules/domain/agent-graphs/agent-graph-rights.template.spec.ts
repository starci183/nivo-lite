import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { INSTALLED } from "@modules/domain/installed-plugins"
import type { ProviderAttachmentView } from "@modules/domain/tool-grants"
import { rightsParamsOf, rightsWorldOf } from "@tests/fixtures/builders/agent-rights.builder"
import { templateGraph } from "@tests/fixtures/builders/agent-workflows.builder"

/**
 * A REAL template graph (the engine's graph the adapter reads a `@2` graph as, its nodes' accounts carried) through the activation seam
 * (nivo-frame `rights`): the publish GATE is removed, so a version that lists MORE providers than the one before it (the send on a
 * messaging account) is refused for no one and settles no grant row: the step's mode is declared in the version, the attachments say
 * which accounts the agent may act on.
 */

const CONSULT = templateGraph("sales.consult")

/** True for a node whose template node declares the customer send (its `tools`): the node's providers serve it. */
const sends = (step: string): boolean => INSTALLED.templateNodeOf(step)?.tools.includes(TOOL.customerMessageSend) === true

/** The consult graph whose customer lines list no messaging provider: an older version that listed less. */
const narrowed: GraphSpec = {
    ...CONSULT,
    nodes: CONSULT.nodes.map((node) =>
        node.accounts === undefined
            ? node
            : { ...node, accounts: sends(node.step) ? node.accounts.filter((entry) => entry.kind !== "messaging") : node.accounts },
    ),
}

const ATTACHED: ReadonlyArray<ProviderAttachmentView> = [
    { agentId: "agent-1", connectionId: "c-zalo", provider: "zalo_oa" },
    { agentId: "agent-1", connectionId: "c-bank", provider: "sepay" },
    { agentId: "agent-1", connectionId: "c-books", provider: "google" },
]

const SENDERS = CONSULT.nodes
    .filter((node) => sends(node.step) && node.accounts?.some((entry) => entry.kind === "messaging") === true)
    .map((node) => node.key)

const question = (role: string) => ({
    workspaceId: "ws-1",
    agentId: "agent-1",
    workflowId: "wf-p",
    before: narrowed,
    after: CONSULT,
    byTemplate: false,
    consent: { memberId: "m-1", role, agreed: [] },
})

describe("activating a template graph's version: no rights gate", () => {
    it("the consult graph's customer lines list a messaging provider for the send", () => {
        expect(SENDERS.length).toBeGreaterThan(0)
    })

    it("a version that lists MORE (the send on the attached Zalo account) is refused for no one and settles no grant row", async () => {
        const world = await rightsWorldOf(ATTACHED)

        for (const role of ["manager", "owner"]) {
            const judged = await world.rights.judge(question(role))
            expect([role, judged.refused, judged.settlement.grants]).toEqual([role, [], []])
            await expect(rightsParamsOf(world.rights.decide(question(role)))).resolves.toBeNull()
        }
        expect(world.consents.listOfWorkflow).not.toHaveBeenCalled()
    })

    it("a version within what the one before listed is refused for no one either", async () => {
        const world = await rightsWorldOf(ATTACHED)

        const judged = await world.rights.judge({ ...question("manager"), after: narrowed })

        expect(judged.refused).toEqual([])
        await expect(rightsParamsOf(world.rights.decide({ ...question("manager"), after: narrowed }))).resolves.toBeNull()
    })
})
