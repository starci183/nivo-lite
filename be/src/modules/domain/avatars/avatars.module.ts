import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AVATARS_ACCOUNTS, AVATARS_STORAGE } from "./avatars.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./avatars.module-definition"
import { AvatarsService } from "./avatars.service"

@Module({})
/** The pictures of people and agents: upload addresses, and setting or removing a picture. */
export class AvatarsModule extends ConfigurableModuleClass {
    /** Registers the storage and account bindings and the service once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: AVATARS_STORAGE, useExisting: options.storage },
                { provide: AVATARS_ACCOUNTS, useExisting: options.accounts },
                AvatarsService,
            ],
            exports: [AvatarsService],
        }
    }
}
