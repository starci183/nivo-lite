import { Test } from "@nestjs/testing"
import { N8nHostErrorCode } from "./errors/n8n-host.error"
import type { N8nHostOptions } from "./n8n-host.options"
import { idsByName, importDocument, isWorkflowFile, sshArguments, workflowsOf } from "./n8n-host.policy"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}
const POLICY = Symbol("./n8n-host.policy")
type PolicySubject = {
    isWorkflowFile: typeof isWorkflowFile
    workflowsOf: typeof workflowsOf
    idsByName: typeof idsByName
    importDocument: typeof importDocument
    sshArguments: typeof sshArguments
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: POLICY, useValue: { isWorkflowFile, workflowsOf, idsByName, importDocument, sshArguments } },
        ],
    }).compile()
    const subject = moduleRef.get<PolicySubject>(POLICY)
    return { subject }
}

const TARGET: Pick<N8nHostOptions, "host" | "user"> = {
    host: "vps.example",
    user: "nivo",
}

describe("isWorkflowFile", () => {
    it("accepts a named workflow with a list of nodes", async () => {
        const { subject } = await buildSubject()

        expect(subject.isWorkflowFile({ name: "Daily", nodes: [] })).toBe(true)
    })

    it.each([
        null,
        "text",
        {},
        { name: "", nodes: [] },
        { name: 3, nodes: [] },
        { name: "x" },
        { name: "x", nodes: "no" },
    ])("refuses %p", async (value) => {
        const { subject } = await buildSubject()

        expect(subject.isWorkflowFile(value)).toBe(false)
    })
})

describe("workflowsOf", () => {
    it("answers the files as workflows", async () => {
        const { subject } = await buildSubject()

        const file = { name: "Daily", nodes: [{}] }

        expect(subject.workflowsOf([file])).toEqual([file])
    })

    it("refuses an empty list", async () => {
        const { subject } = await buildSubject()

        expect(thrownBy(() => subject.workflowsOf([]))).toEqual(objectLike({ code: N8nHostErrorCode.NoWorkflows }))
    })

    it("refuses a file that is not a workflow", async () => {
        const { subject } = await buildSubject()

        expect(thrownBy(() => subject.workflowsOf([{ name: "Daily", nodes: [] }, { nodes: [] }]))).toEqual(
            objectLike({ code: N8nHostErrorCode.WorkflowInvalid }),
        )
    })
})

describe("idsByName", () => {
    it("reads the id and the name of each listed line and skips the others", async () => {
        const { subject } = await buildSubject()

        const listing = "abc|Daily report\n  \nnoise without separator\n  def | Debt reminder\n"

        expect([...subject.idsByName(listing)]).toEqual([
            ["Daily report", "abc"],
            [" Debt reminder", "def "],
        ])
    })
})

describe("importDocument", () => {
    it("deactivates every workflow and carries the id of the one it replaces", async () => {
        const { subject } = await buildSubject()

        const document = subject.importDocument([
            { workflow: { name: "A", nodes: [], extra: 1 }, id: "7" },
            { workflow: { name: "B", nodes: [] }, id: "" },
        ])

        expect(document).toBe(
            '[{"name":"A","nodes":[],"extra":1,"id":"7","active":false},{"name":"B","nodes":[' + '],"active":false}]',
        )
    })
})

describe("sshArguments", () => {
    it("reaches the host with the key and runs the command", async () => {
        const { subject } = await buildSubject()

        expect(subject.sshArguments(TARGET, "docker ps", "/keys/id", undefined)).toEqual([
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

    it("adds the known-hosts file when one is set", async () => {
        const { subject } = await buildSubject()

        expect(subject.sshArguments(TARGET, "ls", "/keys/id", "/keys/known")).toContain(
            "UserKnownHostsFile=/keys/known",
        )
    })

    it("leaves the host part empty when none is configured", async () => {
        const { subject } = await buildSubject()

        expect(subject.sshArguments({ ...TARGET, host: undefined }, "ls", "/keys/id", undefined)).toContain("nivo@")
    })
})
