import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import type { Locale } from "@modules/platform/i18n"
import { NIVO_API_DECLARATIONS as D, type ExposedNivoApiVerb } from "./nivo-api.declarations"
import type { NivoApiCall, NivoApiRequestBuilder } from "./nivo-api-ops.contracts"

/** The locale an op answers in when the client names none. */
const DEFAULT_LOCALE: Locale = "vi"

/** The record field a file op names. */
interface FileFieldArgs {
    /** The workbench read the record is reached through. */
    readonly via: string
    /** The record type. */
    readonly type: string
    /** The record. */
    readonly recordId: string
    /** The field that holds the file. */
    readonly field: string
}

/** What an op declared input validator offers: it narrows raw arguments or refuses them. */
interface InputParser<A> {
    /** The arguments as the declared input takes them; refuses any other. */
    parse(raw: unknown): A
}

/** The request of an op, with the workspace it is made in. */
interface WorkspaceRequest {
    /** The key workspace. */
    readonly workspaceId: string
}

/** Binds a builder to the declared input of its op: the arguments are validated first, then mapped to the request. */
const request =
    <A>(input: InputParser<A>, make: (args: A, call: NivoApiCall) => unknown): NivoApiRequestBuilder =>
    (raw, call) =>
        make(input.parse(raw), call)

/** The record field a file op names, in the key workspace: the door's file call. */
interface FileCallArgs extends FileFieldArgs {
    /** The key workspace. */
    readonly workspaceId: string
}

/** The record field a file op names, as the door's file call. */
const fileCall = (workspaceId: string, args: FileFieldArgs): FileCallArgs => ({
    workspaceId,
    via: args.via,
    type: args.type,
    recordId: args.recordId,
    field: args.field,
})

/** The request of an op in the key workspace: the workspace beside the members the op adds. */
const inWorkspace = <R extends object>(call: NivoApiCall, members: R): R & WorkspaceRequest => ({
    workspaceId: call.workspaceId,
    ...members,
})

/**
 * The request each exposed op sends to its message, built as the op's GraphQL resolver builds it: TOTAL over the exposed names by
 * type, so a new exposed op states its request. Defaults are the ones the resolver's own input carries (`null` for an absent filter,
 * the default locale for a localised read).
 */
const NIVO_API_REQUESTS: { readonly [V in ExposedNivoApiVerb]: NivoApiRequestBuilder } = {
    [NIVO_API.contact.list]: request(D[NIVO_API.contact.list].input, (args, call) => inWorkspace(call, args)),
    [NIVO_API.contact.get]: request(D[NIVO_API.contact.get].input, (args, call) => inWorkspace(call, { id: args.id })),
    [NIVO_API.contact.blockList]: request(D[NIVO_API.contact.blockList].input, (args, call) => inWorkspace(call, {
        contactId: args.contactId,
        locale: DEFAULT_LOCALE,
    })),
    [NIVO_API.customerMessage.list]: request(D[NIVO_API.customerMessage.list].input, (args, call) => inWorkspace(call, args)),
    [NIVO_API.contact.update]: request(D[NIVO_API.contact.update].input, (args, call) => inWorkspace(call, args)),
    [NIVO_API.contact.identityLink]: request(D[NIVO_API.contact.identityLink].input, (args, call) => inWorkspace(call, args)),
    [NIVO_API.contact.identityUnlink]: request(D[NIVO_API.contact.identityUnlink].input, (args, call) => inWorkspace(call, args)),
    [NIVO_API.contact.merge]: request(D[NIVO_API.contact.merge].input, (args, call) => inWorkspace(call, args)),
    [NIVO_API.contact.memoryForget]: request(D[NIVO_API.contact.memoryForget].input, (args, call) => inWorkspace(call, args)),
    [NIVO_API.contact.delete]: request(D[NIVO_API.contact.delete].input, (args, call) => inWorkspace(call, { id: args.id })),
    [NIVO_API.file.upload]: request(D[NIVO_API.file.upload].input, (args, call) => ({
        call: fileCall(call.workspaceId, args),
        facts: { name: args.name, mime: args.mime, size: args.size },
    })),
    [NIVO_API.file.confirm]: request(D[NIVO_API.file.confirm].input, (args, call) => ({
        call: fileCall(call.workspaceId, args),
        key: args.key,
        name: args.name,
    })),
    [NIVO_API.file.link]: request(D[NIVO_API.file.link].input, (args, call) => ({
        call: fileCall(call.workspaceId, args),
        key: args.key,
        name: args.name,
    })),
    [NIVO_API.file.get]: request(D[NIVO_API.file.get].input, (args, call) => ({
        call: { ...fileCall(call.workspaceId, args), ...(args.key === undefined ? {} : { key: args.key }) },
    })),
    [NIVO_API.file.delete]: request(D[NIVO_API.file.delete].input, (args, call) => ({
        call: { ...fileCall(call.workspaceId, args), ...(args.key === undefined ? {} : { key: args.key }) },
    })),
    [NIVO_API.chatThread.list]: request(D[NIVO_API.chatThread.list].input, (args, call) => inWorkspace(call, {
        kind: args.kind ?? null,
        member: args.member ?? null,
    })),
    [NIVO_API.chatThread.get]: request(D[NIVO_API.chatThread.get].input, (args, call) => inWorkspace(call, {
        roomId: args.threadId,
        first: args.first ?? null,
        after: args.after ?? null,
        pinnedOnly: args.pinnedOnly ?? false,
    })),
    [NIVO_API.brain.search]: request(D[NIVO_API.brain.search].input, (args, call) => inWorkspace(call, args)),
    [NIVO_API.workbench.read]: request(D[NIVO_API.workbench.read].input, (args, call) => inWorkspace(call, {
        name: args.name,
        payload: JSON.stringify(args.vars ?? {}),
        locale: args.locale ?? DEFAULT_LOCALE,
    })),
    [NIVO_API.workbench.action]: request(D[NIVO_API.workbench.action].input, (args, call) => inWorkspace(call, {
        name: args.name,
        payload: JSON.stringify(args.input ?? {}),
        locale: args.locale ?? DEFAULT_LOCALE,
    })),
    [NIVO_API.record.typeList]: request(D[NIVO_API.record.typeList].input, (_args, call) => inWorkspace(call, {})),
    [NIVO_API.accountData.typeList]: request(D[NIVO_API.accountData.typeList].input, (args, call) => inWorkspace(call, {
        connectionId: args.connectionId,
    })),
    [NIVO_API.accountData.rowList]: request(D[NIVO_API.accountData.rowList].input, (args, call) => inWorkspace(call, {
        connectionId: args.connectionId,
        type: args.type,
        limit: args.limit ?? null,
    })),
    [NIVO_API.agent.list]: request(D[NIVO_API.agent.list].input, (_args, call) => inWorkspace(call, {})),
    [NIVO_API.agent.deletionImpact]: request(D[NIVO_API.agent.deletionImpact].input, (args, call) => inWorkspace(call, {
        installationId: args.installationId,
    })),
    [NIVO_API.workflow.list]: request(D[NIVO_API.workflow.list].input, (args, call) => inWorkspace(call, {
        installationId: args.installationId,
        locale: args.locale ?? null,
    })),
    [NIVO_API.workflow.get]: request(D[NIVO_API.workflow.get].input, (args, call) => inWorkspace(call, {
        installationId: args.installationId,
        workflowId: args.workflowId,
        locale: args.locale ?? null,
    })),
    [NIVO_API.workflow.run]: request(D[NIVO_API.workflow.run].input, (args, call) => inWorkspace(call, {
        installationId: args.installationId,
        workflowId: args.workflowId,
        inputs: args.inputs,
        opKey: call.opKey ?? "",
    })),
    [NIVO_API.run.list]: request(D[NIVO_API.run.list].input, (args, call) => inWorkspace(call, {
        installationId: args.installationId,
    })),
    [NIVO_API.run.get]: request(D[NIVO_API.run.get].input, (args, call) => inWorkspace(call, {
        installationId: args.installationId,
        runId: args.runId,
        locale: args.locale ?? DEFAULT_LOCALE,
    })),
    [NIVO_API.theme.get]: request(D[NIVO_API.theme.get].input, (_args, call) => inWorkspace(call, {})),
    [NIVO_API.theme.update]: request(D[NIVO_API.theme.update].input, (args, call) => inWorkspace(call, args)),
    [NIVO_API.theme.reset]: request(D[NIVO_API.theme.reset].input, (_args, call) => inWorkspace(call, {})),
    [NIVO_API.stop.list]: request(D[NIVO_API.stop.list].input, (args, call) => inWorkspace(call, {
        limit: args.limit ?? null,
        cursor: args.cursor ?? null,
    })),
    [NIVO_API.stop.answer]: request(D[NIVO_API.stop.answer].input, (args, call) => inWorkspace(call, {
        runId: args.runId,
        stepKey: args.stepKey ?? null,
        action: args.action,
        text: args.text ?? null,
    })),
    [NIVO_API.run.stepDecide]: request(D[NIVO_API.run.stepDecide].input, (args, call) => inWorkspace(call, {
        installationId: args.installationId,
        runId: args.runId,
        verdict: args.verdict,
        stepKey: args.stepKey ?? null,
        locale: args.locale ?? DEFAULT_LOCALE,
    })),
}

/** The request builders by op name. */
const REQUESTS: ReadonlyMap<string, NivoApiRequestBuilder> = new Map(Object.entries(NIVO_API_REQUESTS))

/** The request builder of an exposed op; undefined for a name that is not one. */
export const requestBuilderOf = (name: string): NivoApiRequestBuilder | undefined => REQUESTS.get(name)
