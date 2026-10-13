import { decodeOne, isRecord } from "../decode"

/** A check that narrows an unknown value to the shape the back end promises. */
type Guard<T> = (value: unknown) => value is T

/** The type a guard narrows to. */
type Narrowed<G> = G extends Guard<infer T> ? T : never

const isText: Guard<string> = (value): value is string => typeof value === "string"

const isNumber: Guard<number> = (value): value is number => typeof value === "number"

const isFlag: Guard<boolean> = (value): value is boolean => typeof value === "boolean"

const orNull =
    <T>(guard: Guard<T>): Guard<T | null> =>
    (value): value is T | null =>
        value === null || guard(value)

const listOf =
    <T>(guard: Guard<T>): Guard<ReadonlyArray<T>> =>
    (value): value is ReadonlyArray<T> =>
        Array.isArray(value) && value.every((entry: unknown) => guard(entry))

const mapOf =
    <T>(guard: Guard<T>): Guard<Readonly<Record<string, T>>> =>
    (value): value is Readonly<Record<string, T>> =>
        isRecord(value) && Object.values(value).every((entry: unknown) => guard(entry))

const oneOf =
    <T extends string>(...allowed: ReadonlyArray<T>): Guard<T> =>
    (value): value is T =>
        allowed.some((entry) => entry === value)

const shape =
    <F extends Readonly<Record<string, Guard<unknown>>>>(
        fields: F,
    ): Guard<{ readonly [K in keyof F]: Narrowed<F[K]> }> =>
    (value): value is { readonly [K in keyof F]: Narrowed<F[K]> } =>
        isRecord(value) && Object.entries(fields).every(([name, guard]) => guard(value[name]))

/** True when a filter name the address carried is one the list knows. */
export const isAdminWorkspaceFilter = oneOf("all", "attention", "unpaid", "idle")

const isSession = shape({ email: isText })

const isWorkspaceItem = shape({
    id: isText,
    name: isText,
    ownerEmail: orNull(isText),
    status: isText,
    planCode: orNull(isText),
    paidUntil: orNull(isText),
    createdAt: isText,
    members: isNumber,
    modules: listOf(shape({ key: isText, status: isText, live: isFlag })),
    connections: listOf(shape({ provider: isText, count: isNumber, error: isNumber, silent: isNumber })),
    connectionWarning: isFlag,
    lastCustomerMessageAt: orNull(isText),
    messages7d: isNumber,
    openDecisions: isNumber,
    errors24h: isNumber,
    attention: isFlag,
    unpaid: isFlag,
    idle7d: isFlag,
})

const isWorkspaceList = shape({
    total: isNumber,
    counts: shape({ all: isNumber, attention: isNumber, unpaid: isNumber, idle: isNumber }),
    items: listOf(isWorkspaceItem),
})

const isWorkspaceDetail = shape({
    workspace: shape({
        id: isText,
        name: isText,
        ownerEmail: orNull(isText),
        status: isText,
        planCode: orNull(isText),
        paidUntil: orNull(isText),
        createdAt: isText,
    }),
    credits: shape({ used: isNumber, limit: orNull(isNumber), costUsd: isNumber, ownLimit: orNull(isNumber) }),
    members: listOf(
        shape({ userId: isText, role: isText, displayName: isText, status: isText, email: orNull(isText) }),
    ),
    invites: listOf(shape({ id: isText, email: isText, role: isText, createdAt: isText, expiresAt: isText })),
    orders: listOf(
        shape({
            id: isText,
            orderCode: isText,
            planCode: isText,
            amountVnd: isNumber,
            status: isText,
            createdAt: isText,
            paidAt: orNull(isText),
        }),
    ),
    transfers: listOf(
        shape({
            sepayId: isNumber,
            transferAmount: orNull(isNumber),
            content: orNull(isText),
            status: isText,
            receivedAt: isText,
        }),
    ),
    billingEvents: listOf(shape({ id: isText, kind: isText, createdAt: isText })),
    modules: listOf(
        shape({
            id: isText,
            key: isText,
            status: isText,
            operatingMode: isText,
            live: isFlag,
            processor: isText,
            contextVersion: orNull(isNumber),
            contextAppliedAt: orNull(isText),
            sync: orNull(
                shape({
                    agentId: isText,
                    contextVersion: orNull(isNumber),
                    checkedAt: isText,
                    status: isText,
                    error: orNull(isText),
                }),
            ),
        }),
    ),
    connections: listOf(
        shape({
            id: isText,
            provider: isText,
            name: isText,
            status: isText,
            environment: isText,
            lastEventAt: orNull(isText),
            lastError: orNull(isText),
            health: isText,
        }),
    ),
    errors: listOf(shape({ id: isText, scope: isText, message: isText, createdAt: isText })),
    knowledgeTotal: isNumber,
    knowledge: listOf(shape({ kind: isText, byStatus: mapOf(isNumber) })),
    activity: shape({ messages7d: isNumber, lastCustomerMessageAt: orNull(isText), openDecisions: isNumber }),
})

const isCount = shape({ key: isText, count: isNumber })

const isHealth = shape({
    signups: listOf(shape({ day: isText, signups: isNumber })),
    transfers: listOf(
        shape({ status: isText, transferAmount: orNull(isNumber), content: orNull(isText), receivedAt: isText }),
    ),
    transferCounts: listOf(isCount),
    billingEvents: listOf(shape({ id: isText, workspaceId: orNull(isText), kind: isText, createdAt: isText })),
    errors: listOf(
        shape({ id: isText, scope: isText, message: isText, workspaceId: orNull(isText), createdAt: isText }),
    ),
    errorScopes: listOf(isCount),
    audits: listOf(
        shape({ id: isText, actorEmail: isText, action: isText, workspaceId: orNull(isText), createdAt: isText }),
    ),
    workspaceNames: listOf(shape({ id: isText, name: isText })),
})

const isExtended = shape({ paidUntil: isText })

const isSupportStatus = oneOf("active", "past_due")

const isStatusSet = shape({ status: isSupportStatus })

const isPlanSet = shape({ planCode: isText, creditsLimit: orNull(isNumber) })

const isInviteResent = shape({ email: isText, delivery: oneOf("invited", "existing", "none") })

/** The platform admin the console is open for. */
export type AdminSession = Narrowed<typeof isSession>

/** The list filters of the console. */
export type AdminWorkspaceFilter = Narrowed<typeof isAdminWorkspaceFilter>

/** One customer workspace as the list shows it. */
export type AdminWorkspaceItem = Narrowed<typeof isWorkspaceItem>

/** The filtered list with the size of every filter. */
export type AdminWorkspaceList = Narrowed<typeof isWorkspaceList>

/** The full read-only overview of one workspace. */
export type AdminWorkspaceDetail = Narrowed<typeof isWorkspaceDetail>

/** The platform health page. */
export type AdminHealth = Narrowed<typeof isHealth>

/** The billing status a support action can set. */
export type AdminSupportStatus = Narrowed<typeof isSupportStatus>

/** What moving a workspace to a plan answered. */
export type AdminPlanSet = Narrowed<typeof isPlanSet>

/** What resending an invitation answered. */
export type AdminInviteResent = Narrowed<typeof isInviteResent>

/** Reads the answer of GET /admin/session. */
export const decodeAdminSession = decodeOne(isSession)

/** Reads the answer of GET /admin/workspaces. */
export const decodeAdminWorkspaces = decodeOne(isWorkspaceList)

/** Reads the answer of GET /admin/workspaces/:workspaceId. */
export const decodeAdminWorkspace = decodeOne(isWorkspaceDetail)

/** Reads the answer of GET /admin/health. */
export const decodeAdminHealth = decodeOne(isHealth)

/** Reads the answer of the extend action. */
export const decodeAdminExtended = decodeOne(isExtended)

/** Reads the answer of the status action. */
export const decodeAdminStatusSet = decodeOne(isStatusSet)

/** Reads the answer of the plan action. */
export const decodeAdminPlanSet = decodeOne(isPlanSet)

/** Reads the answer of the resend-invite action. */
export const decodeAdminInviteResent = decodeOne(isInviteResent)
