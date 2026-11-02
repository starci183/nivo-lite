import { AGENT_RUNS_MODULES } from "../../world/agent-runs-capabilities.options"
import { backboneEngineOf } from "../../world/backbone-engine.service"
import { tableOf } from "../../world/backbone-table.service"
import { useTestWorld } from "../../world/use-test-world"
import { KILL_CASES, OWNER_CASES, RECOVERY_CASES } from "../../fixtures/builders/backbone.builder"
import { backboneOf } from "../../world/backbone-failures.service"

const world = useTestWorld({ modules: AGENT_RUNS_MODULES })
const backbone = backboneOf(world, (workspaceId) => backboneEngineOf(world, workspaceId))

describe("backbone/owner: the seven cases of the owner, on the real engine with kills at step boundaries", () => {
    it.each(tableOf(OWNER_CASES))("%s", (_id, row) => backbone.run(row))
})

describe("backbone/kill: the earlier kill cases", () => {
    it.each(tableOf(KILL_CASES))("%s", (_id, row) => backbone.run(row))
})

describe("backbone/recovery: a graceful shutdown and a hard kill", () => {
    it.each(tableOf(RECOVERY_CASES))("%s", (_id, row) => backbone.run(row))
})
