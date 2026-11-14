import { Test } from "@nestjs/testing"
import { AGENT_WORKFLOWS, AGENT_WORKFLOW_VERSIONS, workflowRecordOfRow, workflowVersionRecordOfRow } from "@tests/fixtures/builders/engine-core-tables.builder"
import { workflowDoubles } from "@tests/fixtures/builders/agent-workflows.builder"
import type { WorkflowDoubles } from "@tests/fixtures/builders/agent-workflows.builder"
import { AgentWorkflowAdoptionService } from "./agent-workflow-adoption.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { AgentWorkflowStoreService } from "./agent-workflow-store.service"
import { AgentWorkflowsService } from "./agent-workflows.service"
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
    world.memory.rows(AGENT_WORKFLOWS).map(workflowRecordOfRow)

const versionsOf = (world: World): ReadonlyArray<WorkflowVersionRecord> =>
    world.memory.rows(AGENT_WORKFLOW_VERSIONS).map(workflowVersionRecordOfRow)

const OWNER = { kind: "owner" as const, memberId: "member-1" }

/** The newest version of the invoice template (`webbooks.invoice`, the primary of `webbooks`): the shop's workflow came from it. */
const NEWEST = templateNewest("webbooks.invoice")

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
        { templateId: "webbooks.debt-round", version: null },
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
            templateId: "webbooks.debt-round",
            templateVersion: templateNewest("webbooks.debt-round"),
        })
        expect(version?.document).toEqual(jsonOf(templateGraph("webbooks.debt-round")))
        expect(version).toMatchObject({ changeKind: "template", authorKind: "owner", authorId: "member-1" })
    })

    it("makes a blank workflow of one step from a name, and keeps keys unique", async () => {
        const world = await buildWorld()
        const blank = { name: "Chi phi", moduleKey: "webbooks" }

        const first = await world.workflows.createBlank("ws-1", "agent-1", blank, OWNER, "vi")
        const second = await world.workflows.createBlank("ws-1", "agent-1", blank, OWNER, "vi")

        expect([first.key, second.key]).toEqual(["chi-phi", "chi-phi-2"])
        expect(first).toMatchObject({ template: null, stepCount: 1, templateChangedSteps: null })
    })

    it("seeds the primary workflow and a workflow per other template of the module, once", async () => {
        const world = await buildWorld()

        // Ledger (TOOLS-LEAD 2026-11-13): `webbooks` ships five templates (the dropped accounting agent shipped three): the primary is adopted
        // and the other four are copied.
        await expect(world.workflows.seedAgent("ws-1", "agent-1", "webbooks")).resolves.toBe(4)
        await expect(world.workflows.seedAgent("ws-1", "agent-1", "webbooks")).resolves.toBe(0)
        expect(workflowsOf(world).map((workflow) => [workflow.key, workflow.status])).toEqual([
            ["invoice", "active"],
            // Only the templates in the seeded chain (`seedActive`: the team chat) start active; the other copies are drafts the owner turns on.
            ["payment", "draft"],
            ["debt-round", "draft"],
            ["supplier-invoices", "draft"],
            ["team-chat", "active"],
        ])
    })

    it("with `only`, copies that one template and adopts nothing: once, never a primary template, the owner's status kept", async () => {
        const world = await buildWorld()

        await expect(world.workflows.seedAgent("ws-1", "agent-1", "sales", "sales.team-chat")).resolves.toBe(1)
        await expect(world.workflows.seedAgent("ws-1", "agent-1", "sales", "sales.consult")).resolves.toBe(0)
        const [made] = workflowsOf(world)
        await world.workflows.setStatus("ws-1", made?.id ?? "", "paused")
        await expect(world.workflows.seedAgent("ws-1", "agent-1", "sales", "sales.team-chat")).resolves.toBe(0)

        expect(workflowsOf(world).map((workflow) => [workflow.key, workflow.status, workflow.primary])).toEqual([
            ["team-chat", "paused", false],
        ])
    })

    it("turns on each template that ships seedActive, and copies no template of the primary workflow", async () => {
        const world = await buildWorld()

        await world.workflows.seedAgent("ws-1", "agent-1", "sales")

        const status = new Map(workflowsOf(world).map((workflow) => [workflow.key, workflow.status]))
        // Ledger (E-RED 2026-11-14): `sales.payment-reminder` is gone: the reminders are the pay loop of the ONE sale graph
        // (`sales.consult`, one run per subject, R47's `remind` inside the loop), so the sale ships no reminder template to turn on.
        for (const key of ["after-sale", "delivery-check", "occasion", "web-order"]) {
            expect(status.get(key)).toBe("active")
        }
        expect(status.get("consult")).toBeUndefined()
        expect(status.get("payment")).toBe("active")
    })
})

describe("AgentWorkflowsService: a template version to accept", () => {
    it("refuses to preview or accept a template version that is not newer than the one the workflow came from, and writes nothing", async () => {
        const world = await buildWorld()
        const primary = await primaryOf(world)

        expect(primary.template).toEqual({ templateId: "webbooks.invoice", templateVersion: NEWEST })
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
            { name: "Chi phi", moduleKey: "webbooks" },
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

describe("AgentWorkflowsService: a template version adopted as shipped (the re-seed)", () => {
    it("writes the template version's graph as a new version and moves the provenance to it, with no merge", async () => {
        const world = await buildWorld()
        const made = await reportsOf(world)
        await world.workflows.publish("ws-1", made.id, ownerEdited(templateGraph("webbooks.debt-round")), OWNER, 1, "own")
        const pick = { templateId: "webbooks.debt-round", templateVersion: templateNewest("webbooks.debt-round") }

        const adopted = await world.workflows.adoptTemplateVersion("ws-1", made.id, pick, OWNER, 2, "re-seed")
        const own = versionsOf(world).filter((version) => version.workflowId === made.id)

        expect(adopted).toMatchObject({ number: 3, changeKind: "accept_template" })
        expect(own.find((version) => version.number === 3)?.document).toEqual(jsonOf(templateGraph("webbooks.debt-round")))
        expect(workflowsOf(world).find((workflow) => workflow.id === made.id)?.template).toEqual(pick)
    })

    it("refuses a template version the installation does not ship, and writes nothing", async () => {
        const world = await buildWorld()
        const made = await reportsOf(world)
        const pick = { templateId: "webbooks.debt-round", templateVersion: templateNewest("webbooks.debt-round") + 1 }

        await expect(world.workflows.adoptTemplateVersion("ws-1", made.id, pick, OWNER, 1, "")).rejects.toMatchObject({
            code: AgentGraphsErrorCode.TemplateNotFound,
        })
        expect(versionsOf(world).filter((version) => version.workflowId === made.id)).toHaveLength(1)
    })
})

describe("AgentWorkflowsService: history", () => {
    it("rolls back by writing a new version that copies the old snapshot", async () => {
        const world = await buildWorld()
        const made = await reportsOf(world)
        const edited = ownerEdited(templateGraph("webbooks.debt-round"))
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
            world.workflows.publish("ws-1", made.id, templateGraph("webbooks.debt-round"), OWNER, 0, ""),
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

        await world.workflows.publish("ws-1", primary.id, templateGraph("webbooks.invoice"), OWNER, 1, "")

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
        await madeFrom(world, "booking.book")
        await madeFrom(world, "sales.payment")

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
        await madeFrom(world, "booking.book")
        await madeFrom(world, "sales.payment")
        // The one sale graph hands a paid order on to `sales.after-sale` (`to-after-sale`): its target must be there, or the publish is
        // refused for that hand-off (CALL_TARGET_UNKNOWN) before the caller check this case is about.
        await madeFrom(world, "sales.after-sale")
        const demanding = templateGraph("sales.consult")
        // A called workflow's params are the members of its `data` input (a `workflow.called` trigger: the caller's params arrive as the
        // event's `data`, `callInputsOf`), so the new required param is a member of `data`; a top-level input beside `data` is no call
        // param any more and would break no caller.
        const widened: GraphSpec = {
            ...demanding,
            contract: {
                inputs: (demanding.contract?.inputs ?? []).map((input) =>
                    input.name === "data"
                        ? { ...input, members: [...(input.members ?? []), { name: "voucher", type: "string", required: true }] }
                        : input,
                ),
            },
        }
        expect(widened.contract?.inputs.some((input) => input.name === "data")).toBe(true)

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
        await madeFrom(world, "booking.book")
        await madeFrom(world, "sales.payment")
        // The one sale graph's own hand-off target (`to-after-sale`), see the case above.
        await madeFrom(world, "sales.after-sale")

        await expect(
            world.workflows.publish("ws-1", consult.id, templateGraph("sales.consult"), OWNER, 1, ""),
        ).resolves.toMatchObject({ number: 2 })
    })
})

/** A workflow's graph as an OLDER version of it stored it: its call input `name` (a member of `data`) not taken yet. */
const withoutCallInput = (graph: GraphSpec, name: string): GraphSpec => ({
    ...graph,
    contract: {
        inputs: (graph.contract?.inputs ?? []).map((input) =>
            input.name === "data" ? { ...input, members: (input.members ?? []).filter((member) => member.name !== name) } : input,
        ),
    },
})

/**
 * E-FIX8 (RESTART-R5: `tools reseed` refused the sales agent of three workspaces `CALL_INPUT_UNKNOWN at to-after-sale.orderNo`).
 * GENERAL RULE: versions written as ONE change (a re-seed) are judged together: each hand-off against the other end's version in the
 * set, whichever end is written first. Without the set a caller that passes a new input to a callee still on its older version is
 * refused, and a callee whose older caller does not fit it is refused: the order of the writes decided, not the result.
 */
describe("AgentWorkflowsService.adoptTemplateVersion: a set of versions written together", () => {
    /** A workspace whose callee runs an OLDER version (without `input`) and whose caller runs the template's current graph. */
    const olderCallee = async (callee: string, input: string, others: ReadonlyArray<string>) => {
        const world = await buildWorld()
        const made = await madeFrom(world, callee)
        await world.workflows.publish("ws-1", made.id, withoutCallInput(templateGraph(callee), input), OWNER, 1, "older")
        const views = new Map<string, WorkflowView>([[callee, made]])
        for (const id of others) views.set(id, await madeFrom(world, id))
        const idOf = (id: string): string => views.get(id)?.id ?? ""
        return { world, idOf }
    }
    const pickOf = (templateId: string) => ({ templateId, templateVersion: templateNewest(templateId) })

    it("the exposing case: payment hands a paid order on to an after-sale still on its older version (no orderNo)", async () => {
        const { world, idOf } = await olderCallee("sales.after-sale", "orderNo", [
            "sales.payment",
            "sales.consult",
            "chatbot.front-desk",
            "booking.book",
        ])
        const payment = idOf("sales.payment")
        const after = idOf("sales.after-sale")

        const alone = await refusalOf(world.workflows.adoptTemplateVersion("ws-1", payment, pickOf("sales.payment"), OWNER, 1, ""))
        expect(alone?.code).toBe(AgentGraphsErrorCode.ContractRefused)
        expect(alone?.problems).toContain("CALL_INPUT_UNKNOWN")
        expect(alone?.problems).toContain("to-after-sale.orderNo")

        const together = new Map([
            [payment, templateGraph("sales.payment")],
            [after, templateGraph("sales.after-sale")],
        ])
        await expect(
            world.workflows.adoptTemplateVersion("ws-1", payment, pickOf("sales.payment"), OWNER, 1, "", together),
        ).resolves.toMatchObject({ number: 2 })
        await expect(
            world.workflows.adoptTemplateVersion("ws-1", after, pickOf("sales.after-sale"), OWNER, 2, "", together),
        ).resolves.toMatchObject({ number: 3 })
    })

    it("a set that does not hold the callee's new version judges against the stored one: still refused", async () => {
        const { world, idOf } = await olderCallee("sales.after-sale", "orderNo", [
            "sales.payment",
            "sales.consult",
            "chatbot.front-desk",
            "booking.book",
        ])
        const payment = idOf("sales.payment")
        const together = new Map([[payment, templateGraph("sales.payment")]])

        const refusal = await refusalOf(
            world.workflows.adoptTemplateVersion("ws-1", payment, pickOf("sales.payment"), OWNER, 1, "", together),
        )

        expect(refusal?.problems).toContain("to-after-sale.orderNo")
    })

    it("a second kind of workflow (R75): a content draft handing its text to a video production, no person, no line", async () => {
        const { world, idOf } = await olderCallee("video.produce", "text", ["content.draft"])
        const draft = idOf("content.draft")

        const alone = await refusalOf(world.workflows.adoptTemplateVersion("ws-1", draft, pickOf("content.draft"), OWNER, 1, ""))
        expect(alone?.problems).toContain("to-video.text")

        const together = new Map([
            [draft, templateGraph("content.draft")],
            [idOf("video.produce"), templateGraph("video.produce")],
        ])
        await expect(
            world.workflows.adoptTemplateVersion("ws-1", draft, pickOf("content.draft"), OWNER, 1, "", together),
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
        expect(desk?.triggers.map((trigger) => trigger.sourceKind)).toEqual(["zalo", "telegram", "facebook", "instagram"])
        // The channel trigger scope is the generic delivered one (one trigger pipeline): the route is `routeId`, no `conversationId`.
        expect(desk?.inputs.map((input) => input.name)).toContain("routeId")
        expect(desk?.inputs.map((input) => input.name)).not.toContain("conversationId")
        const toConsult = desk?.calls.find((call) => call.agent === "sales" && call.workflow === "consult")
        expect(toConsult).toMatchObject({ workflowName: consult.name })
        expect(called).toMatchObject({ entry: "any", activeNumber: 1 })
        expect(called?.triggers.map((trigger) => trigger.sourceKind)).toEqual(["workflow"])
    })

    it("adopts the running agent graph first, so the primary workflow is on the page", async () => {
        const world = await buildWorld()

        const graph = await world.workflows.graphOf("ws-1", "agent-1", "vi")

        expect(graph.workflows.map((workflow) => [workflow.key, workflow.primary])).toEqual([["invoice", true]])
        expect(world.graphs.stateOfAgent).toHaveBeenCalled()
    })

    it("lists only the workflows of the agent asked for", async () => {
        const world = await buildWorld()
        await madeFrom(world, "chatbot.front-desk")

        const graph = await world.workflows.graphOf("ws-1", "agent-2", "en")

        expect(graph.workflows.find((workflow) => workflow.key === "front-desk")).toBeUndefined()
    })
})

describe("AgentWorkflowsService.activeGraphsOf: the graphs that run now", () => {
    it("answers each workflow that has an active version with its ids and its graph, and writes nothing", async () => {
        const world = await buildWorld()
        const consult = await madeFrom(world, "sales.consult")
        const before = versionsOf(world).length

        const active = await world.workflows.activeGraphsOf("ws-1")
        const entry = active.find((one) => one.workflowId === consult.id)

        expect(entry?.agentId).toBe("agent-1")
        expect(entry?.graph.nodes.map((node) => node.key)).toContain("consult")
        expect(versionsOf(world).map((version) => version.id)).toContain(entry?.versionId)
        expect(versionsOf(world)).toHaveLength(before)
    })

    it("leaves out a workflow that has no active version", async () => {
        const world = await buildWorld()
        const made = await madeFrom(world, "sales.consult")
        const stored = workflowsOf(world).find((workflow) => workflow.id === made.id)

        const active = await world.workflows.activeGraphsOf("ws-1")

        expect(active.some((one) => one.workflowId === made.id)).toBe(stored?.activeVersionId !== null)
    })
})
