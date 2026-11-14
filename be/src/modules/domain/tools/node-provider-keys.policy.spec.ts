import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OPENAPI_PROVIDER } from "@modules/domain/openapi-tools"
import { pinnedMetaOf } from "@modules/domain/openapi-tools/openapi-account.policy"
import { type ConnectionMetaReader, accountsAsNodesName as accountsAsNodesNameSubject, keyUnder as keyUnderSubject, namedAccountsOf as namedAccountsOfSubject, nodeKeysOf as nodeKeysOfSubject, nodeProviderKeyOf as nodeProviderKeyOfSubject } from "./node-provider-keys.policy"

/** The provider key of the CRM the accounts are pinned to: nodes list it in `accounts` (`PROVIDER.crm("nivoweb")`). */
const CRM = "crm.nivoweb"

const SUBJECT = Symbol("node-provider-keys.policy")

/** The functions of the policy under test, as Nest provides them. */
interface Subject {
    readonly accountsAsNodesName: typeof accountsAsNodesNameSubject
    readonly keyUnder: typeof keyUnderSubject
    readonly namedAccountsOf: typeof namedAccountsOfSubject
    readonly nodeKeysOf: typeof nodeKeysOfSubject
    readonly nodeProviderKeyOf: typeof nodeProviderKeyOfSubject
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: mock<Subject>({
                    accountsAsNodesName: accountsAsNodesNameSubject,
                    keyUnder: keyUnderSubject,
                    namedAccountsOf: namedAccountsOfSubject,
                    nodeKeysOf: nodeKeysOfSubject,
                    nodeProviderKeyOf: nodeProviderKeyOfSubject,
                }),
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

/** The facts of an OpenAPI account pinned to a CRM (its provider key, `crm.<id>`). */
const pinnedTo = (source: string): Readonly<Record<string, string>> =>
    pinnedMetaOf(
        {
            connector: source,
            swaggerUrl: "",
            workspaceHeader: "X-Nivo-Workspace",
            documentSha256: "b".repeat(64),
            live: false,
            pinnedBy: "owner",
            pinnedAt: "2026-11-12T00:00:00.000Z",
        },
        "{}",
    )

const ACCOUNTS = [
    { connectionId: "z1", provider: "zalo_oa" },
    { connectionId: "api-crm", provider: OPENAPI_PROVIDER },
    { connectionId: "api-bare", provider: OPENAPI_PROVIDER },
]

/** A reader of connections: `api-crm` pinned to the CRM, `api-bare` connected with no pin; every read is counted. */
const readerOf = (): ConnectionMetaReader & { readonly read: Array<string> } => {
    const read: Array<string> = []
    return {
        read,
        recordOf: (_workspaceId, connectionId) => {
            read.push(connectionId)
            if (connectionId === "api-crm") return Promise.resolve({ meta: pinnedTo(CRM) })
            if (connectionId === "api-bare") return Promise.resolve({ meta: { config: "{}" } })
            return Promise.resolve(null)
        },
    }
}

describe("nodeProviderKeyOf: the provider key of an attached account as nodes name it", () => {
    let nodeProviderKeyOf: typeof nodeProviderKeyOfSubject

    beforeAll(async () => {
        ;({ nodeProviderKeyOf } = await build())
    })

    it("names an OpenAPI account by the CRM its pin was made for (crm.<id>), any other by its provider", () => {
        expect(nodeProviderKeyOf(OPENAPI_PROVIDER, pinnedTo(CRM))).toBe(CRM)
        expect(nodeProviderKeyOf(OPENAPI_PROVIDER, pinnedTo("crm.shopcrm"))).toBe("crm.shopcrm")
        expect(nodeProviderKeyOf("zalo_oa", null)).toBe("zalo_oa")
        expect(nodeProviderKeyOf("sepay", pinnedTo(CRM))).toBe("sepay")
    })

    it("names an OpenAPI account with no pin, or no readable facts, by none", () => {
        expect(nodeProviderKeyOf(OPENAPI_PROVIDER, null)).toBeNull()
        expect(nodeProviderKeyOf(OPENAPI_PROVIDER, { config: "{}" })).toBeNull()
    })
})

describe("the attachments as nodes name them", () => {
    let accountsAsNodesName: typeof accountsAsNodesNameSubject
    let keyUnder: typeof keyUnderSubject
    let namedAccountsOf: typeof namedAccountsOfSubject
    let nodeKeysOf: typeof nodeKeysOfSubject

    beforeAll(async () => {
        ;({ accountsAsNodesName, keyUnder, namedAccountsOf, nodeKeysOf } = await build())
    })

    it("reads the pins of the OpenAPI accounts only, once each", async () => {
        const reader = readerOf()
        const keys = await nodeKeysOf("ws-1", [...ACCOUNTS, { connectionId: "api-crm", provider: OPENAPI_PROVIDER }], reader)

        expect(reader.read.sort()).toEqual(["api-bare", "api-crm"])
        expect(keys).toEqual(
            new Map([
                ["api-crm", CRM],
                ["api-bare", null],
            ]),
        )
        expect(ACCOUNTS.map((account) => keyUnder(account, keys))).toEqual(["zalo_oa", CRM, null])
    })

    it("names a pinned OpenAPI account by its provider and its CRM, an unpinned one by its provider alone (it matches no CRM)", async () => {
        await expect(accountsAsNodesName("ws-1", ACCOUNTS, readerOf())).resolves.toEqual([
            { connectionId: "z1", provider: "zalo_oa" },
            { connectionId: "api-crm", provider: OPENAPI_PROVIDER },
            { connectionId: "api-crm", provider: CRM },
            { connectionId: "api-bare", provider: OPENAPI_PROVIDER },
        ])
    })

    it("keeps every account by its own provider where no reader of connections is bound", async () => {
        await expect(nodeKeysOf("ws-1", ACCOUNTS, undefined)).resolves.toBeUndefined()
        expect(namedAccountsOf(ACCOUNTS, undefined)).toEqual(ACCOUNTS)
    })
})
