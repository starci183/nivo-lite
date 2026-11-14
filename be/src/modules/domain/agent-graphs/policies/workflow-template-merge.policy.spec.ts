import { templateGraph, templateNewest } from "@tests/fixtures/builders/agent-workflows.builder"
import type { WorkflowRecord, WorkflowVersionRecord } from "../agent-workflows.contracts"
import { jsonOf } from "../agent-graphs.mapper"
import { AgentGraphsErrorCode } from "../errors/agent-graphs.error"
import { storedTemplateCopyOf, templateMergeOf } from "./workflow-template-merge.policy"

const TEMPLATE = "webbooks.invoice"
const NEWEST = templateNewest(TEMPLATE)
/** A template version the shipped template no longer holds (a package that ships only its newest). */
const DROPPED = 0
const AT = new Date("2026-11-13T10:00:00.000Z")

const workflowOf = (templateVersion: number): WorkflowRecord => ({
    id: "wf-1",
    workspaceId: "ws-1",
    fence: "1",
    agentId: "agent-1",
    key: "invoice",
    name: "Hoa don",
    status: "active",
    primary: true,
    position: 0,
    activeVersionId: "v-2",
    latestNumber: 2,
    template: { templateId: TEMPLATE, templateVersion },
    createdBy: null,
    createdAt: AT,
    updatedAt: AT,
})

const versionOf = (number: number, templateVersion: number | null): WorkflowVersionRecord => ({
    id: `v-${String(number)}`,
    workspaceId: "ws-1",
    workflowId: "wf-1",
    agentId: "agent-1",
    number,
    document: jsonOf(templateGraph(TEMPLATE)),
    documentHash: `h${String(number)}`,
    changeKind: number === 1 ? "template" : "edit",
    authorKind: "owner",
    authorId: null,
    note: "",
    template: templateVersion === null ? null : { templateId: TEMPLATE, templateVersion },
    fromNumber: null,
    graphVersionId: null,
    publishedAt: AT,
})

describe("templateMergeOf: an installed copy never needs its template version to still exist", () => {
    it("merges from the workflow's own stored copy when the template dropped the version the workflow came from", () => {
        const versions = [versionOf(1, DROPPED), versionOf(2, DROPPED)]
        const current = templateGraph(TEMPLATE)

        const { merged, link } = templateMergeOf(workflowOf(DROPPED), current, NEWEST, versions)

        expect(link).toEqual({ templateId: TEMPLATE, templateVersion: DROPPED })
        expect(merged.graph.nodes.length).toBeGreaterThan(0)
        expect(storedTemplateCopyOf(workflowOf(DROPPED), versions)).toEqual(current)
    })

    it("refuses with TemplateNotFound only when neither the template nor the workflow holds that version", () => {
        expect(() => templateMergeOf(workflowOf(DROPPED), templateGraph(TEMPLATE), NEWEST, [versionOf(1, null)])).toThrow(
            expect.objectContaining({ code: AgentGraphsErrorCode.TemplateNotFound }),
        )
    })
})
