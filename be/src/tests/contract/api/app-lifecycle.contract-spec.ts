import type { DynamicModule, Provider } from "@nestjs/common"
import { APP_FILTER, APP_GUARD, APP_PIPE } from "@nestjs/core"
import { AuthGuard, CredentialGuard } from "@modules/domain/identity"
import { ErrorsFilter } from "@modules/platform/errors"
import { HttpSecurityModule, OriginGuard, RateLimitGuard } from "@modules/platform/http-security"
import { buildWiringProof } from "../../fixtures/builders/api.builder"
import { AppModule } from "../../../../apps/api/src/app.module"

/** A Jest type matcher as an untyped value, so it can stand in a typed expectation. */
const anyOf = (type: unknown): unknown => expect.any(type)

const bindings = (definition: DynamicModule, providerKey: string): Array<Provider> =>
    (definition.providers ?? []).filter(
        (provider) => typeof provider !== "function" && provider.provide === providerKey,
    )

const graphBindings = (
    definition: DynamicModule,
    providerKey: string,
    visited = new Set<DynamicModule>(),
): Array<Provider> => {
    if (visited.has(definition)) return []
    visited.add(definition)
    return [
        ...bindings(definition, providerKey),
        ...(definition.imports ?? []).flatMap((imported) =>
            typeof imported === "object" && "module" in imported ? graphBindings(imported, providerKey, visited) : [],
        ),
    ]
}

describe("AppModule request lifecycle", () => {
    it("registers the four global guards in lifecycle order and a single filter and validation pipe", () => {
        const { options } = buildWiringProof(AppModule)
        const definition = AppModule.register(options)
        const securityPipes = bindings(HttpSecurityModule.register(options.httpSecurity), APP_PIPE)

        expect(bindings(definition, APP_GUARD)).toEqual([
            { provide: APP_GUARD, useClass: RateLimitGuard },
            { provide: APP_GUARD, useClass: OriginGuard },
            { provide: APP_GUARD, useClass: CredentialGuard },
            { provide: APP_GUARD, useClass: AuthGuard },
        ])
        expect(graphBindings(definition, APP_GUARD)).toEqual(bindings(definition, APP_GUARD))
        expect(graphBindings(definition, APP_FILTER)).toEqual([{ provide: APP_FILTER, useClass: ErrorsFilter }])
        expect(securityPipes).toEqual([{ provide: APP_PIPE, useClass: anyOf(Function) }])
        expect(graphBindings(definition, APP_PIPE)).toEqual(securityPipes)
        const security = definition.imports?.find(
            (imported): imported is DynamicModule =>
                typeof imported === "object" && "module" in imported && imported.module === HttpSecurityModule,
        )
        expect(security).toBeDefined()
        expect(security && bindings(security, APP_PIPE)).toEqual(securityPipes)
    })
})
