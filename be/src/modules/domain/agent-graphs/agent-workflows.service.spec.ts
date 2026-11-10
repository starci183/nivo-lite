import { Test } from "@nestjs/testing"
import { workflowDoubles } from "@tests/fixtures/builders/agent-workflows.builder"
import type { WorkflowDoubles } from "@tests/fixtures/builders/agent-workflows.builder"
import { AgentWorkflowAdoptionService } from "./agent-workflow-adoption.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { AgentWorkflowStoreService } from "./agent-workflow-store.service"
import { AgentWorkflowsService } from "./agent-workflows.service"
import { workflowRecordOf, workflowVersionRecordOf } from "./agent-workflows.mapper"
import type { WorkflowRecord, WorkflowVersionRecord } from "./agent-workflows.contracts"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import {
    ownerEdited,
    shopAccountingGraph,
    templateGraph,
    templateNewest,
} from "@tests/fixtures/builders/agent-workflows.builder"
import { jsonOf } from "./agent-graphs.mapper"
import type { WorkflowView } from "./agent-workflows.contracts"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { workflowNotFound } from "./policies/workflow-view.policy"

/** The workflow services on the doubles, and what the memory engine holds. */
interface World extends WorkflowDoubles {
    readonly workflows: AgentWorkflowsService
    readonly adoption: AgentWorkflowAdoptionService
    readonly runs: AgentWorkflowRunsService
    readonly store: AgentWorkflowStoreService
}

const buildWorld = async (): Promise<World> => {
    const doubles = workflowDoubles([
        AgentWorkflowsService,
        AgentWorkflowAdoptionService,
        AgentWorkflowRunsService,
        AgentWorkflowStoreService,
        AgentWorkflowRecordsService,
    ])
    const moduleRef = await Test.createTestingModule({ providers: [...doubles.providers] }).compile()
    return {
        ...doubles,
        workflows: moduleRef.get(AgentWorkflowsService),
        adoption: moduleRef.get(AgentWorkflowAdoptionService),
        runs: moduleRef.get(AgentWorkflowRunsService),
        store: moduleRef.get(AgentWorkflowStoreService),
    }
}

const workflowsOf = (world: World): ReadonlyArray<WorkflowRecord> =>
    world.memory.rows("agent.workflow").map(workflowRecordOf)

const versionsOf = (world: World): ReadonlyArray<WorkflowVersionRecord> =>
    world.memory.rows("agent.workflow-version").map(workflowVersionRecordOf)

const OWNER = { kind: "owner" as const, memberId: "member-1" }

/** The newest version of the reconcile template: the only one the catalogue ships, so the shop's workflow came from it. */
const NEWEST = templateNewest("accounting.reconcile")

const stepOf = (graph: GraphSpec, at: number) => graph.nodes.at(at)

const primaryOf = async (world: World): Promise<WorkflowView> => {
    const primary = (await world.workflows.list("ws-1", "agent-1", "vi")).find((workflow) => workflow.primary)
    if (primary === undefined) throw workflowNotFound()
    return primary
}

const reportsOf = (world: World): Promise<WorkflowView> =>
    world.workflows.createFromTemplate(
        "ws-1",
        "agent-1",
        { templateId: "accounting.reports", version: null },
        OWNER,
        "vi",
    )

describe("AgentWorkflowsService: a workflow from a template", () => {
    it("copies the template graph as version 1 of a new draft workflow and keeps only the provenance", async () => {
        const world = await buildWorld()

        const made = await reportsOf(world)
        const [version] = versionsOf(world)

        expect(made).toMatchObject({ status: "draft", primary: false, activeNumber: 1, templateChangedSteps: 0 })
        expect(made.template).toEqual({
            templateId: "accounting.reports",
            templateVersion: templateNewest("accounting.reports"),
        })
        expect(version?.document).toEqual(jsonOf(templateGraph("accounting.reports")))
        expect(version).toMatchObject({ changeKind: "template", authorKind: "owner", authorId: "member-1" })
    })

    it("makes a blank workflow of one step from a name, and keeps keys unique", async () => {
        const world = await buildWorld()
        const blank = { name: "Chi phi", moduleKey: "accounting" }

        const first = await world.workflows.createBlank("ws-1", "agent-1", blank, OWNER, "vi")
        const second = await world.workflows.createBlank("ws-1", "agent-1", blank, OWNER, "vi")

        expect([first.key, second.key]).toEqual(["chi-phi", "chi-phi-2"])
        expect(first).toMatchObject({ template: null, stepCount: 1, templateChangedSteps: null })
    })

    it("seeds the primary workflow and a workflow per other template of the module, once", async () => {
        const world = await buildWorld()

        await expect(world.workflows.seedAgent("ws-1", "agent-1", "accounting")).resolves.toBe(2)
        await expect(world.workflows.seedAgent("ws-1", "agent-1", "accounting")).resolves.toBe(0)
        expect(workflowsOf(world).map((workflow) => [workflow.key, workflow.status])).toEqual([
            ["reconcile", "active"],
            ["reports", "active"],
            ["team-chat", "active"],
        ])
    })

    it("turns on each template that ships seedActive, and copies no template of the primary workflow", async () => {
        const world = await buildWorld()

        await world.workflows.seedAgent("ws-1", "agent-1", "sales")

        const status = new Map(workflowsOf(world).map((workflow) => [workflow.key, workflow.status]))
        for (const key of ["after-sale", "delivery-check", "occasion", "payment-reminder", "web-order"]) {
            expect(status.get(key)).toBe("active")
        }
        expect(status.get("consult")).toBeUndefined()
        expect(status.get("reconcile")).toBe("active")
    })
})

describe("AgentWorkflowsService: a template version to accept", () => {
    it("refuses to preview or accept a template version that is not newer than the one the workflow came from, and writes nothing", async () => {
        const world = await buildWorld()
        const primary = await primaryOf(world)

        expect(primary.template).toEqual({ templateId: "accounting.reconcile", templateVersion: NEWEST })
        await expect(world.workflows.templatePreview("ws-1", primary.id, NEWEST, "vi")).rejects.toMatchObject({
            code: AgentGraphsErrorCode.WorkflowRefused,
            params: { reason: "template-version" },
        })
        await expect(world.workflows.acceptTemplate("ws-1", primary.id, NEWEST, OWNER, null, "")).rejects.toMatchObject(
            {
                code: AgentGraphsErrorCode.WorkflowRefused,
                params: { reason: "template-version" },
            },
        )
        expect(versionsOf(world)).toHaveLength(1)
    })

    it("refuses a newer version the catalogue does not hold, and a workflow that came from no template", async () => {
        const world = await buildWorld()
        const primary = await primaryOf(world)
        const blank = await world.workflows.createBlank(
            "ws-1",
            "agent-1",
            { name: "Chi phi", moduleKey: "accounting" },
            OWNER,
            "vi",
        )

        await expect(
            world.workflows.acceptTemplate("ws-1", primary.id, NEWEST + 1, OWNER, null, ""),
        ).rejects.toMatchObject({ code: AgentGraphsErrorCode.TemplateNotFound })
        await expect(world.workflows.templatePreview("ws-1", blank.id, NEWEST, "vi")).rejects.toMatchObject({
            code: AgentGraphsErrorCode.WorkflowRefused,
            params: { reason: "no-template" },
        })
        expect(versionsOf(world).filter((version) => version.workflowId === primary.id)).toHaveLength(1)
    })
})

describe("AgentWorkflowsService: history", () => {
    it("rolls back by writing a new version that copies the old snapshot", async () => {
        const world = await buildWorld()
        const made = await reportsOf(world)
        const edited = ownerEdited(templateGraph("accounting.reports"))
        await world.workflows.publish("ws-1", made.id, edited, OWNER, 1, "tighter")

        const back = await world.workflows.rollback("ws-1", made.id, 1, OWNER, 2, "")
        const own = versionsOf(world).filter((version) => version.workflowId === made.id)

        expect(back).toMatchObject({ number: 3, changeKind: "rollback", fromNumber: 1, active: true })
        expect(own.find((version) => version.number === 3)?.document).toEqual(
            own.find((version) => version.number === 1)?.document,
        )
        expect(own).toHaveLength(3)
    })

    it("refuses a publish when someone published after the caller read the history", async () => {
        const world = await buildWorld()
        const made = await reportsOf(world)

        await expect(
            world.workflows.publish("ws-1", made.id, templateGraph("accounting.reports"), OWNER, 0, ""),
        ).rejects.toMatchObject({ code: AgentGraphsErrorCode.WorkflowConflict })
    })

    it("diffs a version against the one before it and against its template version", async () => {
        const world = await buildWorld()
        const primary = await primaryOf(world)

        const previous = await world.workflows.versionDiff("ws-1", primary.id, 1, { kind: "previous" })
        const template = await world.workflows.versionDiff("ws-1", primary.id, 1, { kind: "template", version: null })

        expect(previous.before).toBeNull()
        expect(template.diff.steps).toEqual([
            expect.objectContaining({ key: stepOf(shopAccountingGraph(), -1)?.key, change: "changed" }),
        ])
    })

    it("publishes a primary workflow's version as the agent graph's next version", async () => {
        const world = await buildWorld()
        const primary = await primaryOf(world)
        // The reconcile graph ends in a hand-off to the after-sale workflow, which must be there for the publish to be sound.
        await madeFrom(world, "sales.after-sale")

        await world.workflows.publish("ws-1", primary.id, templateGraph("accounting.reconcile"), OWNER, 1, "")

        expect(world.graphs.publish).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "edit", memberId: "member-1" }),
        )
        expect(versionsOf(world).at(-1)?.graphVersionId).toBe("graph-v2")
    })

    it("keeps the primary workflow active and lets a draft go active", async () => {
        const world = await buildWorld()
        const primary = await primaryOf(world)
        const reports = await reportsOf(world)

        await expect(world.workflows.setStatus("ws-1", primary.id, "paused")).rejects.toMatchObject({
            code: AgentGraphsErrorCode.WorkflowRefused,
        })
        await world.workflows.setStatus("ws-1", reports.id, "active")
        expect(workflowsOf(world).find((workflow) => workflow.id === reports.id)?.status).toBe("active")
    })
})

/** A workflow of the template for agent-1 and the graph the template ships. */
const madeFrom = (world: World, templateId: string): Promise<WorkflowView> =>
    world.workflows.createFromTemplate("ws-1", "agent-1", { templateId, version: null }, OWNER, "vi")

/** What a refused publish said: its code and its words, or null when the publish was not refused with a domain error. */
const refusalOf = async (work: Promise<unknown>): Promise<Record<string, string> | null> => {
    const cause: unknown = await work.then(
        () => null,
        (failure: unknown) => failure,
    )
    return cause instanceof AgentGraphsError ? { ...cause.params, code: cause.code } : null
}

describe("AgentWorkflowsService: publishing a hand-off", () => {
    it("refuses a version whose hand-off calls a workflow the workspace does not have", async () => {
        const world = await buildWorld()
        const desk = await madeFrom(world, "chatbot.front-desk")

        const refusal = await refusalOf(
            world.workflows.publish("ws-1", desk.id, templateGraph("chatbot.front-desk"), OWNER, 1, ""),
        )

        expect(refusal?.code).toBe(AgentGraphsErrorCode.ContractRefused)
        expect(refusal?.problems).toContain("CALL_TARGET_UNKNOWN")
        expect(versionsOf(world).filter((version) => version.workflowId === desk.id)).toHaveLength(1)
    })

    it("publishes it once the workflow it calls is there", async () => {
        const world = await buildWorld()
        const desk = await madeFrom(world, "chatbot.front-desk")
        await madeFrom(world, "sales.consult")
        await madeFrom(world, "accounting.reconcile")

        const published = await world.workflows.publish(
            "ws-1",
            desk.id,
            templateGraph("chatbot.front-desk"),
            OWNER,
            1,
            "",
        )

        expect(published).toMatchObject({ number: 2, changeKind: "edit" })
    })

    it("refuses a new version of the target that would break a caller of it as latest, and names the caller", async () => {
        const world = await buildWorld()
        const desk = await madeFrom(world, "chatbot.front-desk")
        const consult = await madeFrom(world, "sales.consult")
        await madeFrom(world, "accounting.reconcile")
        const demanding = templateGraph("sales.consult")
        const widened: GraphSpec = {
            ...demanding,
            contract: {
                inputs: [...(demanding.contract?.inputs ?? []), { name: "voucher", type: "string", required: true }],
            },
        }

        const refusal = await refusalOf(world.workflows.publish("ws-1", consult.id, widened, OWNER, 1, ""))

        expect(refusal?.code).toBe(AgentGraphsErrorCode.ContractRefused)
        expect(refusal?.problems).toContain("CALL_INPUT_MISSING")
        expect(refusal?.first).toContain(`"${desk.name}"`)
        expect(versionsOf(world).filter((version) => version.workflowId === consult.id)).toHaveLength(1)
    })

    it("publishes a target version that keeps the contract its callers map", async () => {
        const world = await buildWorld()
        await madeFrom(world, "chatbot.front-desk")
        const consult = await madeFrom(world, "sales.consult")
        await madeFrom(world, "accounting.reconcile")

        await expect(
            world.workflows.publish("ws-1", consult.id, templateGraph("sales.consult"), OWNER, 1, ""),
        ).resolves.toMatchObject({ number: 2 })
    })
})

describe("AgentWorkflowsService.graphOf: the agent's Graph page", () => {
    it("draws each workflow of the agent with its contract and triggers, and names the workflow each hand-off calls", async () => {
        const world = await buildWorld()
        await madeFrom(world, "chatbot.front-desk")
        const consult = await madeFrom(world, "sales.consult")

        const graph = await world.workflows.graphOf("ws-1", "agent-1", "en")
        const desk = graph.workflows.find((workflow) => workflow.key === "front-desk")
        const called = graph.workflows.find((workflow) => workflow.id === consult.id)

        expect(graph.agentId).toBe("agent-1")
        expect(desk?.triggers.map((trigger) => trigger.sourceKind)).toEqual(["zalo", "telegram"])
        expect(desk?.inputs.map((input) => input.name)).toContain("conversationId")
        const toConsult = desk?.calls.find((call) => call.agent === "sales" && call.workflow === "consult")
        expect(toConsult).toMatchObject({ workflowName: consult.name })
        expect(called).toMatchObject({ entry: "any", activeNumber: 1 })
        expect(called?.triggers.map((trigger) => trigger.sourceKind)).toEqual(["workflow"])
    })

    it("adopts the running agent graph first, so the primary workflow is on the page", async () => {
        const world = await buildWorld()

        const graph = await world.workflows.graphOf("ws-1", "agent-1", "vi")

        expect(graph.workflows.map((workflow) => [workflow.key, workflow.primary])).toEqual([["reconcile", true]])
        expect(world.graphs.stateOfAgent).toHaveBeenCalled()
    })

    it("lists only the workflows of the agent asked for", async () => {
        const world = await buildWorld()
        await madeFrom(world, "chatbot.front-desk")

        const graph = await world.workflows.graphOf("ws-1", "agent-2", "en")

        expect(graph.workflows.find((workflow) => workflow.key === "front-desk")).toBeUndefined()
    })
})
