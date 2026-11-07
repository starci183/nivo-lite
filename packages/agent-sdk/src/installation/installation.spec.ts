import { SdkDefinitionError } from "../block/definition-error"
import { runNode } from "../node/host"
import { LIST, STACK } from "../spec/spec.fixture"
import { EXAMPLE_TURN } from "../tests/fixtures/node-examples"
import { scriptedNodePorts } from "../tests/fixtures/node-ports"
import { defineInstallation } from "./installation"
import { entityOf, jobOf, moduleOf, nodeOf } from "./installation.fixture"

const HASH = "abc123"

/** The error a call throws. */
function captured(call: () => unknown): unknown {
    try {
        call()
    } catch (error) {
        return error
    }
    return undefined
}

describe("defineInstallation", () => {
    it("joins the lists of every part in part order and keeps the hash it is given", () => {
        const sales = moduleOf("sales")
        const crm = moduleOf("crm")
        const node = nodeOf("lead.ensure")
        const installation = defineInstallation(
            [
                { modules: [sales], blocks: [STACK], jobs: [jobOf("sales.notice")] },
                { modules: [crm], blocks: [LIST], nodes: [node], entities: [entityOf("sales.lead")] },
            ],
            HASH,
        )
        expect(installation).toEqual({
            modules: [sales, crm],
            blocks: [STACK, LIST],
            nodes: [node],
            jobs: [jobOf("sales.notice")],
            entities: [entityOf("sales.lead")],
            registryHash: HASH,
        })
    })

    it("accepts no parts, and parts that list nothing", () => {
        const empty = { modules: [], blocks: [], nodes: [], jobs: [], entities: [], registryHash: HASH }
        expect(defineInstallation([], HASH)).toEqual(empty)
        expect(defineInstallation([{}, {}], HASH)).toEqual(empty)
    })

    it("refuses a module key two parts share, naming the kind and the key", () => {
        const twice = (): unknown =>
            defineInstallation([{ modules: [moduleOf("sales")] }, { modules: [moduleOf("sales")] }], HASH)
        expect(captured(twice)).toBeInstanceOf(SdkDefinitionError)
        expect(captured(twice)).toMatchObject({ code: "INSTALLATION_ID_DUPLICATE", at: "module:sales" })
    })

    it("refuses a read or an action id that is declared twice, though the module keys differ", () => {
        const sales = moduleOf("sales")
        const crm = moduleOf("crm")
        const readTwin = { ...crm, reads: sales.reads }
        const actionTwin = { ...crm, actions: sales.actions }
        expect(captured(() => defineInstallation([{ modules: [sales, readTwin] }], HASH))).toMatchObject({
            code: "INSTALLATION_ID_DUPLICATE",
            at: "read:sales.people",
        })
        expect(captured(() => defineInstallation([{ modules: [sales, actionTwin] }], HASH))).toMatchObject({
            code: "INSTALLATION_ID_DUPLICATE",
            at: "action:sales.open",
        })
    })

    it("refuses a block, node, job or entity id that two parts, or one part twice, declare", () => {
        expect(captured(() => defineInstallation([{ blocks: [STACK] }, { blocks: [STACK] }], HASH))).toMatchObject({
            code: "INSTALLATION_ID_DUPLICATE",
            at: "block:test.stack",
        })
        expect(
            captured(() => defineInstallation([{ nodes: [nodeOf("lead.ensure"), nodeOf("lead.ensure")] }], HASH)),
        ).toMatchObject({ at: "node:lead.ensure" })
        expect(
            captured(() =>
                defineInstallation([{ jobs: [jobOf("sales.notice")] }, { jobs: [jobOf("sales.notice")] }], HASH),
            ),
        ).toMatchObject({ at: "job:sales.notice" })
        expect(
            captured(() => defineInstallation([{ entities: [entityOf("sales.lead"), entityOf("sales.lead")] }], HASH)),
        ).toMatchObject({ at: "entity:sales.lead" })
    })

    it("lets the same id stand in two kinds, since each kind is its own registry", () => {
        const both = (): unknown =>
            defineInstallation([{ jobs: [jobOf("sales.lead")], entities: [entityOf("sales.lead")] }], HASH)
        expect(both).not.toThrow()
    })
})

describe("the fixture node", () => {
    it("does nothing and answers an empty output", async () => {
        const { ports } = scriptedNodePorts()
        const request = {
            node: nodeOf("lead.ensure"),
            params: {},
            input: {},
            turn: EXAMPLE_TURN,
            grant: { rights: [] },
            effects: new Map(),
            tools: new Map(),
            key: "run-1:step",
        }
        await expect(runNode(request, ports)).resolves.toEqual({ output: {}, effects: [] })
    })
})
