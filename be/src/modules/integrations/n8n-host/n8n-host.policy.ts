import { N8nHostError, N8nHostErrorCode } from "./errors/n8n-host.error"
import type { N8nWorkflowFile } from "./n8n-host.contracts"
import type { N8nHostOptions } from "./n8n-host.options"

const LISTING_SEPARATOR = "|"

/** A workflow of the plan with the id n8n already has for its name (empty when it is new). */
export interface PlannedWorkflow {
    /** The workflow file. */
    readonly workflow: N8nWorkflowFile
    /** The id of the workflow of the same name, or empty. */
    readonly id: string
}

/** True when the value is a workflow n8n can import: a name and a list of nodes. */
export const isWorkflowFile = (value: unknown): value is N8nWorkflowFile =>
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    "nodes" in value &&
    Array.isArray(value.nodes)

/** Checks every file and answers them as workflows; the first bad one or an empty list is refused. */
export const workflowsOf = (files: ReadonlyArray<unknown>): ReadonlyArray<N8nWorkflowFile> => {
    if (files.length === 0) throw new N8nHostError({ code: N8nHostErrorCode.NoWorkflows })
    return files.map((file) => {
        if (!isWorkflowFile(file)) throw new N8nHostError({ code: N8nHostErrorCode.WorkflowInvalid })
        return file
    })
}

/** Reads `n8n list:workflow` ("<id>|<name>" per line) into the id of each workflow name. */
export const idsByName = (listing: string): ReadonlyMap<string, string> => {
    const entries = listing
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.includes(LISTING_SEPARATOR))
        .map((line): [string, string] => {
            const at = line.indexOf(LISTING_SEPARATOR)
            return [line.slice(at + 1), line.slice(0, at)]
        })
    return new Map(entries)
}

/** The import document: every workflow inactive, carrying the id of the one it replaces. */
export const importDocument = (plan: ReadonlyArray<PlannedWorkflow>): string =>
    JSON.stringify(plan.map(({ workflow, id }) => ({ ...workflow, ...(id ? { id } : {}), active: false })))

/** The ssh arguments that reach the host and run the command there. */
export const sshArguments = (target: N8nHostOptions, command: string): ReadonlyArray<string> => {
    const known = target.knownHostsPath === undefined ? [] : ["-o", `UserKnownHostsFile=${target.knownHostsPath}`]
    return [
        "-i",
        target.keyPath,
        "-o",
        "BatchMode=yes",
        "-o",
        "StrictHostKeyChecking=accept-new",
        ...known,
        `${target.user}@${target.host ?? ""}`,
        command,
    ]
}
