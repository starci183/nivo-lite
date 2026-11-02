import { mock } from "@starci/jest-preset"
import type { fakeTransaction, MockOf } from "@starci/jest-preset"
import type { WorkEngineService, WorkPerformer } from "@modules/domain/decisions"
import {
    itemOf,
    performedOf,
    arrangeEngineDoubles,
    durablePreparation,
    ruleOf,
} from "@tests/fixtures/builders/work-engine.builder"
import type { EngineDoubles, WorkEngineFixtureOptions } from "@tests/fixtures/builders/work-engine.builder"

type EngineDependencies = ConstructorParameters<typeof WorkEngineService>

/** The exact kit doubles the spec provides to Nest and shares with its data arranger. */
export interface EngineHarnessDoubles extends EngineDoubles {
    readonly tx: ReturnType<typeof fakeTransaction>
    readonly logger: MockOf<EngineDependencies[1]>
    readonly registry: MockOf<EngineDependencies[3]>
    readonly intake: MockOf<EngineDependencies[8]>
    readonly chain: MockOf<EngineDependencies[9]>
    readonly approval: MockOf<EngineDependencies[10]>
    readonly recorder: MockOf<EngineDependencies[11]>
    readonly branching: MockOf<EngineDependencies[12]>
    readonly closed: MockOf<EngineDependencies[13]>
}

/** Arranges a performer with the default prepared proposal and successful delivery. */
export const performerOf = (overrides: Partial<WorkPerformer> = {}): WorkPerformer => {
    const performer = mock<WorkPerformer>()
    performer.prepare.mockImplementation((_ctx, item) => Promise.resolve({ proposal: item.proposal }))
    performer.perform.mockResolvedValue(performedOf())
    Object.assign(performer, overrides)
    return performer
}

/** Arranges the constructor doubles without constructing the unit subject. */
export const engineDoublesOf = (options: WorkEngineFixtureOptions, doubles: EngineHarnessDoubles) => {
    const { logger, catalog, modules, items, access, rules, registry, intake, chain, approval, recorder, branching } =
        doubles
    const performer = options.performer === undefined ? performerOf() : options.performer
    arrangeEngineDoubles(options, { catalog, modules, items, access, rules })
    registry.performerOf.mockReturnValue(performer)
    intake.insert.mockImplementation((_ctx, spec) =>
        Promise.resolve({ item: itemOf({ action: spec.action }), created: options.created ?? true }),
    )
    chain.continueChain.mockResolvedValue(undefined)
    approval.ask.mockResolvedValue(itemOf({ status: "waiting_decision" }))
    approval.fieldLabels.mockReturnValue("Need")
    branching.consult.mockImplementation(async (request) => ({
        proposal: request.proposal,
        verdict: await request.gate(request.proposal),
        carried: {},
    }))
    const failure = options.notificationFailure
    if (failure?.target === "continueChain") chain.continueChain.mockRejectedValue(failure.cause)
    else if (failure !== undefined) recorder[failure.target].mockRejectedValue(failure.cause)
    return {
        ...doubles,
        performer,
        insert: intake.insert,
        ask: approval.ask,
        continueChain: chain.continueChain,
        finished: recorder.finished,
        rejected: recorder.rejected,
        failed: recorder.failed,
        accessOf: access.accessOf,
        ruleFor: rules.ruleFor,
        error: logger.error,
    }
}

/** Arranges a prepared queued message retaining its producer's durable choices. */
export const durableOptionsOf = (): WorkEngineFixtureOptions => {
    const prepare = mock<Pick<WorkPerformer, "prepare">>()
    prepare.prepare.mockResolvedValue({ proposal: durablePreparation.prepared })
    const items = mock<Pick<EngineDependencies[5], "claim">>()
    items.claim.mockResolvedValue(itemOf({ proposal: durablePreparation.proposal }))
    return { performer: performerOf({ prepare: prepare.prepare }), items: { claim: items.claim } }
}

/** Arranges independent delivery and failure-recording refusals. */
export const unsavableFailureOptions = (): WorkEngineFixtureOptions => {
    const perform = mock<Pick<WorkPerformer, "perform">>()
    perform.perform.mockRejectedValue(new RangeError("send failed"))
    const items = mock<Pick<EngineDependencies[5], "markFailed">>()
    items.markFailed.mockRejectedValue(new RangeError("db down"))
    return { performer: performerOf({ perform: perform.perform }), items: { markFailed: items.markFailed } }
}

/** Arranges the selected decision method's refusal without executing the engine. */
export const decisionFailureOptions = (
    decision: "approved" | "rejected",
    method: "perform" | "onReject",
    message: string,
): WorkEngineFixtureOptions => {
    const calls = mock<Required<Pick<WorkPerformer, "perform" | "onReject">>>()
    calls[method].mockRejectedValue(new RangeError(message))
    const performer =
        method === "perform" ? performerOf({ perform: calls.perform }) : performerOf({ onReject: calls.onReject })
    return { performer, rule: decision === "approved" ? ruleOf({ mode: "ask" }) : ruleOf() }
}
