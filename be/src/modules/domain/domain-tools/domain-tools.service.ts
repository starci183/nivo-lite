import { TOOL } from "@nivo-lite/agent-sdk/names"
import { Injectable } from "@nestjs/common"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import {
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
    argumentsOf,
    unknownTool,
} from "@modules/domain/tools"
import {
    registrarRefusalReason,
    DomainRegistrarRegistryService,
    type DnsRecordList,
    type DomainChange,
    type DomainOrderReceipt,
    type DomainRecord,
    type DomainRegistrarPort,
} from "@modules/domain/provider-registry"
import { accountForNew, candidatesOf, holderOf, type HeldDomain } from "./domain-owner.policy"
import { domainRefusal } from "./domain-refusal.policy"
import {
    DNS_CREATE_SCHEMA,
    DNS_DELETE_SCHEMA,
    DNS_UPDATE_SCHEMA,
    DOMAIN_LIST_SCHEMA,
    DOMAIN_NAME_SCHEMA,
    DOMAIN_REGISTER_SCHEMA,
    DOMAIN_RENEW_SCHEMA,
    DOMAIN_TRANSFER_SCHEMA,
    NAMESERVER_UPDATE_SCHEMA,
    inputSchemaOf,
} from "./domain-tools.schema"

/** The tool id of each generic domain purpose, keyed by what it does. */
interface DomainToolIds {
    readonly availabilityGet: typeof TOOL.domainAvailabilityGet
    readonly get: typeof TOOL.domainGet
    readonly list: typeof TOOL.domainList
    readonly registrationCreate: typeof TOOL.domainRegistrationCreate
    readonly renewalCreate: typeof TOOL.domainRenewalCreate
    readonly transferCreate: typeof TOOL.domainTransferCreate
    readonly dnsRecordList: typeof TOOL.domainDnsRecordList
    readonly dnsRecordCreate: typeof TOOL.domainDnsRecordCreate
    readonly dnsRecordUpdate: typeof TOOL.domainDnsRecordUpdate
    readonly dnsRecordDelete: typeof TOOL.domainDnsRecordDelete
    readonly nameserverUpdate: typeof TOOL.domainNameserverUpdate
}

/** The generic domain purposes, by their tool ids (the SDK's `TOOL.domain*`), keyed by what each does. */
export const DOMAIN_TOOL: DomainToolIds = {
    availabilityGet: TOOL.domainAvailabilityGet,
    get: TOOL.domainGet,
    list: TOOL.domainList,
    registrationCreate: TOOL.domainRegistrationCreate,
    renewalCreate: TOOL.domainRenewalCreate,
    transferCreate: TOOL.domainTransferCreate,
    dnsRecordList: TOOL.domainDnsRecordList,
    dnsRecordCreate: TOOL.domainDnsRecordCreate,
    dnsRecordUpdate: TOOL.domainDnsRecordUpdate,
    dnsRecordDelete: TOOL.domainDnsRecordDelete,
    nameserverUpdate: TOOL.domainNameserverUpdate,
} as const

/** The connector's own tool name of each purpose (its id after the namespace `nivo.tool.domain.`), the id itself for `get` / `list`. */
const NAMESPACE = "nivo.tool.domain"
const local = (id: string): string => (id.startsWith(`${NAMESPACE}.`) ? id.slice(NAMESPACE.length + 1) : id)

/** The members of a registration the audit masks: contact data is personal, the transfer code is a secret. */
const PERSONAL = ["contacts", "authCode"]

/** The domain purposes: named by what they do, never by the registrar that does it. */
export const DOMAIN_MANIFEST: ToolManifest = {
    key: "domain",
    namespace: NAMESPACE,
    name: "Domains",
    contractVersion: "domain-native@1",
    tools: [
        {
            name: local(DOMAIN_TOOL.availabilityGet),
            description: "Whether a domain name can be registered now at the registrar, with its prices per period when the registrar states them.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: inputSchemaOf(DOMAIN_NAME_SCHEMA),
            argumentSchema: DOMAIN_NAME_SCHEMA,
            domain: DOMAIN_TOOL.availabilityGet,
            internalOnly: true,
        },
        {
            name: local(DOMAIN_TOOL.get),
            description: "One domain the workspace holds: its status, expiry, nameservers and automatic renewal, read at the account that holds it.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: inputSchemaOf(DOMAIN_NAME_SCHEMA),
            argumentSchema: DOMAIN_NAME_SCHEMA,
            domain: DOMAIN_TOOL.get,
            internalOnly: true,
        },
        {
            name: local(DOMAIN_TOOL.list),
            description: "A page of the domains one registrar account holds.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: inputSchemaOf(DOMAIN_LIST_SCHEMA),
            argumentSchema: DOMAIN_LIST_SCHEMA,
            domain: DOMAIN_TOOL.list,
            internalOnly: true,
        },
        {
            name: local(DOMAIN_TOOL.registrationCreate),
            description: "Registers a new domain name for the given years; the registrar charges the account.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: inputSchemaOf(DOMAIN_REGISTER_SCHEMA),
            argumentSchema: DOMAIN_REGISTER_SCHEMA,
            secretFields: PERSONAL,
            domain: DOMAIN_TOOL.registrationCreate,
            internalOnly: true,
        },
        {
            name: local(DOMAIN_TOOL.renewalCreate),
            description: "Renews a domain the workspace holds for the given years, at the account that holds it; the registrar charges it.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: inputSchemaOf(DOMAIN_RENEW_SCHEMA),
            argumentSchema: DOMAIN_RENEW_SCHEMA,
            domain: DOMAIN_TOOL.renewalCreate,
            internalOnly: true,
        },
        {
            name: local(DOMAIN_TOOL.transferCreate),
            description: "Asks a domain held at another registrar to be transferred in, with the transfer code that registrar issued.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: inputSchemaOf(DOMAIN_TRANSFER_SCHEMA),
            argumentSchema: DOMAIN_TRANSFER_SCHEMA,
            secretFields: PERSONAL,
            domain: DOMAIN_TOOL.transferCreate,
            internalOnly: true,
        },
        {
            name: local(DOMAIN_TOOL.dnsRecordList),
            description: "The DNS records of a domain the workspace holds, read at the account that holds it.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: inputSchemaOf(DOMAIN_NAME_SCHEMA),
            argumentSchema: DOMAIN_NAME_SCHEMA,
            domain: DOMAIN_TOOL.dnsRecordList,
            internalOnly: true,
        },
        {
            name: local(DOMAIN_TOOL.dnsRecordCreate),
            description: "Adds one DNS record to a domain the workspace holds.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: inputSchemaOf(DNS_CREATE_SCHEMA),
            argumentSchema: DNS_CREATE_SCHEMA,
            domain: DOMAIN_TOOL.dnsRecordCreate,
            internalOnly: true,
        },
        {
            name: local(DOMAIN_TOOL.dnsRecordUpdate),
            description: "Replaces one DNS record of a domain the workspace holds, by the id the record list answered.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: inputSchemaOf(DNS_UPDATE_SCHEMA),
            argumentSchema: DNS_UPDATE_SCHEMA,
            domain: DOMAIN_TOOL.dnsRecordUpdate,
            internalOnly: true,
        },
        {
            name: local(DOMAIN_TOOL.dnsRecordDelete),
            description: "Removes one DNS record of a domain the workspace holds, by the id the record list answered.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: inputSchemaOf(DNS_DELETE_SCHEMA),
            argumentSchema: DNS_DELETE_SCHEMA,
            domain: DOMAIN_TOOL.dnsRecordDelete,
            internalOnly: true,
        },
        {
            name: local(DOMAIN_TOOL.nameserverUpdate),
            description: "Replaces the nameservers of a domain the workspace holds.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: inputSchemaOf(NAMESERVER_UPDATE_SCHEMA),
            argumentSchema: NAMESERVER_UPDATE_SCHEMA,
            domain: DOMAIN_TOOL.nameserverUpdate,
            internalOnly: true,
        },
    ],
}

/** A held domain in the tool's answer. */
const domainAnswer = (provider: string, domain: DomainRecord): ToolJson => ({
    provider,
    name: domain.name,
    status: domain.status,
    expiresOn: domain.expiresOn,
    nameservers: domain.nameservers,
    autoRenew: domain.autoRenew,
})

/** An order-like write in the tool's answer. */
const receiptAnswer = (provider: string, receipt: DomainOrderReceipt): ToolJson => ({
    provider,
    name: receipt.name,
    reference: receipt.reference,
    total: receipt.total,
    providerData: receipt.providerData,
})

/** A DNS or nameserver write in the tool's answer. */
const changeAnswer = (provider: string, change: DomainChange): ToolJson => ({
    provider,
    name: change.name,
    records: change.records,
    providerData: change.providerData,
})

/** The record list in the tool's answer: the records when the registrar documents them, else its answer as it came. */
const recordsAnswer = (provider: string, name: string, list: DnsRecordList): ToolJson =>
    list.kind === "parsed"
        ? { provider, name, records: list.records, providerData: null }
        : { provider, name, records: null, providerData: list.providerData }

@Injectable()
/**
 * `nivo.tool.domain.*` for a workspace, internal callers only: each purpose runs through the `DomainRegistrarPort` of the account's
 * provider (iNET, Tino, any registrar that registers one), never a provider's name here. An operation on a held domain acts on the
 * account that holds it (`domain-owner.policy.ts`); a refusal of the provider is an answer (`domainRefusal`); a failure of the provider
 * is thrown as it is, with what it proves attached by the adapter.
 */
export class DomainToolsService implements NativeToolFamily {
    readonly manifest: ToolManifest = DOMAIN_MANIFEST

    constructor(
        private readonly connections: ConnectionsService,
        private readonly registrars: DomainRegistrarRegistryService,
    ) {}

    /** Runs one domain tool. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        try {
            return await this.run(workspaceId, tool, args, caller)
        } catch (cause) {
            const reason = registrarRefusalReason(cause)
            if (reason !== null) throw domainRefusal(reason, cause)
            throw cause
        }
    }

    private async run(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        switch (tool) {
            case local(DOMAIN_TOOL.availabilityGet): {
                const { name } = argumentsOf(tool, DOMAIN_NAME_SCHEMA, args)
                const { port, connection } = await this.forNew(workspaceId, caller)
                const answer = await port.availability(connection, name)
                return { provider: port.provider, name: answer.name, available: answer.available, prices: answer.prices }
            }
            case local(DOMAIN_TOOL.get): {
                const { name } = argumentsOf(tool, DOMAIN_NAME_SCHEMA, args)
                const held = await this.held(workspaceId, caller, name)
                return domainAnswer(held.port.provider, await held.port.details(held.connection, held.domain))
            }
            case local(DOMAIN_TOOL.list): {
                const query = argumentsOf(tool, DOMAIN_LIST_SCHEMA, args)
                const { port, connection } = await this.forNew(workspaceId, caller)
                const page = await port.list(connection, query)
                return {
                    provider: port.provider,
                    domains: page.domains.map((domain) => domainAnswer(port.provider, domain)),
                    page: page.page,
                    totalPages: page.totalPages,
                }
            }
            case local(DOMAIN_TOOL.registrationCreate): {
                const asked = argumentsOf(tool, DOMAIN_REGISTER_SCHEMA, args)
                const { port, connection } = await this.forNew(workspaceId, caller)
                const receipt = await port.register(connection, {
                    name: asked.name,
                    years: asked.years,
                    nameservers: asked.nameservers ?? [],
                    contacts: asked.contacts ?? [],
                })
                return receiptAnswer(port.provider, receipt)
            }
            case local(DOMAIN_TOOL.renewalCreate): {
                const { name, years } = argumentsOf(tool, DOMAIN_RENEW_SCHEMA, args)
                const held = await this.held(workspaceId, caller, name)
                return receiptAnswer(held.port.provider, await held.port.renew(held.connection, { domain: held.domain, years }))
            }
            case local(DOMAIN_TOOL.transferCreate): {
                const asked = argumentsOf(tool, DOMAIN_TRANSFER_SCHEMA, args)
                const { port, connection } = await this.forNew(workspaceId, caller)
                return receiptAnswer(port.provider, await port.transfer(connection, asked))
            }
            case local(DOMAIN_TOOL.dnsRecordList): {
                const { name } = argumentsOf(tool, DOMAIN_NAME_SCHEMA, args)
                const held = await this.held(workspaceId, caller, name)
                return recordsAnswer(held.port.provider, held.domain.name, await held.port.dnsRecords(held.connection, held.domain))
            }
            case local(DOMAIN_TOOL.dnsRecordCreate): {
                const { name, record } = argumentsOf(tool, DNS_CREATE_SCHEMA, args)
                const held = await this.held(workspaceId, caller, name)
                return changeAnswer(held.port.provider, await held.port.createDnsRecord(held.connection, held.domain, record))
            }
            case local(DOMAIN_TOOL.dnsRecordUpdate): {
                const { name, recordId, record } = argumentsOf(tool, DNS_UPDATE_SCHEMA, args)
                const held = await this.held(workspaceId, caller, name)
                const change = await held.port.updateDnsRecord(held.connection, held.domain, recordId, record)
                return changeAnswer(held.port.provider, change)
            }
            case local(DOMAIN_TOOL.dnsRecordDelete): {
                const { name, recordId } = argumentsOf(tool, DNS_DELETE_SCHEMA, args)
                const held = await this.held(workspaceId, caller, name)
                return changeAnswer(held.port.provider, await held.port.deleteDnsRecord(held.connection, held.domain, recordId))
            }
            case local(DOMAIN_TOOL.nameserverUpdate): {
                const { name, nameservers } = argumentsOf(tool, NAMESERVER_UPDATE_SCHEMA, args)
                const held = await this.held(workspaceId, caller, name)
                return changeAnswer(held.port.provider, await held.port.updateNameservers(held.connection, held.domain, nameservers))
            }
            default:
                throw unknownTool(tool)
        }
    }

    /** The workspace's registrar accounts, the handed one first. */
    private async candidates(workspaceId: string, caller: NativeCaller): Promise<ReadonlyArray<ConnectionRecord>> {
        const all = await this.connections.list(workspaceId)
        return candidatesOf(all, (provider) => this.registrars.has(provider), caller.connectionId)
    }

    /** The port of an account (registered, since `candidatesOf` kept only served providers). */
    private portOf(connection: ConnectionRecord): DomainRegistrarPort {
        const port = this.registrars.of(connection.provider)
        if (port === undefined) throw domainRefusal("not_connected")
        return port
    }

    /** The account and port for a name not held yet: the handed account, else the only one. */
    private async forNew(
        workspaceId: string,
        caller: NativeCaller,
    ): Promise<{ readonly port: DomainRegistrarPort; readonly connection: ConnectionRecord }> {
        const picked = accountForNew(await this.candidates(workspaceId, caller), caller.connectionId)
        if (picked === "none") throw domainRefusal("not_connected")
        if (picked === "ambiguous") throw domainRefusal("not_selected")
        return { port: this.portOf(picked), connection: picked }
    }

    /** The account that holds the domain (by data), and its port; `domain_not_held` when none does. */
    private async held(
        workspaceId: string,
        caller: NativeCaller,
        name: string,
    ): Promise<HeldDomain & { readonly port: DomainRegistrarPort }> {
        const candidates = await this.candidates(workspaceId, caller)
        if (candidates.length === 0) throw domainRefusal("not_connected")
        const held = await holderOf(candidates, (connection) => this.portOf(connection).find(connection, name))
        if (held === null) throw domainRefusal("domain_not_held")
        return { ...held, port: this.portOf(held.connection) }
    }
}
