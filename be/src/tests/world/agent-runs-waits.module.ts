import { Injectable, Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import type {
    AgentStepHandler,
    StepAnswer,
    StepDecision,
    StepJson,
    StepSpec,
    StepView,
} from "@modules/domain/agent-runs"

@Injectable()
/** Auxiliary observations of the dedicated engine-extension capability, never work-item or timeout authority. */
export class WaitsExtensionActivity {
    readonly performed: Array<string> = []
    readonly told: Array<string> = []

    /** Clears only the capability's auxiliary observations between proofs. */
    reset(): void {
        this.performed.length = 0
        this.told.length = 0
    }
}

/** An unshadowed step kind owned by this explicit extension capability. */
export const waitsExtensionStep = (
    stepKey: string,
    kind: "approval" | "deadline" | "door" | "tool" | "reply",
    input: StepJson,
): StepSpec => ({
    stepKey,
    nodeKey: `proof-waits-${kind}`,
    kind: `proof-waits-${kind}`,
    effect: { kind: kind === "reply" ? "pivot" : "read" },
    input,
})

const extensionWait = (activity: WaitsExtensionActivity, decides: boolean): AgentStepHandler => ({
    kind: decides ? "proof-waits-approval" : "proof-waits-deadline",
    run: (step) =>
        Promise.resolve({
            kind: "wait",
            workItemId: String(step.input.itemId),
            deadlineAt: new Date(String(step.input.deadlineAt)),
        }),
    deadLetter: (step, code) => {
        activity.told.push(`${step.stepKey}:${code}`)
        return Promise.resolve()
    },
    ...(decides
        ? {
              onDecided: (step: StepView, decision: StepDecision): StepAnswer => ({
                  kind: "done",
                  result: { approved: decision.approved, by: decision.by },
                  next: decision.approved
                      ? [waitsExtensionStep("reply", "reply", { wakeId: String(step.input.wakeId) })]
                      : [],
              }),
          }
        : {}),
})

const extensionAction = (activity: WaitsExtensionActivity, kind: "door" | "tool" | "reply"): AgentStepHandler => ({
    kind: `proof-waits-${kind}`,
    run: (step) => {
        const wakeId = String(step.input.wakeId)
        const receipt = `${kind}:${wakeId}`
        const nextKind = kind === "door" ? "tool" : "reply"
        const next = kind === "reply" ? [] : [waitsExtensionStep(nextKind, nextKind, { wakeId })]
        activity.performed.push(receipt)
        return Promise.resolve({
            kind: "done",
            result: { receipt },
            next,
        })
    },
})

@Injectable()
class WaitsExtensionRegistration {
    constructor(registry: AgentRunHandlersService, activity: WaitsExtensionActivity) {
        ;[
            extensionWait(activity, true),
            extensionWait(activity, false),
            extensionAction(activity, "door"),
            extensionAction(activity, "tool"),
            extensionAction(activity, "reply"),
        ].forEach((handler) => registry.add(handler))
    }
}

@Module({})
/** Adds new extension subjects to the real API engine without replacing any application provider or token. */
export class WaitsExtensionModule {
    static register(): DynamicModule {
        return {
            module: WaitsExtensionModule,
            providers: [WaitsExtensionActivity, WaitsExtensionRegistration],
            exports: [WaitsExtensionActivity],
        }
    }
}
