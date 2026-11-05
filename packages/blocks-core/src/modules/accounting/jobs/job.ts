import type { PortMap, PortsOf } from "@nivo-lite/agent-sdk/port"
import type { z } from "zod"
import type { DoorCallResult, DoorFailure } from "../accounting.types"

/**
 * A small local stand-in for the engine's `defineJob`: the same members as its `JobConfig`, so the lead swaps `defineJob` here for
 * the SDK one in this file alone. A job runs outside any transaction, from the outbox, and is the only code that calls the door.
 */

/** What the job runner gives a run besides its ports and input. */
export interface JobContext {
    /** The workspace of the scope the runner opened; never part of the payload. */
    readonly workspaceId: string
    /** 1 for the first delivery. */
    readonly attempt: number
    /** The inbox claim key of a remote effect of this job at a step: the same on every retry, so the effect happens once. */
    readonly effectKey: (step: string) => string
}

/**
 * Why a job could not finish, as data: `transient` is delivered again by the runner (a network error, a provider that is down);
 * anything else is parked with one alert to the owner (a connection the provider refused, a tool that is not there).
 */
export interface JobFailure {
    /** Tells a failure from a finished job. */
    readonly ok: false
    /** The door tool that failed. */
    readonly tool: string
    /** What the door said. */
    readonly reason: DoorFailure
    /** Whether the runner should deliver the job again. */
    readonly transient: boolean
}

/** How a run ended: finished, or failed with the tool and the reason. */
export type JobResult = { readonly ok: true } | JobFailure

/** What a run answers when it finished, or when there was nothing to do. */
export const DONE: JobResult = { ok: true }

/** The result of one door call: finished when it went through, else the failure with the door's reason. */
export const resultOf = (tool: string, call: DoorCallResult): JobResult =>
    call.ok ? DONE : { ok: false, tool, reason: call.reason, transient: call.reason === "transient" }

/** What a job declares. */
export interface JobConfig<I extends z.ZodObject, P extends PortMap> {
    /** `<module>.<job>`, kebab-case. */
    readonly name: string
    /** Ids, enums and bounded strings only: a payload carries ids, never the data. */
    readonly input: I
    /** The ports the job asks for, by the name `run` reaches them by. */
    readonly ports: P
    /** How many deliveries the runner tries before it parks the job (1 to 20). */
    readonly attempts: number
    /** The job itself: it reads through the ports and, for an outside effect, calls the door. */
    run(ports: PortsOf<P>, input: z.output<I>, context: JobContext): Promise<JobResult>
}

/** A declared job. */
export interface JobDefinition<I extends z.ZodObject = z.ZodObject, P extends PortMap = PortMap> extends JobConfig<
    I,
    P
> {
    /** Tells a job from the other registry entries. */
    readonly entry: "job"
}

/** Defines a job. */
export const defineJob = <I extends z.ZodObject, P extends PortMap>(config: JobConfig<I, P>): JobDefinition<I, P> => ({
    ...config,
    entry: "job",
})
