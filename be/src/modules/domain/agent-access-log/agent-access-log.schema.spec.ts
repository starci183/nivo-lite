import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { ACCESS_STATES } from "./agent-access-log.contracts"

// The table's check constraints and the code's access vocabulary must be the same set: a value the code records that the constraint
// refuses fails every binding at the database (MX-CORE D2-1), which a store fake never shows. The real-database proof is the
// integration spec `tests/integration/agent-access-log`; this one reads the migrations so the agreement holds without a database.

const MIGRATIONS = join(__dirname, "../../../../../db/migrations")

/** The text literals the LAST migration that defines this constraint allows, read from its CHECK clause. */
const allowedBy = (constraint: string): ReadonlyArray<string> => {
    const definitions = readdirSync(MIGRATIONS)
        .filter((file) => file.endsWith(".sql"))
        .toSorted()
        .flatMap((file) =>
            readFileSync(join(MIGRATIONS, file), "utf8")
                .split("\n")
                .filter((line) => line.includes(`CONSTRAINT ${constraint} CHECK`)),
        )
    const last = definitions.at(-1) ?? ""
    return [...last.matchAll(/'([^']*)'::text/g)].map((match) => match[1] ?? "").toSorted()
}

describe("agent_access_log check constraints", () => {
    it.each(["agent_access_log_before_access_check", "agent_access_log_after_access_check"])(
        "%s allows exactly the access states the code records",
        (constraint) => {
            expect(allowedBy(constraint)).toEqual([...ACCESS_STATES].toSorted())
        },
    )
})
