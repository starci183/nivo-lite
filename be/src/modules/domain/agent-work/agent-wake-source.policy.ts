import { AgentWorkError, AgentWorkErrorCode } from "./errors/agent-work.error"
import type { AgentWakeSource } from "./agent-work.contracts"
import { WAKE_SOURCE_KEY } from "@modules/domain/agent-wake-rules"
import type { AgentWakeTraits, OptionalAgentWakeTraits } from "@modules/domain/agent-wake-rules"

/** The keys of the four sources that existed before adapters, and the traits the work core always gave them. */
const BUILT_IN: Readonly<Record<string, AgentWakeTraits>> = {
    customer: {
        priority: 10,
        maxAttempts: 2,
        scopedToConversation: true,
        background: false,
        restoresHeld: true,
        awaitsAnswer: true,
    },
    tag: {
        priority: 20,
        maxAttempts: 3,
        scopedToConversation: false,
        background: false,
        restoresHeld: true,
        awaitsAnswer: false,
    },
    internal: {
        priority: 30,
        maxAttempts: 3,
        scopedToConversation: false,
        background: true,
        restoresHeld: false,
        awaitsAnswer: false,
    },
    schedule: {
        priority: 40,
        maxAttempts: 3,
        scopedToConversation: false,
        background: true,
        restoresHeld: false,
        awaitsAnswer: false,
    },
}

/**
 * The source of the wakes the engine writes for a run on a LangGraph thread: a founder's decision, a deadline that passed, a re-drive of
 * a thread whose drive was cut. A person waits on it (not background work: it never spends the agent's daily cap of background turns and
 * is never skipped by it), it is restored when the agent's work is switched back on (a decision held while work was off is not lost),
 * and it is tried three times. The wake names its lock scope itself (the run's), so it is not scoped by a conversation. It is the
 * engine's own: no trigger listens to it, so `registered()` never offers it.
 */
export const ENGINE_THREAD_SOURCE = "thread"

/** The sources only the engine writes, with their traits: known to every process, offered to no trigger. */
const ENGINE: Readonly<Record<string, AgentWakeTraits>> = {
    [ENGINE_THREAD_SOURCE]: {
        priority: 15,
        maxAttempts: 3,
        scopedToConversation: false,
        background: false,
        restoresHeld: true,
        awaitsAnswer: false,
    },
}

const sameTraits = (a: AgentWakeTraits, b: AgentWakeTraits): boolean =>
    a.priority === b.priority &&
    a.maxAttempts === b.maxAttempts &&
    a.scopedToConversation === b.scopedToConversation &&
    a.background === b.background &&
    a.restoresHeld === b.restoresHeld &&
    a.awaitsAnswer === b.awaitsAnswer

/** The sources the work core knows, each with its traits. The four built-in ones are always there; an inbound adapter adds its own. */
export class WakeSourcesPolicy {
    private readonly known = new Map<string, AgentWakeTraits>([...Object.entries(BUILT_IN), ...Object.entries(ENGINE)])

    /**
     * Records the traits of a source. Recording the same traits again changes nothing; other traits for a source that is known, or a key that
     * is not a key, is a wiring bug and throws.
     */
    add(source: AgentWakeSource, traits: AgentWakeTraits): void {
        const known = this.known.get(source)
        if (known !== undefined && sameTraits(known, traits)) return
        if (known !== undefined || !WAKE_SOURCE_KEY.test(source)) {
            throw new AgentWorkError({ code: AgentWorkErrorCode.SourceInvalid, params: { source } })
        }
        this.known.set(source, traits)
    }

    /** The traits of a source, or undefined when none was recorded. */
    lookup(source: AgentWakeSource): OptionalAgentWakeTraits {
        return this.known.get(source)
    }

    /**
     * The source keys actually registered in this process, including plug-in adapters, for an authoring declaration that listens to any
     * source. The engine's own sources are left out: no trigger listens to them.
     */
    registered(): ReadonlyArray<AgentWakeSource> {
        return [...this.known.keys()].filter((source) => !(source in ENGINE))
    }

    /** The traits of a source; a source nobody recorded cannot wake an agent. */
    of(source: AgentWakeSource): AgentWakeTraits {
        const traits = this.known.get(source)
        if (traits === undefined)
            throw new AgentWorkError({ code: AgentWorkErrorCode.SourceUnknown, params: { source } })
        return traits
    }

    /** The keys of the built-in sources. */
    builtIn(): ReadonlyArray<string> {
        return Object.keys(BUILT_IN)
    }
}

/** The one table of the process: adapters add to it when they register, the policies read it. */
export const wakeSources: WakeSourcesPolicy = new WakeSourcesPolicy()
