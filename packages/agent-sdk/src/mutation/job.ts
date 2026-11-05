import { z } from "zod"
import { KEY_MAX } from "../schema/bounds"
import { isNamespaced } from "../schema/namespaced"
import { JobDefinitionError, type JobProblemCode } from "./job-definition-error"
import type { PortMap, PortsOf } from "../port/port.types"

/** The most attempts a job declares (the queue's backoff policy decides the spacing). */
export const JOB_ATTEMPTS_MAX = 20

/** What the job processor gives a run besides its ports and input. */
export interface JobContext {
    /** The workspace of the scope the processor opened; never part of the payload. */
    readonly workspaceId: string
    /** 1 for the first delivery. */
    readonly attempt: number
    /** The inbox claim key of a remote effect of this job at a step: the same on every retry, so the effect happens once. */
    effectKey(step: string): string
}

/** A declared job: a name, an input of ids, enums and bounded strings only, the ports it asks for, and its attempts. */
export interface JobConfig<I extends z.ZodObject, P extends PortMap> {
    /** `<module>.<job>`. */
    readonly name: string
    /** Ids, enums and bounded strings only (BE-QUEUES-1: payloads carry ids only). */
    readonly input: I
    /** The ports the run asks for, by the name it calls them. */
    readonly ports: P
    /** 1..`JOB_ATTEMPTS_MAX`. */
    readonly attempts: number
    /** Runs the job; a thrown failure is classified by the processor (retry or park). */
    run(ports: PortsOf<P>, input: z.output<I>, context: JobContext): Promise<void>
}

/** A defined job. */
export interface JobDefinition<I extends z.ZodObject = z.ZodObject, P extends PortMap = PortMap> extends JobConfig<
    I,
    P
> {
    /** Discriminant. */
    readonly entry: "job"
}

/** What a caller needs to name a job: its name and the input it takes. */
export interface JobRef<I extends z.ZodObject = z.ZodObject> {
    /** `<module>.<job>`. */
    readonly name: string
    /** The input schema the payload parses through. */
    readonly input: I
}

/** One problem of a job declaration. */
export interface JobProblem {
    /** The code. */
    readonly code: JobProblemCode
    /** The job name, or `<job>.<member>`. */
    readonly at: string
}

/** Whether a member of a job input is an id, an enum, a literal or a bounded text (optionally optional or null). */
const carriesIdOnly = (schema: z.core.$ZodType): boolean => {
    if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) return carriesIdOnly(schema.unwrap())
    if (schema instanceof z.ZodUUID || schema instanceof z.ZodGUID) return true
    if (schema instanceof z.ZodEnum || schema instanceof z.ZodLiteral) return true
    return schema instanceof z.ZodString && schema.maxLength !== null && schema.maxLength <= KEY_MAX
}

const problem = (code: JobProblemCode, at: string): JobProblem => ({ code, at })

/** What is wrong with a job declaration, empty when it is sound: a malformed name, a payload member that is not an id, enum or bounded text, attempts off 1..20. */
export const jobProblems = (
    config: Pick<JobConfig<z.ZodObject, PortMap>, "name" | "input" | "attempts">,
): ReadonlyArray<JobProblem> => [
    ...(isNamespaced(config.name) ? [] : [problem("JOB_NAME_MALFORMED", config.name)]),
    ...Object.entries<z.core.$ZodType>(config.input.shape)
        .filter(([, member]) => !carriesIdOnly(member))
        .map(([key]) => problem("JOB_INPUT_MEMBER_INVALID", `${config.name}.${key}`)),
    ...(Number.isInteger(config.attempts) && config.attempts >= 1 && config.attempts <= JOB_ATTEMPTS_MAX
        ? []
        : [problem("JOB_ATTEMPTS_INVALID", config.name)]),
]

/** Defines a job. Throws `JobDefinitionError` for the first problem of `jobProblems`, at module load. */
export const defineJob = <I extends z.ZodObject, P extends PortMap>(config: JobConfig<I, P>): JobDefinition<I, P> => {
    const [first] = jobProblems(config)
    if (first !== undefined) throw new JobDefinitionError(first.code, first.at)
    return { ...config, entry: "job" }
}
