import { DynamicModule, Global, Module } from "@nestjs/common";
import { createClient } from "@supabase/supabase-js";
import type { EnvSource } from "../config/env.source";

/** Injection token of the service-role Supabase client (`@Inject(SUPABASE) db: SupabaseClient`). */
export const SUPABASE = Symbol("SUPABASE");

export type SupabaseOptions = { readonly url: string; readonly serviceRoleKey: string };

export const parseSupabaseConfig = (env: EnvSource): SupabaseOptions => ({
  url: env.url("SUPABASE_URL", ["http:", "https:"]),
  serviceRoleKey: env.secret("SUPABASE_SERVICE_ROLE_KEY", 20),
});

/** The service-role client: the engine only database identity. Tenant isolation comes from the jobs it works on, never from a caller-supplied id. */
@Global()
@Module({})
export class SupabaseModule {
  static register(options: SupabaseOptions): DynamicModule {
    return {
      module: SupabaseModule,
      providers: [{ provide: SUPABASE, useValue: createClient(options.url, options.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }) }],
      exports: [SUPABASE],
    };
  }
}
