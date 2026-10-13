import { Test } from "@nestjs/testing"
import { EnvSource, Secret } from "@modules/platform/config"
import { parseSupabaseConfig } from "./supabase.config"

const SUPABASE_CONFIG = Symbol("SUPABASE_CONFIG")

const read = async (values: Record<string, string>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: EnvSource, useValue: new EnvSource(values) },
            { provide: SUPABASE_CONFIG, useFactory: parseSupabaseConfig, inject: [EnvSource] },
        ],
    }).compile()
    return moduleRef.get(SUPABASE_CONFIG)
}

describe("parseSupabaseConfig", () => {
    const required = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-1" }

    it("reads the url and the service role, leaving the publishable key out", async () => {
        await expect(read(required)).resolves.toEqual({
            url: "https://project.supabase.co",
            serviceRoleKey: new Secret("service-1"),
        })
    })

    it("includes the publishable key when it is declared", async () => {
        await expect(read({ ...required, SUPABASE_ANON_KEY: "anon-1" })).resolves.toEqual({
            url: "https://project.supabase.co",
            serviceRoleKey: new Secret("service-1"),
            anonKey: new Secret("anon-1"),
        })
    })
})
