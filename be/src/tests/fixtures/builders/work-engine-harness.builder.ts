import type { WorkEngineService, WorkPerformer, WorkSpec } from "@modules/domain/decisions"
import { mock, type fakeTransaction, type MockOf } from "@starci/jest-preset"
import {
    itemOf,
    performedOf,
    arrangeEngineDoubles,
    autoFinishArgsOf,
    autoPlan,
    autoResult,
    blankPatch,
    ctx,
    quote,
    durablePreparation,
    ruleOf,
    type EngineDoubles,
    type WorkEngineFixtureOptions,
} from "@tests/fixtures/builders/work-engine.builder"

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

/** The doubles of the engine with the members the specs reach for lifted to the top. */
type EngineDoublesOfResultShape = EngineHarnessDoubles & {
    performer: WorkPerformer | null
    insert: EngineHarnessDoubles["intake"]["insert"]
    ask: EngineHarnessDoubles["approval"]["ask"]
    continueChain: EngineHarnessDoubles["chain"]["continueChain"]
    finished: EngineHarnessDoubles["recorder"]["finished"]
    rejected: EngineHarnessDoubles["recorder"]["rejected"]
    failed: EngineHarnessDoubles["recorder"]["failed"]
    accessOf: EngineHarnessDoubles["access"]["accessOf"]
    ruleFor: EngineHarnessDoubles["rules"]["ruleFor"]
    error: EngineHarnessDoubles["logger"]["error"]
}

/**
 * The calls a claimed queued item makes when it runs the whole automatic path (prepared, saved, gated, performed, logged and chained), each
 * as the double that must have been called and the arguments it was called with; `done` matches the finished item.
 */
export const claimedRunCalls = (
    built: Pick<EngineDoublesOfResultShape, "performer" | "items" | "access" | "recorder" | "chain">,
    done: unknown,
): ReadonlyArray<readonly [unknown, ReadonlyArray<unknown>]> => [
    [built.performer?.prepare, [ctx, itemOf()]],
    [built.items.savePrepared, ["item-1", blankPatch]],
    [built.access.accessOf, [ctx, itemOf(), quote]],
    [built.performer?.perform, [ctx, itemOf(), quote, autoPlan.by]],
    [built.items.markDone, ["item-1", { ...autoResult, proposal: quote }]],
    [built.recorder.finished, autoFinishArgsOf(itemOf(), done, quote)],
    [built.chain.continueChain, [ctx, done]],
]

/** Arranges the constructor doubles without constructing the unit subject. */
export const engineDoublesOf = (
    options: WorkEngineFixtureOptions,
    doubles: EngineHarnessDoubles,
): EngineDoublesOfResultShape => {
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

/** The options and the spec of a run of an action nobody listed and nobody gave a rule, which becomes a generic owner decision. */
export const genericOwnerRunOf = (): readonly [WorkEngineFixtureOptions, Partial<WorkSpec>] => {
    const items = mock<Pick<EngineDependencies[5], "claim">>()
    items.claim.mockResolvedValue(itemOf({ action: "connect_sepay" }))
    return [
        { rule: null, action: null, items: { claim: items.claim } },
        { action: "connect_sepay", preset: true, forceAsk: "branch_ask" },
    ]
}
