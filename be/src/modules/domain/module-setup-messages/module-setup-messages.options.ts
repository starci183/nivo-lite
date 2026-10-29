import type { DynamicModule } from "@nestjs/common"

/** What the module-setup-messages capability is registered with; the app root decides whether it is global. */
export interface ModuleSetupMessagesOptions {
    /** The registered setup-sessions module this capability reads sessions from; its parent registers it once. */
    readonly sessions: DynamicModule
}
