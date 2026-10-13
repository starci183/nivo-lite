import { Test } from "@nestjs/testing"
import { EnvSource, Secret } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "./primary.config"
import { PRIMARY_CONNECTION } from "./primary.connection"

const PRIMARY_CONFIG = Symbol("PRIMARY_CONFIG")

describe("parsePrimaryDatabaseConfig", () => {
    it("reads the supabase connection with no default", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                {
                    provide: EnvSource,
                    useValue: new EnvSource({
                        PRIMARY_DB_URL: "postgresql://nivo:secret@db.example/nivo",
                        PRIMARY_DB_SCHEMA: "public",
                    }),
                },
                { provide: PRIMARY_CONFIG, useFactory: parsePrimaryDatabaseConfig, inject: [EnvSource] },
            ],
        }).compile()

        expect(moduleRef.get(PRIMARY_CONFIG)).toEqual({
            name: PRIMARY_CONNECTION,
            provider: "supabase",
            url: new Secret("postgresql://nivo:secret@db.example/nivo"),
            schema: "public",
        })
    })
})
