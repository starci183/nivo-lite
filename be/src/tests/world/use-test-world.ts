import type { LiteWorld } from "./lite-world.service"
import type { LiteWorldOptions } from "./test-world.contracts"
import { createLiteWorld } from "./lite-world.service"

/** Gives each suite a local connection and its own module graph, with guaranteed cleanup. */
export const useTestWorld = (options: LiteWorldOptions): LiteWorld => {
    const world = createLiteWorld(options.modules)
    beforeAll(() => world.open())
    afterAll(() => world.close())
    return world
}
