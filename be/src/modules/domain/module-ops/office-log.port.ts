import type { DecisionEntry, EvidenceEntry } from "./module-ops.contracts"

/** The Office and the evidence log of a workspace, written by the office capability. It is also the injection token. */
export abstract class OfficeLog {
    /** Writes one line from the system into the workspace's Office. */
    abstract postOffice(workspaceId: string, body: string): Promise<void>
    /** Appends one evidence event of the workspace. */
    abstract logEvidence(workspaceId: string, entry: EvidenceEntry): Promise<void>
    /** Appends one entry to the decision log. */
    abstract logDecision(workspaceId: string, entry: DecisionEntry): Promise<void>
    /** The name of the workspace, or the product name when it has none. */
    abstract workspaceName(workspaceId: string): Promise<string>
}
