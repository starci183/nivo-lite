/** What a declared job run tells the door provider about itself. */
export interface DoorBinding {
    /** The workspace the job runs for. */
    readonly workspaceId: string
    /** The run of the job: the turn a call it makes is made in. */
    readonly jobId: string
    /** The installed agent of the job's module (absent for a job that reaches no records): the speaker of a tool that is the agent's own voice. */
    readonly agentId?: string | undefined
    /** The job's inbox claim key for a step: the same on every retry of the delivery. */
    readonly effectKey: (step: string) => string
    /** Whether an engine scope (an open transaction) is open now; a door call is refused while it is (BE-PERSISTENCE-6). */
    readonly scopeOpen: () => boolean
}
