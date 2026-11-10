import { Test } from "@nestjs/testing"
import { latestTemplateVersion } from "@nivo-lite/blocks-core/modules"
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
    grant: { rights: [], tools: [], effects: [] },
    nodes: [{ key: "match", kind: "condition", step: "accounting.match", params: { toleranceVnd: tolerance } }],
})

/** The newest version of the reconcile template: the one a workflow made from it today came from. */
const NEWEST = latestTemplateVersion(templateRequired("accounting.reconcile")).version

const VIEW: WorkflowView = {
    id: "wf-1",
    agentId: "agent-1",
    key: "reconcile",
    name: "Reconcile",
    status: "active",
    primary: true,
    activeNumber: 2,
    latestNumber: 2,
    template: { templateId: "accounting.reconcile", templateVersion: NEWEST },
    templateName: "Reconcile",
    templateLatest: NEWEST,
    templateChangedSteps: 1,
    stepCount: 1,
    updatedAt: "2026-11-09T02:00:00.000Z",
}

describe("workflow wires", () => {
    it("flattens the template link of a workflow", async () => {
        const subject = await build()

        expect(subject.workflowWireOf(VIEW)).toMatchObject({
            templateId: "accounting.reconcile",
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
        const template = withOlderVersion(templateRequired("accounting.reconcile"))

        const wire = subject.templateWireOf(template, "en")

        const newest = latestTemplateVersion(template)

        expect(wire).toMatchObject({ name: template.name.en, latestVersion: newest.version, shops: template.shops })
        expect(wire.versions.map((version) => version.version)).toEqual([newest.version - 1, newest.version])
        expect(wire.requires.map((entry) => entry.kind)).toEqual(["sepay", "google"])
        expect(wire.graphJson).toBe(JSON.stringify(newest.graph))
    })
})
