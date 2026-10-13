import { N8nHostErrorCode } from "./errors/n8n-host.error"
import type { N8nHostOptions } from "./n8n-host.options"
import { idsByName, importDocument, isWorkflowFile, sshArguments, workflowsOf } from "./n8n-host.policy"

const TARGET: N8nHostOptions = {
    host: "vps.example",
    user: "nivo",
    keyPath: "/keys/id",
    knownHostsPath: undefined,
    container: "n8n-1",
}

describe("isWorkflowFile", () => {
    it("accepts a named workflow with a list of nodes", () => {
        expect(isWorkflowFile({ name: "Daily", nodes: [] })).toBe(true)
    })

    it.each([
        null,
        "text",
        {},
        { name: "", nodes: [] },
        { name: 3, nodes: [] },
        { name: "x" },
        { name: "x", nodes: "no" },
    ])("refuses %p", (value) => {
        expect(isWorkflowFile(value)).toBe(false)
    })
})

describe("workflowsOf", () => {
    it("answers the files as workflows", () => {
        const file = { name: "Daily", nodes: [{}] }

        expect(workflowsOf([file])).toEqual([file])
    })

    it("refuses an empty list", () => {
        expect(() => workflowsOf([])).toThrow(expect.objectContaining({ code: N8nHostErrorCode.NoWorkflows }))
    })

    it("refuses a file that is not a workflow", () => {
        expect(() => workflowsOf([{ name: "Daily", nodes: [] }, { nodes: [] }])).toThrow(
            expect.objectContaining({ code: N8nHostErrorCode.WorkflowInvalid }),
        )
    })
})

describe("idsByName", () => {
    it("reads the id and the name of each listed line and skips the others", () => {
        const listing = "abc|Daily report\n  \nnoise without separator\n  def | Debt reminder\n"

        expect([...idsByName(listing)]).toEqual([
            ["Daily report", "abc"],
            [" Debt reminder", "def "],
        ])
    })
})

describe("importDocument", () => {
    it("deactivates every workflow and carries the id of the one it replaces", () => {
        const document = importDocument([
            { workflow: { name: "A", nodes: [], extra: 1 }, id: "7" },
            { workflow: { name: "B", nodes: [] }, id: "" },
        ])

        expect(document).toBe(
            '[{"name":"A","nodes":[],"extra":1,"id":"7","active":false},{"name":"B","nodes":[],"active":false}]',
        )
    })
})

describe("sshArguments", () => {
    it("reaches the host with the key and runs the command", () => {
        expect(sshArguments(TARGET, "docker ps")).toEqual([
            "-i",
            "/keys/id",
            "-o",
            "BatchMode=yes",
            "-o",
            "StrictHostKeyChecking=accept-new",
            "nivo@vps.example",
            "docker ps",
        ])
    })

    it("adds the known-hosts file when one is set", () => {
        expect(sshArguments({ ...TARGET, knownHostsPath: "/keys/known" }, "ls")).toContain(
            "UserKnownHostsFile=/keys/known",
        )
    })

    it("leaves the host part empty when none is configured", () => {
        expect(sshArguments({ ...TARGET, host: undefined }, "ls")).toContain("nivo@")
    })
})
