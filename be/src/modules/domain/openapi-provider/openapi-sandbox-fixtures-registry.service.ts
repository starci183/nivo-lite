import { Injectable } from "@nestjs/common"
import type { OpenApiSandboxFixtures } from "./openapi-sandbox-fixtures.contracts"

@Injectable()
/**
 * The sandbox fixtures of the connectors the installed packages pin (one entry per connector key): what the OpenAPI sandbox answers a
 * sandbox account's call from. A package registers its fixtures once at boot; a second registration of a connector replaces the first.
 */
export class OpenApiSandboxFixturesRegistryService {
    private readonly fixtures = new Map<string, OpenApiSandboxFixtures>()

    /** Registers (or replaces) the fixtures of one connector. */
    register(fixtures: OpenApiSandboxFixtures): void {
        this.fixtures.set(fixtures.connector, fixtures)
    }

    /** The fixtures of a connector, or undefined when no package shipped any. */
    of(connector: string): OpenApiSandboxFixtures | undefined {
        return this.fixtures.get(connector)
    }

    /** The connectors with fixtures, in registration order. */
    connectors(): ReadonlyArray<string> {
        return [...this.fixtures.keys()]
    }
}
