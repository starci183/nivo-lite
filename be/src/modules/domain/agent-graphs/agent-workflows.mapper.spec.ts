import { Test } from "@nestjs/testing"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { runWorkflowPinOf, workflowRecordOf, workflowVersionRecordOf } from "./agent-workflows.mapper"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"

const SUBJECT = Symbol("agent-workflows.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { runWorkflowPinOf, workflowRecordOf, workflowVersionRecordOf } }],
    }).compile()
    return moduleRef.get<{
        runWorkflowPinOf: typeof runWorkflowPinOf
        workflowRecordOf: typeof workflowRecordOf
        workflowVersionRecordOf: typeof workflowVersionRecordOf
    }>(SUBJECT)
}

/** The code a call refused with, or null when it did not refuse. */
const codeOf = (work: () => unknown): string | null => {
    try {
        work()
        return null
    } catch (cause) {
        return cause instanceof AgentGraphsError ? cause.code : null
    }
}

const row = (data: RecordRow["data"]): RecordRow => ({
    id: "row-1",
    workspaceId: "ws-1",
    version: "3",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-02T00:00:00.000Z",
    data,
})

const WORKFLOW = {
    agentId: "agent-1",
    key: "reconcile",
    name: "Reconcile",
    status: "active",
    primary: true,
    position: 0,
    activeVersionId: "wfv-1",
    latestNumber: 2,
    templateId: "accounting.reconcile",
    templateVersion: 2,
    createdBy: null,
}

describe("workflowRecordOf", () => {
    it("reads a workflow with its fence and template link", async () => {
        const subject = await build()

        expect(subject.workflowRecordOf(row(WORKFLOW))).toMatchObject({
            id: "row-1",
            fence: "3",
            status: "active",
            primary: true,
            template: { templateId: "accounting.reconcile", templateVersion: 2 },
            updatedAt: new Date("2026-11-02T00:00:00.000Z"),
        })
    })

    it("reads no template link for a workflow made from scratch, and refuses an unknown status", async () => {
        const subject = await build()

        expect(
            subject.workflowRecordOf(row({ ...WORKFLOW, templateId: null, templateVersion: null })).template,
        ).toBeNull()
        expect(codeOf(() => subject.workflowRecordOf(row({ ...WORKFLOW, status: "gone" })))).toBe(
            AgentGraphsErrorCode.RecordUnreadable,
        )
    })
})

describe("workflowVersionRecordOf and runWorkflowPinOf", () => {
    it("reads an immutable snapshot version and a run pin", async () => {
        const subject = await build()
        const version = subject.workflowVersionRecordOf(
            row({
                workflowId: "wf-1",
                agentId: "agent-1",
                number: 3,
                document: { nodes: [] },
                documentHash: "h",
                changeKind: "rollback",
                authorKind: "owner",
                authorId: "member-1",
                note: "",
                templateId: null,
                templateVersion: null,
                fromNumber: 1,
                graphVersionId: null,
                publishedAt: "2026-11-09T02:00:00.000Z",
            }),
        )

        expect(version).toMatchObject({ number: 3, changeKind: "rollback", fromNumber: 1, template: null })
        expect(
            subject.runWorkflowPinOf(
                row({ runId: "run-1", workflowId: "wf-1", workflowVersionId: "wfv-3", workflowVersion: 3 }),
            ),
        ).toEqual({ runId: "run-1", workflowId: "wf-1", workflowVersionId: "wfv-3", workflowVersion: 3 })
    })

    it("refuses a version without a snapshot", async () => {
        const subject = await build()

        expect(codeOf(() => subject.workflowVersionRecordOf(row({ workflowId: "wf-1", document: null })))).toBe(
            AgentGraphsErrorCode.RecordUnreadable,
        )
    })
})
