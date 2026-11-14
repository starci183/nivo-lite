import { outcomeOf } from "@nivo-lite/agent-sdk/block"
import { type ModuleFixtures } from "@/modules/plugin-registry"
import type { FixtureTables } from "@/modules/workbench-host"

/**
 * The fixture tables the prototype data port answers from, joined from the fixtures of every module: each read by id answers its
 * `ready` data (the one written for the viewer's language when the fixture carries it in `readyIn`), each action by id its outcome.
 * Generic: it names no module, and an empty record gives empty tables.
 */
export const fixtureTablesOf = (
    modules: Readonly<Record<string, ModuleFixtures>>,
    locale: "vi" | "en",
): FixtureTables => {
    const fixtures = Object.values(modules)
    return {
        reads: Object.fromEntries(
            fixtures.flatMap((module) =>
                Object.entries(module.reads).map(
                    ([id, fixture]) => [id, () => fixture.readyIn?.[locale] ?? fixture.ready] as const,
                ),
            ),
        ),
        actions: Object.fromEntries(
            fixtures.flatMap((module) =>
                Object.entries(module.actions).map(([id, result]) => [id, () => outcomeOf(result)] as const),
            ),
        ),
    }
}
