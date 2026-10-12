import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SupabaseOptions } from "./supabase.options"

/** The configurable-module base of the Supabase integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<SupabaseOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
