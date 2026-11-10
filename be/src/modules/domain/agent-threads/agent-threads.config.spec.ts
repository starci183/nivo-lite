import { EnvSource } from "@modules/platform/config"
import { parseAgentThreadsConfig } from "./agent-threads.config"

describe("parseAgentThreadsConfig", () => {
    it("leaves every tunable to its default when nothing is set (every workflow runs on threads: no list, no engine to choose)", () => {
        expect(parseAgentThreadsConfig(new EnvSource({}))).toEqual({
            graphsMax: undefined,
            approvalDeadlineMs: undefined,
            ownerDeadlineMs: undefined,
            doors: true,
        })
    })

    it("reads the bound of built graphs and the windows of the stops' deadlines", () => {
        expect(
            parseAgentThreadsConfig(
                new EnvSource({
                    AGENT_THREADS_GRAPHS_MAX: "50",
                    AGENT_THREADS_APPROVAL_DEADLINE_MS: "60000",
                    AGENT_THREADS_OWNER_DEADLINE_MS: "120000",
                }),
            ),
        ).toEqual({ graphsMax: 50, approvalDeadlineMs: 60_000, ownerDeadlineMs: 120_000, doors: true })
    })

    it.each([{ AGENT_THREADS_WORKFLOWS: "sales.ghost" }, { AGENT_ENGINE: "legacy" }])(
        "reads no other key: a stale engine switch in the env changes nothing (%p)",
        (values) => {
            expect(parseAgentThreadsConfig(new EnvSource(values))).toEqual(parseAgentThreadsConfig(new EnvSource({})))
        },
    )
})
