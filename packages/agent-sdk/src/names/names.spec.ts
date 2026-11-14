import { isApiVerb, isNamespaced, isToolId, isTriggerVerb } from "../schema/namespaced"
import type { ApiSource, ApiSources } from "./api"
import type { ApiVerb, CoreApiVerb, ProviderKey } from "./index"
import {
    API,
    API_CARRIER,
    NIVO_API,
    PROVIDER,
    PROVIDER_API,
    TOOL,
    TRIGGER,
    apiSegmentOf,
    composeApi,
    crmBasePathOf,
    crmIdOfOp,
    crmIdOfProviderKey,
    crmOpPrefixOf,
    crmProviderKeyOf,
    isCrmId,
    providerKeySchema,
} from "./index"

/**
 * The compile-time refusal a test names: `From` is NOT assignable to `To`. The argument is `true` only when that holds, so a type that
 * becomes assignable stops this file compiling; the answer is what a test reads at run time.
 */
const refusesAtCompileTime = <From, To>(proof: [From] extends [To] ? false : true): boolean => proof

/** The name and value of every enumerable member of an object that holds a string, the way `Object.entries` lists them. */
const stringEntriesOf = (source: object): ReadonlyArray<readonly [string, string]> =>
    Object.entries(source).flatMap((entry): ReadonlyArray<readonly [string, string]> =>
        typeof entry[1] === "string" ? [[entry[0], entry[1]]] : [],
    )

/** A source map that tries to take the engine's place under `nivo`. */
type NivoAsSource = Record<"nivo", Record<"customerFind", "nivo.api.sepay.info">>

/** What `composeApi` takes as its sources. */
type ComposeSources = ApiSources<Readonly<Record<string, ApiSource>>>

describe("the core names", () => {
    it("names every tool by the law of a tool id", () => {
        expect(Object.values(TOOL).filter((id) => !isToolId(id))).toEqual([])
    })

    it("names every trigger by the law of a trigger verb, once", () => {
        const verbs = Object.values(TRIGGER)
        expect(verbs.filter((verb) => !isTriggerVerb(verb))).toEqual([])
        expect(new Set(verbs).size).toBe(verbs.length)
    })

    it("keeps no old constant name (the aliases of the rename are gone): every id once", () => {
        const ids = Object.values(TOOL)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it("keeps the purposes decided for the rename", () => {
        expect(TOOL.customerMessageSend).toBe("nivo.tool.customer.message.send")
        expect(TOOL.driveStatusGet).toBe("nivo.tool.drive.status.get")
        expect(TOOL.mailMessageSend).toBe("nivo.tool.mail.message.send")
        expect(TRIGGER.clockTick).toBe("nivo.trigger.clock.tick")
    })

    it("names the render completion of every compose provider by ONE generic verb, and gives each compose provider its registry reads", () => {
        expect(TRIGGER.videoRenderCompleted).toBe("nivo.trigger.video.render.completed")
        expect([PROVIDER.shotstack, PROVIDER.creatomate, PROVIDER.json2video]).toEqual(["shotstack", "creatomate", "json2video"])
        expect([API.shotstack.config, API.creatomate.rights, API.json2video.config]).toEqual([
            "nivo.api.shotstack.config",
            "nivo.api.creatomate.rights",
            "nivo.api.json2video.config",
        ])
    })

    it("keys every provider as a lower-case word, never a NIVO verb", () => {
        const keys = stringEntriesOf(PROVIDER).map(([, key]) => key)
        expect(keys.filter((key) => !/^[a-z][a-z0-9_]*$/u.test(key))).toEqual([])
        expect(keys.filter((key) => isNamespaced(key))).toEqual([])
        expect(new Set(keys).size).toBe(keys.length)
    })

    it("keys a CRM as `crm.<crmId>`, never among the core keys, and reads the id back from a key or an operation", () => {
        expect(Object.values(PROVIDER)).not.toContain(PROVIDER.crm)
        expect(crmProviderKeyOf("nivoweb")).toBe("crm.nivoweb")
        expect(crmIdOfProviderKey("crm.nivoweb")).toBe("nivoweb")
        expect(crmIdOfProviderKey("zalo_oa")).toBeNull()
        expect(crmIdOfOp("nivo.api.crm.nivoweb.patch.orders.code.status")).toBe("nivoweb")
        expect(crmIdOfOp("nivo.api.sepay.info")).toBeNull()
        expect(crmOpPrefixOf("nivoweb")).toBe("nivo.api.crm.nivoweb.")
        expect([isCrmId("nivoweb"), isCrmId("x"), isCrmId("Nivo")]).toEqual([true, false, false])
    })

    it("PROVIDER.crm keys like crmProviderKeyOf and is a fixed, hidden member", () => {
        const key: string = PROVIDER.crm("nivoweb")
        expect(key).toBe(crmProviderKeyOf("nivoweb"))
        expect(Object.getOwnPropertyDescriptor(PROVIDER, "crm")).toMatchObject({ enumerable: false, writable: false, configurable: false })
        expect(Object.keys(PROVIDER)).not.toContain("crm")
        expect(Reflect.set(PROVIDER, "crm", () => "other")).toBe(false)
    })

    it.each<[string, unknown, string | null]>([
        ["an absolute server url gives its path", { servers: [{ url: "https://shop.example/v1" }] }, "/v1"],
        ["a trailing slash is dropped", { servers: [{ url: "https://shop.example/v1/api/" }] }, "/v1/api"],
        ["a relative server url gives itself", { servers: [{ url: "/v1" }] }, "/v1"],
        ["a server with no path is the root", { servers: [{ url: "https://shop.example" }] }, ""],
        ["no server falls back to the stated base path", { info: { "x-nivo-source": { basePath: "/old" } } }, "/old"],
        ["a document with neither is the root", {}, ""],
        ["a stated base path that is no path is refused", { info: { "x-nivo-source": { basePath: "old" } } }, null],
        ["a non-document is the root", 7, ""],
    ])("crmBasePathOf: %s", (_label, document, basePath) => {
        expect(crmBasePathOf(document)).toBe(basePath)
    })

    it("keys the providers of the generic purposes by their own names, equal to every other provider", () => {
        expect([PROVIDER.inet, PROVIDER.tino, PROVIDER.elevenlabs, PROVIDER.veo]).toEqual(["inet", "tino", "elevenlabs", "veo"])
        expect([PROVIDER.misaAmis, PROVIDER.misaMeinvoice]).toEqual(["misa_amis", "misa_meinvoice"])
        expect(TOOL.domainAvailabilityGet).toBe("nivo.tool.domain.availability.get")
        expect(TOOL.speechGenerate).toBe("nivo.tool.speech.generate")
        expect(TOOL.recordGet).toBe("nivo.tool.record.get")
        // A provider with an account has its registry reads.
        expect(API.misaAmis.config).toBe("nivo.api.misa-amis.config")
    })

    it("accepts the core keys and the source keys given, nothing else", () => {
        expect(PROVIDER.nivo).toBe("nivo")
        expect(providerKeySchema().safeParse(PROVIDER.zaloOa).success).toBe(true)
        expect(providerKeySchema().safeParse("crm").success).toBe(false)
        const source = "smtp" satisfies ProviderKey
        expect(providerKeySchema([source]).safeParse("smtp").success).toBe(true)
        expect(providerKeySchema().safeParse("zalo").success).toBe(false)
        expect(providerKeySchema().safeParse(7).success).toBe(false)
    })
})

describe("the API names (level 1: a person's screen, never a node)", () => {
    const providers = Object.entries(PROVIDER_API)
    const verbs = providers.flatMap(([, reads]) => Object.values<string>(reads))
    const own = Object.values(NIVO_API).flatMap((ops) => Object.values<string>(ops))

    it("names every read by the law of an API verb, once", () => {
        expect([...verbs, ...own].filter((verb) => !isApiVerb(verb))).toEqual([])
        expect(new Set([...verbs, ...own]).size).toBe(verbs.length + own.length)
    })

    it("nests the reads by the provider constant of PROVIDER (or the carrier of the sources), whose key in kebab form is the verb's provider segment", () => {
        const keyOf = (constant: string): string | undefined =>
            constant === API_CARRIER ? API_CARRIER : stringEntriesOf(PROVIDER).find(([name]) => name === constant)?.[1]
        const wrong = providers.flatMap(([constant, reads]) => {
            const key = keyOf(constant)
            if (key === undefined) return [constant]
            return Object.values(reads).filter((verb) => verb.split(".")[2] !== apiSegmentOf(key))
        })
        expect(wrong).toEqual([])
    })

    it("maps a provider key to its segment by one rule: an underscore becomes a dash, nothing else changes", () => {
        expect(apiSegmentOf(PROVIDER.zaloOa)).toBe("zalo-oa")
        expect(apiSegmentOf(PROVIDER.googleDrive)).toBe("google-drive")
        expect(apiSegmentOf(PROVIDER.sepay)).toBe("sepay")
        expect(apiSegmentOf("crm")).toBe("crm")
    })

    it("holds the reads the door serves today: the account's info of the bank feed, the mailbox and the API account, and the registry reads of each catalogued provider", () => {
        expect(API.sepay.info).toBe("nivo.api.sepay.info")
        expect(API.imap.info).toBe("nivo.api.imap.info")
        expect(API.openapi.info).toBe("nivo.api.openapi.info")
        expect(API.zaloOa.config).toBe("nivo.api.zalo-oa.config")
        expect(API.zaloOa.rights).toBe("nivo.api.zalo-oa.rights")
        expect("info" in API.zaloOa).toBe(false)
        // `nivo` has no provider reads (no account): `API.nivo` holds the engine's own operations only.
        expect("nivo" in PROVIDER_API).toBe(false)
    })

    it("names the engine's own file operations under `API.nivo`, apart from every provider read", () => {
        expect(API.nivo).toBe(NIVO_API)
        expect(Object.values(API.nivo.file)).toEqual([
            "nivo.api.nivo.file.upload",
            "nivo.api.nivo.file.confirm",
            "nivo.api.nivo.file.link",
            "nivo.api.nivo.file.get",
            "nivo.api.nivo.file.delete",
        ])
        const declared: ApiVerb = API.nivo.file.upload
        // An engine operation is no provider read: the door's provider-read table is never keyed by it.
        expect(refusesAtCompileTime<typeof API.nivo.file.upload, CoreApiVerb>(true)).toBe(true)
        expect([declared, API.nivo.file.upload].every(isApiVerb)).toBe(true)
        // A source key may not take the engine's place either.
        expect(refusesAtCompileTime<NivoAsSource, ComposeSources>(true)).toBe(true)
    })

    it("composes the core names with a source's generated map under the source key, never over a core provider", () => {
        const source = { customerFind: "nivo.api.sepay.info" } as const satisfies Readonly<Record<string, ApiVerb>>
        const api = composeApi({ crm: source })
        expect(api.crm.customerFind).toBe("nivo.api.sepay.info")
        expect(api.sepay.info).toBe(API.sepay.info)
        // A source key may not take a core provider's place.
        expect(refusesAtCompileTime<Record<"sepay", typeof source>, ComposeSources>(true)).toBe(true)
    })

    it("refuses at compile time a verb no ApiNames key declares", () => {
        const declared: ApiVerb = API.imap.info
        const undeclared = "nivo.api.sepay.transactions"
        // Not a declared API read.
        expect(refusesAtCompileTime<typeof undeclared, ApiVerb>(true)).toBe(true)
        expect([declared, undeclared].every(isApiVerb)).toBe(true)
    })
})
