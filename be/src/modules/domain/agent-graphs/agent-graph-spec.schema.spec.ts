import { readFileSync } from "node:fs"
import { join } from "node:path"
import { graphSpecJsonSchema, graphSpecSchema } from "@nivo-lite/agent-sdk/graph"

/** The JSON Schema the seed step validates graph spec files against, committed beside the agent graphs. */
const COMMITTED = join(__dirname, "agent-graph-spec.schema.json")

/** The seeded graphs, which both schemas must take. */
const SEEDED = ["sales", "chatbot", "accounting"].map((name) =>
    JSON.parse(readFileSync(join(__dirname, `../../../../../.starcistacks/dev/seeds/data/graphs/${name}.json`), "utf8")),
)

describe("agent-graph-spec.schema.json", () => {
    it("is exactly the JSON Schema the SDK generates from graphSpecSchema, so the seed and the parser never disagree", () => {
        // Regenerate after a change of graphSpecSchema: write `graphSpecJsonSchema()` of @nivo-lite/agent-sdk/graph to this file.
        expect(JSON.parse(readFileSync(COMMITTED, "utf8"))).toEqual(graphSpecJsonSchema())
    })

    it("describes the seeded graphs, which the zod schema parses", () => {
        for (const spec of SEEDED) expect(graphSpecSchema.safeParse(spec).success).toBe(true)
        expect(graphSpecJsonSchema()).toMatchObject({ additionalProperties: false, title: "NIVO agent graph spec" })
    })
})
