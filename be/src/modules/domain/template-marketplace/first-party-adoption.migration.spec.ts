import { readFileSync } from "node:fs"
import { join } from "node:path"

const SQL = readFileSync(
    join(__dirname, "../../../../../db/migrations/20261111100300_first-party-adoption.sql"),
    "utf8",
)
const STATEMENTS = SQL.split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")

describe("the migration that records the installations that already run as first-party installs", () => {
    it("writes only into the license and install tables of the templates, so no agent graph, rule or installation changes", () => {
        const writes = [
            ...STATEMENTS.matchAll(
                /\b(INSERT INTO|UPDATE|DELETE FROM|ALTER TABLE|DROP|TRUNCATE)\s+(?:public\.)?(\w+)?/gi,
            ),
        ]

        expect(writes.map((write) => `${write[1]?.toUpperCase()} ${write[2]}`).sort()).toEqual([
            "INSERT INTO template_installs",
            "INSERT INTO template_licenses",
        ])
        expect(STATEMENTS).not.toMatch(/agent_graph|authority_rules|agents\b/i)
    })

    it("reads the installations without locking or changing them, and skips an installation that already has provenance, so a rerun adds nothing", () => {
        expect(STATEMENTS).toMatch(/FROM public\.module_installations i/)
        expect(STATEMENTS).toMatch(
            /NOT EXISTS \(SELECT 1 FROM public\.template_installs t WHERE t\.installation_id = i\.id\)/,
        )
        expect(STATEMENTS).not.toMatch(/FOR UPDATE/i)
    })

    it("adopts at version 1 of the key nivo-<module> with a free active license and no parameter values, only for modules the catalogue mirror lists", () => {
        expect(STATEMENTS).toMatch(/'nivo-' \|\| i\.module_key/)
        expect(STATEMENTS).toMatch(/'free'/)
        expect(STATEMENTS).toMatch(/'active'/)
        expect(STATEMENTS).toMatch(/, 1, '\{\}'::jsonb,/)
        expect(STATEMENTS).toMatch(/JOIN public\.modules m ON m\.key = i\.module_key/)
    })
})
