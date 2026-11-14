import { Test } from "@nestjs/testing"
import { ConnectionsError } from "@modules/domain/connections"
import { ENTERPRISE_SEED_SCHEMA } from "./enterprise-seed.contracts"
import { placeOf, readEnterpriseSeeds, targetIncludes } from "./enterprise-seed.policy"

const SUBJECT = Symbol("./enterprise-seed.policy")
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { placeOf, readEnterpriseSeeds, targetIncludes } }],
    }).compile()
    return moduleRef.get<typeof import("./enterprise-seed.policy")>(SUBJECT)
}

const DOCUMENT = {
    schema: ENTERPRISE_SEED_SCHEMA,
    identifier: "nivo-web",
    target: "off",
    workspaceName: " NIVO Web ",
    ownerWorkspace: "NIVO",
}
const SEED = { identifier: "nivo-web", target: "off", workspaceName: "NIVO Web", ownerWorkspace: "NIVO" }

const envelope = (...documents: ReadonlyArray<unknown>): string =>
    `${JSON.stringify({ documents: documents.map((document) => ({ path: "data/enterprises/x.json", document })) })}\n`

const refusalOf = (read: () => unknown): unknown => {
    try {
        read()
    } catch (error) {
        return error
    }
    return null
}

describe("readEnterpriseSeeds", () => {
    it.each(["off", "local", "prod", "both"] as const)(
        "reads an enterprise of target %s from the envelope",
        async (target) => {
            const policy = await build()

            expect(policy.readEnterpriseSeeds(envelope({ ...DOCUMENT, target }))).toEqual([{ ...SEED, target }])
        },
    )

    it("reads every enterprise in order, and one bare document piped in by hand", async () => {
        const policy = await build()

        expect(policy.readEnterpriseSeeds(envelope(DOCUMENT, { ...DOCUMENT, identifier: "acme" }))).toEqual([
            SEED,
            { ...SEED, identifier: "acme" },
        ])
        expect(policy.readEnterpriseSeeds(JSON.stringify(DOCUMENT))).toEqual([SEED])
    })

    it.each([
        ["schema", { schema: "nivo/management-seed@1" }],
        ["identifier", { identifier: "NIVO Web" }],
        ["identifier", { identifier: "-nivo" }],
        ["target", { target: "dev" }],
        ["workspaceName", { workspaceName: "  " }],
        ["ownerWorkspace", { ownerWorkspace: "x".repeat(121) }],
        ["document", { enabled: true }],
    ])("refuses a document by the name of its wrong field %s", async (field, change) => {
        const policy = await build()

        const refusal = refusalOf(() => policy.readEnterpriseSeeds(envelope({ ...DOCUMENT, ...change })))

        expect(refusal).toBeInstanceOf(ConnectionsError)
        expect(refusal).toMatchObject({ params: { field } })
    })

    it("refuses two documents of one identifier, a document that is no object, and text that is no JSON", async () => {
        const policy = await build()

        expect(refusalOf(() => policy.readEnterpriseSeeds(envelope(DOCUMENT, DOCUMENT)))).toMatchObject({
            params: { field: "identifier" },
        })
        expect(refusalOf(() => policy.readEnterpriseSeeds(envelope(null)))).toMatchObject({
            params: { field: "document" },
        })
        expect(refusalOf(() => policy.readEnterpriseSeeds("{"))).toMatchObject({ params: { field: "input" } })
    })
})

describe("placeOf", () => {
    it("maps dev to the local stack and production to prod, and refuses any other environment", async () => {
        const policy = await build()

        expect(policy.placeOf("dev")).toBe("local")
        expect(policy.placeOf("production")).toBe("prod")
        expect(refusalOf(() => policy.placeOf("staging"))).toMatchObject({ params: { field: "env" } })
    })
})

describe("targetIncludes", () => {
    it.each([
        ["off", "local", false],
        ["off", "prod", false],
        ["local", "local", true],
        ["local", "prod", false],
        ["prod", "local", false],
        ["prod", "prod", true],
        ["both", "local", true],
        ["both", "prod", true],
    ] as const)("target %s on %s: %s", async (target, place, expected) => {
        const policy = await build()

        expect(policy.targetIncludes(target, place)).toBe(expected)
    })
})
