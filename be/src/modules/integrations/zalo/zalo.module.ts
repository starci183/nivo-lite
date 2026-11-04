import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ZaloArticleClient } from "./zalo-article.client"
import { ZaloClient } from "./zalo.client"
import { ZALO, ZALO_ARTICLES } from "./zalo.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./zalo.module-definition"

@Module({})
/** Provides the Zalo client and the article client over it. */
export class ZaloModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that talks to Zalo. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: ZALO, useClass: ZaloClient },
                { provide: ZALO_ARTICLES, useClass: ZaloArticleClient },
            ],
            exports: [ZALO, ZALO_ARTICLES],
        }
    }
}
