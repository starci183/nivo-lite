import { ENGINE_TOOL_LABELS, TOOL } from "@nivo-lite/agent-sdk/names"
import type { ToolDefinition } from "@nivo-lite/agent-sdk/node"
import type { z } from "zod"
import { templateToolLookupOf, writesTool } from "@modules/domain/agent-graphs/policies/template-lookups.policy"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { engineToolsJoined } from "@modules/domain/installed-plugins/installed-plugins.policy"
import { EinvoiceGetSchema, EinvoiceListSchema } from "@modules/domain/tools/adapters/einvoice-native.schema"
import {
    CONTACT_GET_SCHEMA,
    CONTACT_LINK_SCHEMA,
    CONTACT_MERGE_SCHEMA,
    CONTACT_REMEMBER_SCHEMA,
    CONTACT_SEARCH_SCHEMA,
    CONTACT_UPDATE_SCHEMA,
} from "@modules/domain/contact-tools/contact-tools.schema"
import { MAIL_GET_SCHEMA, MAIL_LIST_SCHEMA } from "@modules/domain/native-tools/mail-native.schema"
import { FILE_GET_SCHEMA, FILE_LINK_SCHEMA, FILE_PUT_SCHEMA } from "@modules/domain/native-tools/file-native.schema"
import {
    RECORD_CREATE_SCHEMA,
    RECORD_GET_SCHEMA,
    RECORD_LIST_SCHEMA,
    RECORD_UPDATE_SCHEMA,
} from "@modules/domain/native-tools/record-native.schema"
import { NATIVE_TOOL_DEFINITIONS } from "./native-tool-definitions.policy"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"
import { toolSpecOf } from "./tool-specs.policy"

/*
 * The engine's definitions of its native tools no package defines (the mail and e-invoice reads, the contacts): every reader knows them
 * as installed tools, the engine's specs hold whether they write, and the args a definition takes are the args its native takes
 * (member by member); the ids the door fills for a locked read (`contact.get`'s conversation and contact) are no member of a definition.
 */

/** The contact tools that write, in the order the definitions list them. */
const CONTACT_WRITES = [TOOL.contactUpdate, TOOL.contactMemoryRemember, TOOL.contactIdentityLink, TOOL.contactMerge]

/** The record and file tools: default for every node, scoped to the calling agent; the writes among them, in listing order. */
const RECORD_AND_FILE_TOOLS = [
    TOOL.recordGet,
    TOOL.recordList,
    TOOL.recordCreate,
    TOOL.recordUpdate,
    TOOL.filePut,
    TOOL.fileLink,
    TOOL.fileGet,
]
const RECORD_AND_FILE_WRITES = [TOOL.recordCreate, TOOL.recordUpdate, TOOL.filePut, TOOL.fileLink]

const ENGINE_TOOLS = [
    TOOL.mailMessageList,
    TOOL.mailMessageGet,
    TOOL.einvoiceList,
    TOOL.einvoiceGet,
    TOOL.contactGet,
    TOOL.contactSearch,
    // Owner ruling R26 (Opus-M cut-over 04:52): the conversation read is served by the ENGINE, no plugin; the channel profile read beside it.
    TOOL.conversationMessageList,
    TOOL.customerProfileGet,
    ...CONTACT_WRITES,
    ...RECORD_AND_FILE_TOOLS,
]

const definitionOf = (id: string): ToolDefinition => {
    const found = NATIVE_TOOL_DEFINITIONS.find((tool) => tool.id === id)
    if (found === undefined)
        throw new TestWorldError({
            code: TestWorldErrorCode.RowMissing,
            params: { what: `no engine definition of ${id}` },
        })
    return found
}

const takes = (schema: z.ZodType, args: unknown): boolean => schema.safeParse(args).success

const MAILBOX = "8f8f2c1e-0000-4000-8000-00000000c001"
const CONTACT = "8f8f2c1e-0000-4000-8000-00000000c003"

/** Per tool, the native's validator and argument probes, member by member, with whether the native takes each. */
const PROBES: ReadonlyArray<{
    readonly id: string
    readonly native: z.ZodType
    readonly cases: ReadonlyArray<readonly [unknown, boolean]>
}> = [
    {
        id: TOOL.mailMessageList,
        native: MAIL_LIST_SCHEMA,
        cases: [
            [{}, true],
            [{ mailbox: MAILBOX, after: "abc", limit: 25 }, true],
            [{ mailbox: "box-1" }, false],
            [{ after: "abc" }, false],
            [{ mailbox: MAILBOX, after: "ab" }, false],
            [{ mailbox: MAILBOX, after: "a".repeat(121) }, false],
            [{ limit: 0 }, false],
            [{ limit: 26 }, false],
            [{ limit: 1.5 }, false],
            [{ folder: "inbox" }, false],
        ],
    },
    {
        id: TOOL.mailMessageGet,
        native: MAIL_GET_SCHEMA,
        cases: [
            [{ id: MAILBOX }, true],
            [{ id: MAILBOX, maxChars: 12_000 }, true],
            [{}, false],
            [{ id: "mail-1" }, false],
            [{ id: MAILBOX, maxChars: 499 }, false],
            [{ id: MAILBOX, maxChars: 12_001 }, false],
            [{ id: MAILBOX, mark: true }, false],
        ],
    },
    {
        id: TOOL.einvoiceList,
        native: EinvoiceListSchema,
        cases: [
            [{}, true],
            [{ since: "2026-11-01", limit: 50 }, true],
            [{ since: "2026-11" }, false],
            [{ since: "2026-11-01T00:00" }, false],
            [{ limit: 0 }, false],
            [{ limit: 51 }, false],
            [{ seller: "x" }, false],
        ],
    },
    {
        id: TOOL.einvoiceGet,
        native: EinvoiceGetSchema,
        cases: [
            [{ id: "rec-0009:0" }, true],
            [{}, false],
            [{ id: "" }, false],
            [{ id: "x".repeat(201) }, false],
            [{ id: "a", lines: true }, false],
        ],
    },
    {
        id: TOOL.contactGet,
        native: CONTACT_GET_SCHEMA,
        cases: [
            [{}, true],
            [{ limit: 3 }, false],
            [{ phone: "0900" }, false],
        ],
    },
    {
        id: TOOL.contactSearch,
        native: CONTACT_SEARCH_SCHEMA,
        cases: [
            [{ query: "0912 345 678" }, true],
            [{ contactId: CONTACT, limit: 20 }, true],
            [{}, true],
            [{ query: "" }, false],
            [{ limit: 21 }, false],
            [{ query: "lan", name: "x" }, false],
        ],
    },
    {
        id: TOOL.contactUpdate,
        native: CONTACT_UPDATE_SCHEMA,
        cases: [
            [{ displayName: "Lan", tags: ["vip"] }, true],
            [{ displayName: null }, true],
            [{ contactId: CONTACT, tags: [] }, true],
            [{ displayName: "" }, false],
            [{ tags: ["x".repeat(41)] }, false],
            [{ stage: "won" }, false],
        ],
    },
    {
        id: TOOL.contactMemoryRemember,
        native: CONTACT_REMEMBER_SCHEMA,
        cases: [
            [{ facts: { address: "12 L\u00ea L\u1ee3i" } }, true],
            [{ contactId: CONTACT, facts: {} }, true],
            [{}, false],
            [{ facts: { address: "x" }, source: "chat" }, false],
        ],
    },
    {
        id: TOOL.contactIdentityLink,
        native: CONTACT_LINK_SCHEMA,
        cases: [
            [{ kind: "phone", value: "0912345678" }, true],
            [{ kind: "external", value: "ACME", account: MAILBOX, contactId: CONTACT }, true],
            [{ token: "abcdefgh12" }, true],
            [{ kind: "channel", value: "z-1" }, false],
            [{ kind: "external", value: "ACME", account: "acc-1" }, false],
            [{ token: "short" }, false],
        ],
    },
    {
        id: TOOL.recordGet,
        native: RECORD_GET_SCHEMA,
        cases: [
            [{ type: "video.project", id: "r1" }, true],
            [{ type: "video.project" }, false],
            [{ type: "x", id: "r1" }, false],
            [{ type: "video.project", id: "r1", extra: 1 }, false],
        ],
    },
    {
        id: TOOL.recordList,
        native: RECORD_LIST_SCHEMA,
        cases: [
            [{ type: "video.project" }, true],
            [{ type: "video.project", limit: 10 }, true],
            [{ type: "video.project", limit: 0 }, false],
            [{ limit: 10 }, false],
        ],
    },
    {
        id: TOOL.recordCreate,
        native: RECORD_CREATE_SCHEMA,
        cases: [
            [{ type: "video.project", values: { title: "x" } }, true],
            [{ type: "video.project" }, false],
            [{ values: {} }, false],
        ],
    },
    {
        id: TOOL.recordUpdate,
        native: RECORD_UPDATE_SCHEMA,
        cases: [
            [{ type: "video.project", id: "r1", patch: { title: "y" } }, true],
            [{ type: "video.project", id: "r1" }, false],
            [{ type: "video.project", patch: {} }, false],
        ],
    },
    {
        id: TOOL.filePut,
        native: FILE_PUT_SCHEMA,
        cases: [
            [{ type: "video.project", id: "r1", field: "clip", url: "https://example.com/a.mp4", name: "a.mp4" }, true],
            [{ type: "video.project", id: "r1", field: "clip", staged: "ws/staged/c1", name: "a.mp4" }, true],
            [{ type: "video.project", id: "r1", field: "clip", name: "a.mp4" }, false],
            [
                {
                    type: "video.project",
                    id: "r1",
                    field: "clip",
                    staged: "s",
                    url: "https://example.com/a.mp4",
                    name: "a.mp4",
                },
                false,
            ],
        ],
    },
    {
        id: TOOL.fileLink,
        native: FILE_LINK_SCHEMA,
        cases: [
            [{ type: "video.project", id: "r1", field: "clip", key: "ws/k", name: "a.mp4" }, true],
            [{ type: "video.project", id: "r1", field: "clip", name: "a.mp4" }, false],
        ],
    },
    {
        id: TOOL.fileGet,
        native: FILE_GET_SCHEMA,
        cases: [
            [{ type: "video.project", id: "r1", field: "clip" }, true],
            [{ type: "video.project", id: "r1" }, false],
        ],
    },
    {
        id: TOOL.contactMerge,
        native: CONTACT_MERGE_SCHEMA,
        cases: [
            [{ intoContactId: CONTACT, fromContactId: MAILBOX }, true],
            [{ intoContactId: CONTACT }, false],
            [{ intoContactId: CONTACT, fromContactId: MAILBOX, reason: "same" }, false],
        ],
    },
]

describe("the engine's definitions of its native tools", () => {
    it("defines exactly the engine's own native tools, each once", () => {
        expect(NATIVE_TOOL_DEFINITIONS.map((tool) => tool.id).sort()).toEqual([...ENGINE_TOOLS].sort())
    })

    it("are known to every reader of the installation as installed tools, the engine's own", () => {
        const lookup = templateToolLookupOf()
        for (const id of ENGINE_TOOLS) {
            expect(INSTALLED.toolOf(id)).toBe(definitionOf(id))
            expect(INSTALLED.nodeInstall().tools.filter((tool) => tool.id === id)).toEqual([definitionOf(id)])
            expect(lookup.known(id)).toBe(true)
        }
    })

    it("write only where the engine's spec says so: the contact, record and file writes write, the reads do not", () => {
        expect(ENGINE_TOOLS.filter((id) => writesTool(id))).toEqual([...CONTACT_WRITES, ...RECORD_AND_FILE_WRITES])
        expect(ENGINE_TOOLS.filter((id) => definitionOf(id).mutates)).toEqual([
            ...CONTACT_WRITES,
            ...RECORD_AND_FILE_WRITES,
        ])
    })

    it("leave a contact write's mode to its node: its spec is a plain write", () => {
        for (const id of CONTACT_WRITES) expect(toolSpecOf(id)?.mutates).toBe(true)
    })

    it("are titled for the model by the engine's own label line, the one the installation lists", () => {
        for (const id of ENGINE_TOOLS) {
            expect(definitionOf(id).title).toEqual(ENGINE_TOOL_LABELS[id]?.summary)
            expect(INSTALLED.toolLabelOf(id)?.summary).toEqual(ENGINE_TOOL_LABELS[id]?.summary)
        }
    })

    it.each(PROBES.map((probe) => [probe.id, probe] as const))(
        "%s: takes the args its native takes, member by member",
        (_id, probe) => {
            const definition = definitionOf(probe.id)
            for (const [args, native] of probe.cases) {
                expect([args, takes(probe.native, args)]).toEqual([args, native])
                expect([args, takes(definition.args, args)]).toEqual([args, native])
            }
        },
    )

    it("refuses an installation whose plugin defines an engine tool again, naming it", () => {
        const [one] = NATIVE_TOOL_DEFINITIONS
        if (one === undefined)
            throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "no definition" } })
        expect(() => engineToolsJoined([one], NATIVE_TOOL_DEFINITIONS)).toThrow(one.id)
        expect(engineToolsJoined([], NATIVE_TOOL_DEFINITIONS)).toEqual(NATIVE_TOOL_DEFINITIONS)
    })
})
