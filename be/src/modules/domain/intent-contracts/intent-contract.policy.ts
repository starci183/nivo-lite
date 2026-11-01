import type { IntentSay } from "./intent-policies.contracts"
import type {
    BusinessLimit,
    IntentBusiness,
    IntentContract,
    IntentFrame,
    IntentTrigger,
    InboundTrust,
} from "./intent-contracts.contracts"

/** What one contract is made from: the frame of the code, the title the owner gave the intent, and the business values of the published version. */
export interface ContractSource {
    /** The frame. */
    readonly frame: IntentFrame
    /** The title of the node that yields the intent. */
    readonly label: string
    /** The business half, or null when the published version holds none for this intent. */
    readonly business: IntentBusiness | null
}

const binds = (limit: BusinessLimit, trigger: IntentTrigger, trust: InboundTrust): boolean =>
    (limit.triggers.length === 0 || limit.triggers.includes(trigger)) &&
    (limit.trusts.length === 0 || limit.trusts.includes(trust))

/** The members the other sources own: a fixed limit about one of them is not this intent's to state. */
const ownedByOthers = (source: ContractSource, all: ReadonlyArray<ContractSource>): ReadonlyArray<string> =>
    all
        .filter((other) => other.frame.intent !== source.frame.intent)
        .flatMap((other) => other.frame.owns)
        .filter((member) => !source.frame.owns.includes(member))

/**
 * The contracts of one turn: each frame with the words of its task and fixed limits for the trust, followed by the business task and
 * the business limits that bind this trigger and trust. The business half only adds: it cannot remove a limit of the frame.
 */
export const resolveContracts = (
    sources: ReadonlyArray<ContractSource>,
    trigger: IntentTrigger,
    trust: InboundTrust,
    say: IntentSay,
): ReadonlyArray<IntentContract> =>
    sources.map((source) => {
        const { frame, business } = source
        const skipped = ownedByOthers(source, sources)
        const fixed = (frame.limitKeys[trust] ?? []).filter((key) => !skipped.includes(frame.limitMembers[key] ?? ""))
        const task = [say(frame.taskKey), business?.task ?? ""].filter((part) => part.trim() !== "")
        return {
            intent: frame.intent,
            label: source.label,
            ownTurn: frame.ownTurn,
            task: task.join(" "),
            limits: [
                ...fixed.map((key) => say(key)),
                ...(business?.limits ?? []).filter((limit) => binds(limit, trigger, trust)).map((limit) => limit.text),
            ],
            result: frame.result,
            owns: frame.owns,
            checks: frame.checks,
        }
    })
