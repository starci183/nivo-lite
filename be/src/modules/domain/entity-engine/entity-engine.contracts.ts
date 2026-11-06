import type { ParkedFlowAlert } from "@modules/platform/jobs"
import type { DoorApi } from "@nivo-lite/agent-sdk/mutation"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import type { ScopedTx } from "./policies/scoped-tx.contracts"

/** Work that runs in a scoped transaction. */
export type ScopedWork<T> = (tx: ScopedTx) => Promise<T>

/** Runs `use` in the scope a port is bound to: the one transaction of the caller, or a transaction of its own per call. */
export type RunIn = <T>(use: ScopedWork<T>) => Promise<T>

/** The ports a job or action asks for, by the name it calls them. */
export interface DeclaredPorts {
    /** The declaration of one port. */
    readonly [name: string]: PortDefinition<unknown>
}

/** The handles a job or action receives, by the name it called its ports. */
export interface JobPorts {
    /** The handle of one port. */
    readonly [name: string]: unknown
}

/** What a job run tells the provider of its door port about itself. */
export interface JobDoorBinding {
    /** The workspace the job runs for. */
    readonly workspaceId: string
    /** The job's claim key for a step: the same on every retry of the delivery. */
    readonly effectKey: (step: string) => string
    /** Whether an engine scope (an open transaction) is open now; a door call is refused while it is. */
    readonly scopeOpen: () => boolean
}

/** The provider of the `door` port of declared jobs: the app root binds it, so the engine never imports the gateway. */
export interface EngineDoorProvider {
    /** The door handle of one job run. */
    doorApi(binding: JobDoorBinding): DoorApi
}

/** Where the engine tells the owner of a job it parked; the app root binds it, so the engine names no capability that files the owner's items. */
export interface EngineFailureAlerts {
    /** Tells the owner of the one alert of a park. */
    raise(alert: ParkedFlowAlert): Promise<void>
}
