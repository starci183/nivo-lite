import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./tool-grants.module-definition"
import { AccountAttachmentsService } from "./account-attachments.service"
import { ToolGrantsService } from "./tool-grants.service"
import { NodeAccountConsentsService } from "./node-account-consents.service"
import { NodeRightsSwitchService } from "./node-rights-switch.service"

@Module({})
/**
 * The per-agent grants of gateway tools (default deny), the per-agent access to provider connectors and the node-level rights kept in
 * shadow: the one owner of public.mcp_tool_grants, public.mcp_connector_access,
 * public.node_account_policies, public.node_policy_shadow_tallies and public.node_rights_switches.
 */
export class ToolGrantsModule extends ConfigurableModuleClass {
    /** Registers the capability under the capability (or the app) that reads and writes through it. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ToolGrantsService,
                AccountAttachmentsService,
                NodeRightsSwitchService,
                NodeAccountConsentsService,
            ],
            exports: [
                NodeAccountConsentsService,
                ToolGrantsService,
                AccountAttachmentsService,
                NodeRightsSwitchService,
            ],
        }
    }
}
