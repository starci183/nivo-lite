import type { ApiVerb } from "./index"

/**
 * The provider whose account carries every OpenAPI source (`crm`, ...): the door serves a source's generated reads through it, and its own
 * account has the reads of every catalogued provider (`info`, `config`, `rights`). It is a connection kind, not a `PROVIDER` key (a node
 * never lists it: a node lists the source key, `CRM_PROVIDER`), so it is named here, once, for level 1 alone.
 */
export const API_CARRIER = "openapi" as const

/**
 * The provider segment of an API verb (`nivo.api.<segment>.<read>`) for a provider key: the ONE mapping, an underscore becomes a dash
 * (`zalo_oa` gives `zalo-oa`, `google_drive` gives `google-drive`); a key without an underscore is its own segment (`sepay`, a source's
 * `crm`: a source key is kebab-case already, so its generated verbs obey the same mapping).
 */
export const apiSegmentOf = (key: string): string => key.replaceAll("_", "-")

/**
 * The raw API reads of the core providers a person's screen runs (level 1: each agent's workbench and the provider pages; never a node,
 * which names `TOOL.*`), nested by the provider's constant name of `PROVIDER` (and `openapi`, the carrier of the sources). It holds
 * EXACTLY the reads the person-read door serves today: the account's current state (`info`) of the providers that draw one (the bank
 * feed SePay, the mailbox IMAP, the API account) and the registry reads every catalogued provider's account answers (`config`: the trigger
 * switches and deciders; `rights`: who holds what on the account). A source's reads (`nivo.api.crm.<method>.<path>`) are generated with
 * its names file (`CRM_API`), composed with these by `composeApi`, never added here. Interfaces write `API.sepay.info`, never the string.
 * `API` holds these and, under `nivo`, the engine's OWN operations (`NIVO_API`), which are no read of a provider account.
 */
export const PROVIDER_API = {
    zaloOa: {
        config: "nivo.api.zalo-oa.config",
        rights: "nivo.api.zalo-oa.rights",
    },
    telegram: {
        config: "nivo.api.telegram.config",
        rights: "nivo.api.telegram.rights",
    },
    meta: {
        config: "nivo.api.meta.config",
        rights: "nivo.api.meta.rights",
    },
    sepay: {
        /** The bank account's figures: today's credits and their sum, the last credit, the unmatched credits. */
        info: "nivo.api.sepay.info",
        config: "nivo.api.sepay.config",
        rights: "nivo.api.sepay.rights",
    },
    casso: {
        config: "nivo.api.casso.config",
        rights: "nivo.api.casso.rights",
    },
    payos: {
        config: "nivo.api.payos.config",
        rights: "nivo.api.payos.rights",
    },
    smtp: {
        config: "nivo.api.smtp.config",
        rights: "nivo.api.smtp.rights",
    },
    imap: {
        /** The mailbox's figures. */
        info: "nivo.api.imap.info",
        config: "nivo.api.imap.config",
        rights: "nivo.api.imap.rights",
    },
    google: {
        config: "nivo.api.google.config",
        rights: "nivo.api.google.rights",
    },
    inet: {
        config: "nivo.api.inet.config",
        rights: "nivo.api.inet.rights",
    },
    tino: {
        config: "nivo.api.tino.config",
        rights: "nivo.api.tino.rights",
    },
    elevenlabs: {
        config: "nivo.api.elevenlabs.config",
        rights: "nivo.api.elevenlabs.rights",
    },
    veo: {
        config: "nivo.api.veo.config",
        rights: "nivo.api.veo.rights",
    },
    tiktok: {
        config: "nivo.api.tiktok.config",
        rights: "nivo.api.tiktok.rights",
    },
    shotstack: {
        config: "nivo.api.shotstack.config",
        rights: "nivo.api.shotstack.rights",
    },
    creatomate: {
        config: "nivo.api.creatomate.config",
        rights: "nivo.api.creatomate.rights",
    },
    json2video: {
        config: "nivo.api.json2video.config",
        rights: "nivo.api.json2video.rights",
    },
    misaAmis: {
        config: "nivo.api.misa-amis.config",
        rights: "nivo.api.misa-amis.rights",
    },
    misaMeinvoice: {
        config: "nivo.api.misa-meinvoice.config",
        rights: "nivo.api.misa-meinvoice.rights",
    },
    openapi: {
        /** The API account's figures: the system, the pinned document, the operations ready. */
        info: "nivo.api.openapi.info",
        config: "nivo.api.openapi.config",
        rights: "nivo.api.openapi.rights",
    },
} as const

/**
 * The engine's OWN operations a person's screen runs (`nivo.api.nivo.<object>.<op>`): no provider account carries them, so they are no
 * read of the door's provider-read table; the door serves each through its own operation. The file store (`file`): `upload` (a signed target for a record's `file` field), `confirm` (the store proves size and type, then answers the reference), `link` (attaches the confirmed object to the record's field), `get` (a short-lived signed URL to read the field's file), `delete` (clears the field and removes the object). The contacts (`contact`): the people the agents
 * work with, their identities, merges and memory (the /contacts page). The team /chat threads (`chatThread`), the truth-graph search
 * (`brain`), a declared workbench read or action (`workbench`: a module's record queries and writes, as the caller's rights reach them), the
 * record types of the installed agents with the reads and actions that reach them (`record`), a connected account's raw provider data
 * (`accountData`), the workspace's brand theme (`theme`), the agents, their tools, workflows (and starting one), runs and stops (`agent`, `workflow`, `run`, `stop`). The key, member, workspace, connection-secret and platform-admin
 * operations (`key`, `member`, `workspace`, `connection`, `admin`) are declared so the outbound MCP surface can prove it never offers them.
 */
export const NIVO_API = {
    file: {
        upload: "nivo.api.nivo.file.upload",
        confirm: "nivo.api.nivo.file.confirm",
        link: "nivo.api.nivo.file.link",
        get: "nivo.api.nivo.file.get",
        delete: "nivo.api.nivo.file.delete",
    },
    contact: {
        list: "nivo.api.nivo.contact.list",
        get: "nivo.api.nivo.contact.get",
        blockList: "nivo.api.nivo.contact.block.list",
        update: "nivo.api.nivo.contact.update",
        identityLink: "nivo.api.nivo.contact.identity.link",
        identityUnlink: "nivo.api.nivo.contact.identity.unlink",
        merge: "nivo.api.nivo.contact.merge",
        memoryForget: "nivo.api.nivo.contact.memory.forget",
        delete: "nivo.api.nivo.contact.delete",
    },
    customerMessage: {
        list: "nivo.api.nivo.customer.message.list",
    },
    chatThread: {
        list: "nivo.api.nivo.chat.thread.list",
        get: "nivo.api.nivo.chat.thread.get",
    },
    brain: {
        search: "nivo.api.nivo.brain.search",
    },
    workbench: {
        read: "nivo.api.nivo.workbench.read",
        action: "nivo.api.nivo.workbench.action",
    },
    record: {
        typeList: "nivo.api.nivo.record.type.list",
    },
    accountData: {
        typeList: "nivo.api.nivo.accountdata.type.list",
        rowList: "nivo.api.nivo.accountdata.row.list",
    },
    agent: {
        list: "nivo.api.nivo.agent.list",
        toolList: "nivo.api.nivo.agent.tool.list",
        deletionImpact: "nivo.api.nivo.agent.deletion.impact",
    },
    workflow: {
        list: "nivo.api.nivo.workflow.list",
        get: "nivo.api.nivo.workflow.get",
        run: "nivo.api.nivo.workflow.run",
    },
    run: {
        list: "nivo.api.nivo.run.list",
        get: "nivo.api.nivo.run.get",
        stepDecide: "nivo.api.nivo.run.step.decide",
    },
    stop: {
        list: "nivo.api.nivo.stop.list",
        answer: "nivo.api.nivo.stop.answer",
    },
    key: {
        list: "nivo.api.nivo.key.list",
        create: "nivo.api.nivo.key.create",
        rename: "nivo.api.nivo.key.rename",
        revoke: "nivo.api.nivo.key.revoke",
    },
    member: {
        roleChange: "nivo.api.nivo.member.role.change",
        remove: "nivo.api.nivo.member.remove",
    },
    workspace: {
        delete: "nivo.api.nivo.workspace.delete",
    },
    theme: {
        get: "nivo.api.nivo.theme.get",
        update: "nivo.api.nivo.theme.update",
        reset: "nivo.api.nivo.theme.reset",
    },
    connection: {
        zaloOaSecretSave: "nivo.api.nivo.connection.secret.save",
    },
    admin: {
        workspacePlanSet: "nivo.api.nivo.admin.plan.set",
    },
} as const

/** Every API name of NIVO by constant: the provider reads (`API.sepay.info`) and the engine's own operations (`API.nivo.file.upload`). */
export const API: typeof PROVIDER_API & { readonly nivo: typeof NIVO_API } = { ...PROVIDER_API, nivo: NIVO_API }

/** Compiles only when every value is a declared name: a constant whose verb is not a key of `ApiNames` is a compile error. */
type Declared<T extends Readonly<Record<string, Readonly<Record<string, ApiVerb>>>>> = T

/** The provider constant names `API` nests its provider reads under (`PROVIDER_API`). */
export type CoreApiProvider = keyof Declared<typeof PROVIDER_API>

/** The verb of one core provider read (a value of `PROVIDER_API`): what the door's provider-read table is total over. */
export type CoreApiVerb = { readonly [P in CoreApiProvider]: (typeof PROVIDER_API)[P][keyof (typeof PROVIDER_API)[P]] }[CoreApiProvider]

/** The objects the engine's own operations are nested under (`NIVO_API`). */
type NivoApiObject = keyof Declared<typeof NIVO_API>

/** The verb of one of the engine's own operations (a value of `NIVO_API`), served by the door's own operation, never a provider read. */
export type NivoApiVerb = { readonly [O in NivoApiObject]: (typeof NIVO_API)[O][keyof (typeof NIVO_API)[O]] }[NivoApiObject]

/** A source's generated map of API reads (`CRM_API`): constant → verb, every verb a key its names file adds to `ApiNames`. */
export type ApiSource = Readonly<Record<string, ApiVerb>>

/** The sources composed with `API`, by source key; a key that is a core provider's constant is refused (`never`). */
export type ApiSources<S> = S & { readonly [P in keyof typeof API]?: never }

/**
 * `API` with the generated maps of sources under their keys: `composeApi({ crm: CRM_API }).crm.priceList`. A new object each call;
 * `API` itself is never changed. A plugin builds its own once (`NIVO_API`) beside its generated names file and its interfaces read it.
 */
export const composeApi = <const S extends Readonly<Record<string, ApiSource>>>(sources: ApiSources<S>): typeof API & S => ({
    ...API,
    ...sources,
})
