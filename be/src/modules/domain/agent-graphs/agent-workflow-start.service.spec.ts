import { builder, mock } from "@starci/jest-preset"
import { LATEST_VERSION } from "@nivo-lite/agent-sdk/graph"
import type { EntityManager } from "typeorm"
import type { InstallationRecord, InstallationRecordsService } from "@modules/domain/module-installations"
import type { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import type { QueueOutbox } from "@modules/platform/queue"
import { WORKFLOW_START_QUEUE, WorkflowStartJob } from "@modules/queues/workflow-start"
import { AgentWorkflowStartService } from "./agent-workflow-start.service"
import type { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import type { AgentWorkflowsAdminService } from "./agent-workflows-admin.service"
import { WORKFLOW_START_INPUTS_MAX } from "./policies/workflow-start.policy"
import type { WorkflowDetailWire } from "./policies/workflow-wire.policy"

const ACTOR = { workspaceId: "ws-1", principalId: "user-1" }
const REF = { installationId: "inst-1", workflowId: "wf-1" }
const CONTRACT = { inputs: [{ name: "contactId", type: "string", required: true }] }

const installationOf = builder<InstallationRecord>({
    id: "inst-1",
    workspaceId: "ws-1",
    moduleKey: "sales",
    name: "B\u00e1n h\u00e0ng",
    isMulti: false,
    agentId: "agent-1",
    status: "live",
    operatingMode: "autopilot",
    liveEnabled: true,
    activeContextVersionId: null,
    settings: {},
    createdAt: "2026-11-01T00:00:00.000Z",
})

const detailOf = (status: string, graph: Readonly<Record<string, unknown>> = {}): WorkflowDetailWire => ({
    workflow: {
        id: "wf-1",
        key: "after-sale",
        name: "Ch\u0103m s\u00f3c sau b\u00e1n",
        status,
        primary: false,
        activeNumber: 3,
        latestNumber: 3,
        templateId: null,
        templateVersion: null,
        templateName: null,
        templateLatest: null,
        templateChangedSteps: null,
        stepCount: 4,
        updatedAt: "2026-11-13T08:00:00.000Z",
    },
    graphJson: JSON.stringify({
        schema: "nivo/agent-graph@1",
        moduleKey: "sales",
        contract: CONTRACT,
        triggers: [{ key: "called", source: { kind: "workflow", connectionId: null } }],
        ...graph,
    }),
    versions: [],
    templateDiff: null,
})

const build = (detail: WorkflowDetailWire) => {
    const admin = mock<AgentWorkflowsAdminService>()
    const installations = mock<InstallationRecordsService>()
    const seats = mock<WorkspaceMemberSeatsService>()
    const runs = mock<AgentWorkflowRunsService>()
    const outbox = mock<QueueOutbox>()
    const tx = mock<EntityManager>()
    const entityManager = mock<EntityManager>()
    entityManager.transaction.mockImplementation(((work: (manager: EntityManager) => Promise<unknown>) => work(tx)) as never)
    admin.detail.mockResolvedValue(detail)
    installations.find.mockResolvedValue(installationOf())
    seats.activeSeatOfUser.mockResolvedValue({
        memberId: "member-1",
        userId: "user-1",
        role: "owner",
        displayName: "Lan",
        status: "active",
    })
    runs.hiddenTargetOf.mockResolvedValue(null)
    const service = new AgentWorkflowStartService(admin, installations, seats, runs, entityManager, outbox)
    return { service, admin, installations, runs, outbox, tx }
}

describe("AgentWorkflowStartService.runnable: whether a person may start a workflow, and the JSON Schema of its declared input", () => {
    it("reads the workflow through the workflows door (its owner / manager guard) and answers its input schema", async () => {
        const { service, admin } = build(detailOf("active"))

        await expect(service.runnable(ACTOR, { ...REF, locale: "vi" })).resolves.toEqual({
            workflowId: "wf-1",
            key: "after-sale",
            name: "Ch\u0103m s\u00f3c sau b\u00e1n",
            status: "active",
            runnable: true,
            refusal: null,
            inputSchema: {
                type: "object",
                properties: { contactId: { type: "string" } },
                required: ["contactId"],
                additionalProperties: false,
            },
            inputSchemaJson:
                '{"type":"object","properties":{"contactId":{"type":"string"}},"required":["contactId"],"additionalProperties":false}',
        })
        expect(admin.detail).toHaveBeenCalledWith(ACTOR, { ...REF, locale: "vi" })
    })

    it("names why a workflow cannot be started, with no schema", async () => {
        const { service } = build(detailOf("draft"))

        await expect(service.runnable(ACTOR, REF)).resolves.toMatchObject({
            runnable: false,
            refusal: "not_active",
            inputSchema: null,
            inputSchemaJson: null,
        })
    })
})

describe("AgentWorkflowStartService.start: one queued start of the installation's agent pinned to the workflow, once per opKey", () => {
    it("queues ONE job for the api with the agent, the person, the pin's workflow and the inputs, keyed by the person and the opKey", async () => {
        const { service, outbox, tx } = build(detailOf("active"))

        await expect(service.start(ACTOR, { ...REF, inputs: { contactId: "c-1" }, opKey: "op-1" })).resolves.toEqual({
            status: "started",
            refusal: null,
            issues: [],
        })
        expect(outbox.write).toHaveBeenCalledTimes(1)
        expect(outbox.write).toHaveBeenCalledWith(
            tx,
            WORKFLOW_START_QUEUE,
            {
                workspaceId: "ws-1",
                agentId: "agent-1",
                memberId: "member-1",
                workflowKey: "after-sale",
                key: "workflow-run:user-1:op-1",
                inputs: { contactId: "c-1" },
            },
            { job: WorkflowStartJob.Deliver, dedupeKey: "workflow-run:user-1:op-1" },
        )
    })

    it("refuses inputs that break the declared contract before anything is written, naming each issue", async () => {
        const { service, outbox } = build(detailOf("active"))

        await expect(service.start(ACTOR, { ...REF, inputs: { other: 1 }, opKey: "op-1" })).resolves.toEqual({
            status: "refused",
            refusal: "input_invalid",
            issues: [
                { at: "contactId", code: "required" },
                { at: "other", code: "unknown" },
            ],
        })
        expect(outbox.write).not.toHaveBeenCalled()
    })

    it("refuses a workflow that is not runnable, and one readiness hides (a blocking provider not connected), writing nothing", async () => {
        const off = build(detailOf("active", { entry: { openTo: "agent" } }))
        await expect(off.service.start(ACTOR, { ...REF, inputs: { contactId: "c-1" }, opKey: "k" })).resolves.toMatchObject({
            status: "refused",
            refusal: "agent_only",
        })
        expect(off.outbox.write).not.toHaveBeenCalled()

        const hidden = build(detailOf("active"))
        hidden.runs.hiddenTargetOf.mockResolvedValue({ workflow: "after-sale", name: "x", waitingFor: ["zalo_oa"], blocked: [] })
        await expect(hidden.service.start(ACTOR, { ...REF, inputs: { contactId: "c-1" }, opKey: "k" })).resolves.toMatchObject({
            status: "refused",
            refusal: "waiting_for_connection",
        })
        expect(hidden.runs.hiddenTargetOf).toHaveBeenCalledWith("ws-1", "agent-1", {
            workflow: "after-sale",
            version: LATEST_VERSION,
        })
        expect(hidden.outbox.write).not.toHaveBeenCalled()
    })

    it("refuses an installation with no agent, and an inputs object too large for a wake (too_large), writing nothing", async () => {
        const none = build(detailOf("active"))
        none.installations.find.mockResolvedValue(installationOf({ agentId: null }))
        await expect(none.service.start(ACTOR, { ...REF, inputs: { contactId: "c-1" }, opKey: "k" })).resolves.toMatchObject({
            status: "refused",
            refusal: "no_agent",
        })
        expect(none.outbox.write).not.toHaveBeenCalled()

        const big = build(detailOf("active"))
        await expect(
            big.service.start(ACTOR, { ...REF, inputs: { contactId: "x".repeat(WORKFLOW_START_INPUTS_MAX) }, opKey: "k" }),
        ).resolves.toMatchObject({ status: "refused", refusal: "too_large" })
        expect(big.outbox.write).not.toHaveBeenCalled()
    })
})
