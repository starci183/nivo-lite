import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./connection-secrets.module-definition"
import { ConnectionSecretsService } from "./connection-secrets.service"

@Module({})
/** The sealed credentials of a workspace's connections over the primary PostgreSQL connection. */
export class ConnectionSecretsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ConnectionSecretsService],
            exports: [ConnectionSecretsService],
        }
    }
}
