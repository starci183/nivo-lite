import type { DynamicModule } from "@nestjs/common"

/** What the module-context-notes capability is registered with; the app root decides whether it is global. */
export interface ContextNotesOptions {
    /** The registered setup-sessions module this capability reads sessions from; its parent registers it once. */
    readonly sessions: DynamicModule
}
