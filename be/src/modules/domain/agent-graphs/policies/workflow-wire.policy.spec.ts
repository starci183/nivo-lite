import { Test } from "@nestjs/testing"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { latestTemplateVersion } from "@nivo-lite/agent-sdk/template"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { WorkflowView } from "../agent-workflows.contracts"
import { workflowDiffOf } from "./workflow-diff.policy"
import { withOlderVersion } from "@tests/fixtures/builders/workflow-catalogue.builder"
import { templateRequired } from "./workflow-view.policy"
import { templateWireOf, workflowDetailWireOf, workflowDiffWireOf, workflowWireOf } from "./workflow-wire.policy"

const SUBJECT = Symbol("workflow-wire.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { templateWireOf, workflowDetailWireOf, workflowDiffWireOf, workflowWireOf },
            },
        ],
    }).compile()
    return moduleRef.get<{
        templateWireOf: typeof templateWireOf
        workflowDetailWireOf: typeof workflowDetailWireOf
        workflowDiffWireOf: typeof workflowDiffWireOf
        workflowWireOf: typeof workflowWireOf
    }>(SUBJECT)
}

const graph = (tolerance: number): GraphSpec => ({
    schema: "nivo/agent-graph@1",
    moduleKey: "accounting",
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { tools: [], effects: [] },
    nodes: [{ key: "match", kind: "condition", step: "accounting.match", params: { toleranceVnd: tolerance } }],
})

/** The newest version of the consult template: the one a workflow made from it today came from. */
const NEWEST = latestTemplateVersion(templateRequired("sales.consult")).version

const VIEW: WorkflowView = {
    id: "wf-1",
    agentId: "agent-1",
    key: "consult",
    name: "Consult",
    status: "active",
    primary: true,
    activeNumber: 2,
    latestNumber: 2,
    template: { templateId: "sales.consult", templateVersion: NEWEST },
    templateName: "Consult",
    templateLatest: NEWEST,
    templateChangedSteps: 1,
    stepCount: 1,
    updatedAt: "2026-11-09T02:00:00.000Z",
}

describe("workflow wires", () => {
    it("flattens the template link of a workflow", async () => {
        const subject = await build()

        expect(subject.workflowWireOf(VIEW)).toMatchObject({
            templateId: "sales.consult",
            templateVersion: NEWEST,
        })
        expect(subject.workflowWireOf({ ...VIEW, template: null })).toMatchObject({
            templateId: null,
            templateVersion: null,
        })
    })

    it("sends a changed setting as JSON text with both graphs", async () => {
        const subject = await build()
        const diff = workflowDiffOf(graph(0), graph(1000))

        const wire = subject.workflowDiffWireOf({ before: graph(0), after: graph(1000), diff })

        expect(wire.steps[0]?.params).toEqual([{ name: "toleranceVnd", beforeJson: "0", afterJson: "1000" }])
        expect(wire.afterJson).toBe(JSON.stringify(graph(1000)))
        expect(wire.beforeJson).toBe(JSON.stringify(graph(0)))
    })

    it("diffs a detail against the template version it came from", async () => {
        const subject = await build()
        const detail = { workflow: VIEW, graph: graph(5), versions: [], templateDiff: workflowDiffOf(null, graph(5)) }

        const wire = subject.workflowDetailWireOf(detail)

        expect(wire.graphJson).toBe(JSON.stringify(graph(5)))
        expect(wire.templateDiff?.beforeJson).not.toBeNull()
        expect(subject.workflowDetailWireOf({ ...detail, templateDiff: null }).templateDiff).toBeNull()
    })

    it("reads a template in the reader's language with its versions and newest graph", async () => {
        const subject = await build()
        // A template with two versions, as a catalogue that still held the one before its newest.
        const template = withOlderVersion(templateRequired("sales.consult"))

        const wire = subject.templateWireOf(template, "en")

        const newest = latestTemplateVersion(template)

        expect(wire).toMatchObject({ name: template.name.en, latestVersion: newest.version, shops: template.shops })
        expect(wire.versions.map((version) => version.version)).toEqual([newest.version - 1, newest.version])
        // `requires` is DERIVED from the providers the graph's nodes ask accounts of (contract ADDENDUM 2, 1.: never typed), NIVO's own
        // `nivo` aside: the consult graph asks the three messaging providers (its customer lines) and SePay (the transfer QR).
        // Ledger (E-RED 2026-11-14): the one sale graph also reads the paying credit in its pay loop (`sales.credit-read`, which asks an
        // account of every bank feed: SePay, Casso, payOS), so the three feeds are required beside the messaging providers.
        expect(wire.requires.map((entry) => entry.kind).sort()).toEqual(["casso", "meta", "payos", "sepay", "telegram", "zalo_oa"])
        expect(wire.graphJson).toBe(JSON.stringify(newest.graph))
    })
})

describe("workflow wires: the operations a diff's nodes gained, lost or loosened carry their declared titles", () => {
    /** The title a step's installed node declares, as the door's titles service answers it. */
    const stepTitleOf = (step: string) => {
        // The declared title of the step, whichever form declares it (the one installed-step view).
        const title = INSTALLED.stepOf(step)?.title
        return title === undefined || "key" in title ? null : { vi: title.vi, en: title.en }
    }
    const installed = templateRequired("sales.consult").versions.find((version) => version.version === NEWEST)?.graph
    // A template graph's accounts carry no operations (the step's ONE mode is the node's own member): the consult graph as a graph that
    // still states operations reads them, the customer send on the order message's accounts, so what a diff gains has entries to title.
    const newest =
        installed === undefined
            ? undefined
            : {
                  ...installed,
                  nodes: installed.nodes.map((node) =>
                      node.key !== "tell-order" || node.accounts === undefined
                          ? node
                          : {
                                ...node,
                                accounts: node.accounts.map((account) => ({
                                    ...account,
                                    operations: { "nivo.tool.customer.message.send": "auto" as const },
                                })),
                            },
                  ),
              }
    /** The newest consult graph with every node asking for nothing on any account: what its nodes ask for is all gained. */
    const older =
        newest === undefined
            ? undefined
            : {
                  ...newest,
                  nodes: newest.nodes.map((node) => (node.accounts === undefined ? node : { ...node, accounts: [] })),
              }

    it("names each gained operation by the title of its step and the label its plugin gives the tool, never by a key or an id", async () => {
        const subject = await build()
        if (newest === undefined || older === undefined)
            throw new TypeError("the consult template has a newest version")
        const diff = workflowDiffOf(older, newest)

        const wire = subject.workflowDiffWireOf({ before: older, after: newest, diff }, stepTitleOf)

        expect(wire.nodeRightsAdded.length).toBeGreaterThan(0)
        for (const row of wire.nodeRightsAdded) {
            const step = newest.nodes.find((node) => node.key === row.nodeKey)?.step ?? ""
            expect(row.stepTitle).toEqual(stepTitleOf(step))
            expect(row.stepTitle).not.toBeNull()
            expect(row.operationTitle).toEqual(INSTALLED.toolLabelOf(row.operation)?.title ?? null)
        }
        // The same entries read backwards are lost: their step is read in the graph that still holds the node.
        const back = subject.workflowDiffWireOf(
            { before: newest, after: older, diff: workflowDiffOf(newest, older) },
            stepTitleOf,
        )
        expect(back.nodeRightsRemoved.map((row) => row.stepTitle)).toEqual(
            wire.nodeRightsAdded.map((row) => row.stepTitle),
        )
    })

    it("names an operation by its plugin's label only: the old `send_email` work action and an unknown tool get no title", async () => {
        const subject = await build()
        const mail = { kind: "mail", provider: null, connectionId: null, operations: { send_email: "ask" as const } }
        const other = {
            kind: "mail",
            provider: null,
            connectionId: null,
            operations: { "no.such.tool": "ask" as const },
        }
        const added = { key: "tell", kind: "execute" as const, step: "gone.step", accounts: [mail, other] }
        const after: GraphSpec = { ...graph(0), nodes: [...graph(0).nodes, added] }

        const wire = subject.workflowDiffWireOf({ before: graph(0), after, diff: workflowDiffOf(graph(0), after) })

        expect(wire.nodeRightsAdded.map((row) => [row.operation, row.operationTitle, row.stepTitle])).toEqual([
            ["send_email", null, null],
            ["no.such.tool", null, null],
        ])
    })
})
