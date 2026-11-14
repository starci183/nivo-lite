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
import { InvoiceIssueRegistryService, type InvoiceIssuePort, type IssuedInvoice } from "@modules/domain/provider-registry"
import { DomainError } from "@modules/platform/errors"
import { INVOICE_CREATE_INPUT_SCHEMA, INVOICE_CREATE_SCHEMA } from "./invoice-tools.schema"
import { invoiceFailureOf, invoiceRefusal } from "./invoice-refusal.policy"

/** The tool name inside the connector (the full id is `nivo.tool.<name>`). */
export const INVOICE_TOOL = { create: "invoice.create" } as const

/**
 * The outcome of an issue a node branches on: the answer `issued` (number, provider reference, date); besides it the business refusals
 * `rejected` / `not_found` (nothing issued). A failure is never an answer: `not_sent` (unavailable: nothing issued, the runner goes on to
 * the next bound account, then the step stops) and `unknown` (the invoice may exist: the step stops for a person at once, never sent again).
 */
export const INVOICE_ISSUED = "issued"

/**
 * The e-invoice issue purpose (`nivo.tool.invoice.create`): named by what it does, never by the provider that does it. Owner ruling R57:
 * the invoice is issued AT the e-invoice provider (MISA meInvoice today) through its account; NIVO keeps no invoice tool of its own and
 * the CRM only stores the result.
 */
export const INVOICE_MANIFEST: ToolManifest = {
    key: "invoice",
    namespace: "nivo.tool",
    name: "E-invoice issue",
    contractVersion: "invoice-native@1",
    tools: [
        {
            name: INVOICE_TOOL.create,
            description:
                "Issues one e-invoice of a stored invoice draft AT the e-invoice provider, on the seller account the step is bound to, and answers `outcome: issued` with the provider's invoice id (`invoiceId`, its reference), its state, its invoice number (null while the provider has not numbered it) and its issue date (`issuedOn`, null when the provider states none). A refusal of the provider is answered `rejected` (nothing issued); a draft the provider does not know is `not_found`. It issues a legal document: whether a person is asked first is the calling node's mode, and it is never sent again by itself when its outcome is unknown.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: INVOICE_CREATE_INPUT_SCHEMA,
            argumentSchema: INVOICE_CREATE_SCHEMA,
            domain: TOOL.invoiceCreate,
            internalOnly: true,
        },
    ],
}

/** The answer of an issue: the outcome, the provider and only the members the provider gave. */
const issuedOf = (provider: string, invoice: IssuedInvoice): ToolJson => ({
    outcome: INVOICE_ISSUED,
    provider,
    invoiceId: invoice.id,
    invoiceNo: invoice.invoiceNo,
    issuedOn: invoice.issuedOn ?? null,
    state: invoice.state,
})

@Injectable()
/**
 * `nivo.tool.invoice.create`, a PROVIDER tool (owner ruling R57: it calls the e-invoice provider, never a NIVO-own invoice): its owners
 * are the e-invoice providers (`TOOL_SPECS`), served by the ability `invoice.issue` of their accounts. The id keeps the SDK's one id per
 * purpose; the provider is the adapter behind it. It issues one e-invoice on the account the tool runner handed (never a silent pick: no
 * account handed is refused `not_connected`), by the `InvoiceIssuePort` its provider registered (live or sandbox, picked by the account in `portFor`). A
 * WRITE (the node's declared mode applies); the tool runner keeps the answer under the call's key, so the adapter is called once per key
 * and a replay returns the kept answer.
 */
export class InvoiceToolsService implements NativeToolFamily {
    readonly manifest: ToolManifest = INVOICE_MANIFEST

    constructor(
        private readonly connections: ConnectionsService,
        private readonly invoices: InvoiceIssueRegistryService,
    ) {}

    /** Runs the tool. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        try {
            if (tool !== INVOICE_TOOL.create) throw unknownTool(tool)
            const asked = argumentsOf(INVOICE_TOOL.create, INVOICE_CREATE_SCHEMA, args)
            const { connection, port } = await this.portOf(workspaceId, caller)
            const invoice = await port.issue(connection, { draftId: asked.draftId, renewalId: asked.renewalId ?? null })
            return issuedOf(port.provider, invoice)
        } catch (cause) {
            const failure = invoiceFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }

    /** The handed account and the port its provider registered; no account handed, none found or no port is `not_connected`. */
    private async portOf(
        workspaceId: string,
        caller: NativeCaller,
    ): Promise<{ readonly connection: ConnectionRecord; readonly port: InvoiceIssuePort }> {
        if (caller.connectionId === undefined) throw invoiceRefusal("not_connected")
        const connection = await this.connections.find(workspaceId, caller.connectionId)
        const port = connection === null ? undefined : this.invoices.portFor(connection)
        if (connection === null || port === undefined) throw invoiceRefusal("not_connected")
        return { connection, port }
    }
}
