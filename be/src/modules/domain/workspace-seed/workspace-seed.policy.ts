import { Secret } from "@modules/platform/config"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import type { ProfileInput } from "./workspace-profile.contracts"
import type { SeedAccount, SeedInput, SeedRequest, SeedRoleRequest } from "./workspace-seed.contracts"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value)

function invalid(): never {
    throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputInvalid })
}

const text = (value: unknown, max: number): string =>
    typeof value === "string" && value.length > 0 && value.length <= max ? value : invalid()

const optionalSecret = (value: unknown): Secret | undefined =>
    value === undefined ? undefined : new Secret(text(value, 65_536))

/** Validates and returns one explicit selector while keeping the three account identities distinct. */
export const assertSeedScope = (request: SeedRequest): Readonly<{ id: string } | { name: string }> => {
    if (new Set([request.owner.email, request.manager.email, request.staff.email]).size !== 3) invalid()
    if (request.workspaceId !== undefined) {
        if (request.workspaceName !== undefined || !UUID.test(request.workspaceId)) invalid()
        return { id: request.workspaceId }
    }
    if (!request.workspaceName?.trim() || request.workspaceName.length > 120) invalid()
    return { name: request.workspaceName }
}

/**
 * The private ensure input of a run that is bound to one named workspace and one owner. A role-change input, another owner or
 * another workspace name is refused, so a run can never write into a workspace its command did not name.
 */
export const readEnsureFor = (
    input: Secret | undefined,
    owner: string | undefined,
    workspaceName: string,
): SeedRequest => {
    const parsed = readSeedInput(input)
    if (parsed.action !== "ensure") return invalid()
    const { request } = parsed
    if (request.owner.email !== (owner ?? "").trim().toLowerCase() || request.workspaceName !== workspaceName)
        return invalid()
    return request
}

/** Requires the initial password only at a missing-account boundary; existing users retain their credential. */
export const seedPassword = (account: SeedAccount): Secret => {
    if (account.password === undefined) throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.PasswordRequired })
    return account.password
}

const ACCOUNT_KEYS: ReadonlySet<string> = new Set(["email", "name", "password"])
const ENSURE_KEYS: ReadonlySet<string> = new Set([
    "schema",
    "action",
    "workspaceId",
    "workspaceName",
    "owner",
    "manager",
    "staff",
    "principalToken",
    "bootstrapOwner",
])
const ROLE_KEYS: ReadonlySet<string> = new Set([
    "schema",
    "action",
    "workspaceId",
    "memberId",
    "role",
    "principalToken",
])

/** One "@" with text before it and a dot inside the domain, no whitespace; checked in linear scans. */
const isEmailShape = (email: string): boolean => {
    const at = email.indexOf("@")
    return at > 0 && !email.includes("@", at + 1) && !/\s/.test(email) && email.slice(at + 2, -1).includes(".")
}

const account = (value: unknown): SeedAccount => {
    if (!isRecord(value) || Object.keys(value).some((key) => !ACCOUNT_KEYS.has(key))) invalid()
    const email = text(value.email, 254).toLowerCase()
    if (!isEmailShape(email)) invalid()
    const name = text(value.name, 120).trim()
    if (name.length === 0) invalid()
    return { email, name, password: optionalSecret(value.password) }
}

const ensureRequest = (value: Record<string, unknown>): SeedRequest => {
    if (Object.keys(value).some((key) => !ENSURE_KEYS.has(key))) invalid()
    if ((value.workspaceId === undefined) === (value.workspaceName === undefined)) invalid()
    const workspaceId = value.workspaceId === undefined ? undefined : text(value.workspaceId, 36)
    if (workspaceId !== undefined && !UUID.test(workspaceId)) invalid()
    const workspaceName = value.workspaceName === undefined ? undefined : text(value.workspaceName, 120).trim()
    if (workspaceName === "") invalid()
    const owner = account(value.owner),
        manager = account(value.manager),
        staff = account(value.staff)
    if (new Set([owner.email, manager.email, staff.email]).size !== 3) invalid()
    if (value.bootstrapOwner !== undefined && typeof value.bootstrapOwner !== "boolean") invalid()
    return {
        workspaceId,
        workspaceName,
        owner,
        manager,
        staff,
        principalToken: optionalSecret(value.principalToken),
        bootstrapOwner: value.bootstrapOwner,
    }
}

const roleRequest = (value: Record<string, unknown>): SeedRoleRequest => {
    if (Object.keys(value).some((key) => !ROLE_KEYS.has(key))) invalid()
    const workspaceId = text(value.workspaceId, 36),
        memberId = text(value.memberId, 36),
        role = value.role
    if (!UUID.test(workspaceId) || !UUID.test(memberId) || (role !== "owner" && role !== "manager" && role !== "staff"))
        invalid()
    return { workspaceId, memberId, role, principalToken: new Secret(text(value.principalToken, 65_536)) }
}

/** Parses the private wire input without including its content or parser errors in public diagnostics. */
export const readSeedInput = (input: Secret | undefined): SeedInput => {
    if (input === undefined) throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputRequired })
    try {
        const value: unknown = JSON.parse(input.reveal())
        if (!isRecord(value) || value.schema !== "starci/app-workspace-input@1") invalid()
        if (value.action === "ensure") return { action: "ensure", request: ensureRequest(value) }
        if (value.action === "role") return { action: "role", request: roleRequest(value) }
        return invalid()
    } catch (cause) {
        throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputInvalid, cause })
    }
}

const PROFILE_INPUT_KEYS: ReadonlySet<string> = new Set(["schema", "connectors"])
const CONNECTOR_KEY = /^[a-z][a-z0-9-]{1,30}$/u

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"])

/** An endpoint of at most 2048 characters: https, or plain http to a loopback host for a local stack; anything else is refused. */
const endpointUrl = (value: unknown): string => {
    const url = text(value, 2048)
    if (!URL.canParse(url)) return invalid()
    const { protocol, hostname } = new URL(url)
    return protocol === "https:" || (protocol === "http:" && LOOPBACK_HOSTS.has(hostname)) ? url : invalid()
}

const connectorUrls = (value: unknown): ReadonlyMap<string, string> => {
    if (!isRecord(value)) invalid()
    return new Map(
        Object.entries(value).map(([key, entry]): [string, string] => {
            if (!CONNECTOR_KEY.test(key) || !isRecord(entry) || Object.keys(entry).some((name) => name !== "url"))
                invalid()
            return [key, endpointUrl(entry.url)]
        }),
    )
}

/** Parses the private profile input (the connector endpoints) without including its content in public diagnostics. */
export const readProfileInput = (input: Secret | undefined): ProfileInput => {
    if (input === undefined) throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputRequired })
    try {
        const value: unknown = JSON.parse(input.reveal())
        if (!isRecord(value) || value.schema !== "nivo/workspace-profile-input@1") invalid()
        if (Object.keys(value).some((key) => !PROFILE_INPUT_KEYS.has(key))) invalid()
        return { urls: connectorUrls(value.connectors) }
    } catch (cause) {
        throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputInvalid, cause })
    }
}
