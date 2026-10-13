import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { createSupabaseAdminClient, createSupabasePublicClient } from "./supabase.client"
import { SUPABASE_ADMIN_CLIENT, SUPABASE_AUTH, SUPABASE_PUBLIC_CLIENT, SUPABASE_STORAGE } from "./supabase.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./supabase.module-definition"
import { SupabaseAuthService } from "./supabase-auth.service"
import { SupabaseStorageService } from "./supabase-storage.service"

@Module({})
/** The Supabase integration: the Auth and Storage administrator and the Auth service domains reach it through. */
export class SupabaseModule extends ConfigurableModuleClass {
    /** Registers the integration once per app with the options parsed at the composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: SUPABASE_ADMIN_CLIENT, useValue: createSupabaseAdminClient(options) },
                { provide: SUPABASE_PUBLIC_CLIENT, useValue: createSupabasePublicClient(options) },
                { provide: SUPABASE_AUTH, useClass: SupabaseAuthService },
                { provide: SUPABASE_STORAGE, useClass: SupabaseStorageService },
            ],
            exports: [SUPABASE_ADMIN_CLIENT, SUPABASE_AUTH, SUPABASE_STORAGE],
        }
    }
}
