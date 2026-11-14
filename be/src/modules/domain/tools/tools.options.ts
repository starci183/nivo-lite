import type { Type } from "@nestjs/common"
import type { NativeToolFamily } from "./tools.contracts"

/** What the tools module needs: the default time limit of a call, the console flag and the tool families the app adds. */
export interface ToolsOptions {
    /** True in the app that serves the console (registers the console service, which needs the connections capability). */
    readonly console?: boolean
    /**
     * The tool family classes the app adds to the module's own (SePay, e-invoice). Each is a provider of a global module of the app;
     * the module injects them from the global container. The cli passes none.
     */
    readonly natives?: ReadonlyArray<Type<NativeToolFamily>>
    /** The time limit of one call a family's manifest does not declare, milliseconds (4 s). */
    readonly defaultTimeoutMs: number
}
