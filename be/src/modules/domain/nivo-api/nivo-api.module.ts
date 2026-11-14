import { Module, type DynamicModule } from "@nestjs/common"
import { NIVO_API_OP_GROUPS } from "./nivo-api.decorators"
import { NivoApiError, NivoApiErrorCode } from "./errors/nivo-api.error"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./nivo-api.module-definition"
import { nivoApiOpTableOf } from "./nivo-api-ops.policy"
import { NivoApiOpsService } from "./nivo-api-ops.service"

@Module({})
/** The registry of the NIVO data ops and the application handlers their features declare, composed without GraphQL transport. */
export class NivoApiModule extends ConfigurableModuleClass {
    /** Registers the capability once in the app that serves the outbound MCP endpoint. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const table = nivoApiOpTableOf(options.groups)
        if (table.uncovered.length > 0) {
            throw new NivoApiError({ code: NivoApiErrorCode.OpsUncovered, params: { ops: table.uncovered.join(", ") } })
        }
        if (table.duplicated.length > 0) {
            throw new NivoApiError({ code: NivoApiErrorCode.OpsDuplicated, params: { ops: table.duplicated.join(", ") } })
        }
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: NIVO_API_OP_GROUPS, useValue: options.groups },
                NivoApiOpsService,
                ...options.groups.flatMap((group) => group.handlers),
            ],
            exports: [NivoApiOpsService],
        }
    }
}
