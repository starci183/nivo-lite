import { Test } from "@nestjs/testing"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { latestTemplateVersion } from "@nivo-lite/blocks-core/modules"
import { ownerEdited } from "@tests/fixtures/builders/agent-workflows.builder"
import type { WorkflowRecord, WorkflowVersionRecord } from "../agent-workflows.contracts"
import { jsonOf } from "../agent-graphs.mapper"
import { AgentGraphsError, AgentGraphsErrorCode } from "../errors/agent-graphs.error"
import {
    adoptedAuthorOf,
    adoptedKindOf,
    againstGraphOf,
    diffAgainstOf,
    graphKindOf,
    snapshotOf,
    templateGraphOf,
    templateRequired,
    workflowHistoryOf,
    workflowLocaleOf,
    workflowStatusOf,
    workflowViewOf,
} from "./workflow-view.policy"

const SUBJECT = Symbol("workflow-view.policy")

interface Policies {
    readonly adoptedAuthorOf: typeof adoptedAuthorOf
    readonly adoptedKindOf: typeof adoptedKindOf
    readonly againstGraphOf: typeof againstGraphOf
    readonly diffAgainstOf: typeof diffAgainstOf
    readonly graphKindOf: typeof graphKindOf
    readonly snapshotOf: typeof snapshotOf
    readonly workflowHistoryOf: typeof workflowHistoryOf
    readonly workflowLocaleOf: typeof workflowLocaleOf
    readonly workflowStatusOf: typeof workflowStatusOf
    readonly workflowViewOf: typeof workflowViewOf
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    adoptedAuthorOf,
                    adoptedKindOf,
                    againstGraphOf,
                    diffAgainstOf,
                    graphKindOf,
                    snapshotOf,
                    workflowHistoryOf,
                    workflowLocaleOf,
                    workflowStatusOf,
                    workflowViewOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Policies>(SUBJECT)
}

const RECONCILE = templateRequired("accounting.reconcile")

/** The newest version of the template (the one the workflow came from), its graph, and that graph with the owner's one change. */
const NEWEST = latestTemplateVersion(RECONCILE).version
const SHIPPED = templateGraphOf(RECONCILE, NEWEST)
const EDITED = ownerEdited(SHIPPED)

const WORKFLOW: WorkflowRecord = {
    id: "wf-1",
    workspaceId: "ws-1",
    fence: "2",
    agentId: "agent-1",
    key: "reconcile",
    name: "Reconcile",
    status: "active",
    primary: true,
    position: 0,
    activeVersionId: "v-2",
    latestNumber: 2,
    template: { templateId: "accounting.reconcile", templateVersion: NEWEST },
    createdBy: null,
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    updatedAt: new Date("2026-11-02T00:00:00.000Z"),
}

const versionOf = (id: string, number: number, graph: GraphSpec): WorkflowVersionRecord => ({
    id,
    workspaceId: "ws-1",
    workflowId: "wf-1",
    agentId: "agent-1",
    number,
    document: jsonOf(graph),
    documentHash: "h",
    changeKind: number === 1 ? "adopt" : "edit",
    authorKind: "owner",
    authorId: "member-1",
    note: "",
    template: { templateId: "accounting.reconcile", templateVersion: NEWEST },
    fromNumber: null,
    graphVersionId: null,
    publishedAt: new Date("2026-11-09T02:00:00.000Z"),
})

/** The workflow was adopted as the template shipped it, then the owner changed one step. */
const HISTORY = [versionOf("v-2", 2, EDITED), versionOf("v-1", 1, SHIPPED)]

/** The code a call refused with, or null when it did not refuse. */
const codeOf = (work: () => unknown): string | null => {
    try {
        work()
        return null
    } catch (cause) {
        return cause instanceof AgentGraphsError ? cause.code : null
    }
}

describe("workflow views", () => {
    it("reads a workflow with what runs and how far it is from the template version it came from", async () => {
        const subject = await build()

        expect(subject.workflowViewOf(WORKFLOW, HISTORY[0] ?? null, "en")).toMatchObject({
            activeNumber: 2,
            templateName: RECONCILE.name.en,
            templateLatest: NEWEST,
            templateChangedSteps: 1,
            updatedAt: "2026-11-02T00:00:00.000Z",
        })
        expect(subject.workflowViewOf({ ...WORKFLOW, template: null }, null, "vi")).toMatchObject({
            activeNumber: null,
            templateChangedSteps: null,
            stepCount: 0,
        })
    })

    it("reads the history newest first, each version against the one before it", async () => {
        const subject = await build()

        expect(
            subject
                .workflowHistoryOf(HISTORY, "v-2")
                .map((version) => [version.number, version.changedSteps, version.active]),
        ).toEqual([
            [2, 1, true],
            [1, null, false],
        ])
    })

    it("refuses a stored snapshot that is not a graph", async () => {
        const subject = await build()
        const broken = { ...versionOf("v-9", 9, SHIPPED), document: { nodes: "none" } }

        expect(codeOf(() => subject.snapshotOf(broken))).toBe(AgentGraphsErrorCode.DocumentInvalid)
    })
})

describe("workflow diffs and requests", () => {
    it("compares a version with the one before it, another version or a template version", async () => {
        const subject = await build()
        const [newest, first] = HISTORY

        if (newest === undefined || first === undefined)
            throw new AgentGraphsError({ code: AgentGraphsErrorCode.WorkflowNotFound })
        expect(subject.againstGraphOf(WORKFLOW, HISTORY, first, { kind: "previous" })).toBeNull()
        expect(subject.againstGraphOf(WORKFLOW, HISTORY, newest, { kind: "version", number: 1 })?.nodes.length).toBe(
            SHIPPED.nodes.length,
        )
        expect(subject.againstGraphOf(WORKFLOW, HISTORY, newest, { kind: "template", version: null })).toEqual(SHIPPED)
        expect(subject.againstGraphOf(WORKFLOW, HISTORY, newest, { kind: "template", version: NEWEST })).toEqual(SHIPPED)
        // A template version the catalogue does not hold is refused, never guessed.
        expect(
            codeOf(() => subject.againstGraphOf(WORKFLOW, HISTORY, newest, { kind: "template", version: NEWEST + 1 })),
        ).toBe(AgentGraphsErrorCode.TemplateNotFound)
        expect(codeOf(() => subject.againstGraphOf(WORKFLOW, HISTORY, newest, { kind: "version", number: 7 }))).toBe(
            AgentGraphsErrorCode.WorkflowNotFound,
        )
    })

    it("reads the comparison, the status and the language a request names", async () => {
        const subject = await build()

        expect(subject.diffAgainstOf("template", null)).toEqual({ kind: "template", version: null })
        expect(subject.diffAgainstOf("version", 2)).toEqual({ kind: "version", number: 2 })
        expect(subject.diffAgainstOf("anything", null)).toEqual({ kind: "previous" })
        expect(codeOf(() => subject.diffAgainstOf("version", null))).toBe(AgentGraphsErrorCode.WorkflowRefused)
        expect([
            subject.workflowStatusOf("active"),
            subject.workflowStatusOf("paused"),
            subject.workflowStatusOf("x"),
        ]).toEqual(["active", "paused", "draft"])
        expect([subject.workflowLocaleOf("en"), subject.workflowLocaleOf(null)]).toEqual(["en", "vi"])
    })
})

describe("adopting agent graph versions", () => {
    it("maps the kind and the author of an adopted agent graph version, and the kind a workflow version publishes as", async () => {
        const subject = await build()
        const view = {
            id: "g-1",
            version: 1,
            changeKind: "learned" as const,
            note: "",
            publishedAt: "",
            publishedBy: null,
        }

        expect(subject.adoptedKindOf("spec", true)).toBe("adopt")
        expect(subject.adoptedKindOf("learned", false)).toBe("proposal")
        expect(subject.adoptedKindOf("chat", false)).toBe("edit")
        expect(subject.adoptedKindOf("seed", false)).toBe("adopt")
        expect(subject.adoptedAuthorOf(view)).toEqual({ kind: "nivo", memberId: null })
        expect(subject.adoptedAuthorOf({ ...view, changeKind: "edit", publishedBy: "m-1" })).toEqual({
            kind: "owner",
            memberId: "m-1",
        })
        expect(subject.adoptedAuthorOf({ ...view, changeKind: "spec" })).toEqual({ kind: "system", memberId: null })
        expect([
            subject.graphKindOf("edit"),
            subject.graphKindOf("proposal"),
            subject.graphKindOf("accept_template"),
            subject.graphKindOf("copy"),
        ]).toEqual(["edit", "learned", "template", "spec"])
    })
})
