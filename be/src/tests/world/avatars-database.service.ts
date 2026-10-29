import type { EntityManager } from "typeorm"
import { AgentEntity } from "@modules/domain/agents"
import { callDbFunction, sql } from "@modules/platform/database"
import type { LiteWorld } from "./lite-world.service"

/** Only the backend may write an agent picture; the browser roles hold no privilege on the column. */
const AGENT_AVATAR_PRIVILEGES = sql`
    SELECT has_column_privilege('app_be', 'public.agents', 'avatar_url', 'UPDATE') AS backend,
           has_column_privilege('anon', 'public.agents', 'avatar_url', 'SELECT') AS anonymous_read,
           has_column_privilege('authenticated', 'public.agents', 'avatar_url', 'SELECT') AS browser_read,
           has_column_privilege('authenticated', 'public.agents', 'avatar_url', 'UPDATE') AS browser_write`

/** The helper is server-only; the backend cannot select the underlying private Auth table. */
const ROOM_MEMBER_AVATAR_PRIVILEGES = sql`
    SELECT has_function_privilege('app_be', 'be_access.workspace_member_avatars(uuid,uuid[])', 'EXECUTE') AS backend,
           has_function_privilege('anon', 'be_access.workspace_member_avatars(uuid,uuid[])', 'EXECUTE') AS anonymous,
           has_function_privilege('authenticated', 'be_access.workspace_member_avatars(uuid,uuid[])', 'EXECUTE') AS browser,
           has_table_privilege('app_be', 'auth.users', 'SELECT') AS auth_table`

/** The limits the avatars bucket declares. */
const READ_AVATARS_BUCKET = sql`
    SELECT public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'avatars_public' LIMIT 1`

/** Every storage policy that names the avatars bucket. */
const READ_AVATARS_POLICIES = sql`
    SELECT policyname, cmd, roles::text[] AS roles
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual LIKE '%avatars_public%' OR with_check LIKE '%avatars_public%')
    ORDER BY policyname
    LIMIT 10`

/** Lets the local role creator enter the signed-in browser role for one rolled-back proof transaction. */
const ENTER_BROWSER_ROLE = sql`GRANT authenticated TO CURRENT_USER WITH INHERIT FALSE, SET TRUE`

/** Applies the browser role's real grants and policies to the proof. */
const USE_BROWSER_ROLE = sql`SET LOCAL ROLE authenticated`

/** A browser trying to place an object in the avatars bucket itself ($1 object name). */
const BROWSER_WRITE_AVATAR = sql`INSERT INTO storage.objects (bucket_id, name) VALUES ('avatars_public', $1)`

/** One member picture the server-only avatar helper answers. */
export interface MemberAvatarRow {
    /** The account id. */
    readonly id: string
    /** The HTTPS picture address, or null when there is none to share. */
    readonly avatar_url: string | null
}

/** What the backend and browser roles may do with the agent picture column. */
export interface AgentAvatarPrivilegeRow {
    /** Whether the backend may update the column. */
    readonly backend: boolean
    /** Whether the anonymous role may read it. */
    readonly anonymous_read: boolean
    /** Whether the signed-in browser role may read it. */
    readonly browser_read: boolean
    /** Whether the signed-in browser role may write it. */
    readonly browser_write: boolean
}

/** What each role may execute or select around the member avatar helper. */
export interface MemberAvatarPrivilegeRow {
    /** Whether the backend may call the helper. */
    readonly backend: boolean
    /** Whether the anonymous role may call it. */
    readonly anonymous: boolean
    /** Whether the signed-in browser role may call it. */
    readonly browser: boolean
    /** Whether the backend may select the private Auth table. */
    readonly auth_table: boolean
}

/** The declared limits of the avatars bucket. */
export interface AvatarsBucketRow {
    /** Whether the bucket is publicly readable. */
    readonly public: boolean
    /** The size limit in bytes, as text. */
    readonly file_size_limit: string
    /** The media types the bucket accepts. */
    readonly allowed_mime_types: Array<string>
}

/** One storage policy that names the avatars bucket. */
export interface AvatarsPolicyRow {
    /** The policy name. */
    readonly policyname: string
    /** The command it covers. */
    readonly cmd: string
    /** The roles it applies to. */
    readonly roles: Array<string>
}

/** Reads the pictures the server-only helper shares for the requested accounts of one workspace, in id order. */
export const roomMemberAvatars = async (
    manager: EntityManager,
    workspaceId: string,
    userIds: ReadonlyArray<string>,
): Promise<ReadonlyArray<MemberAvatarRow>> => {
    const rows = await callDbFunction<MemberAvatarRow>(manager, "be_access.workspace_member_avatars", [
        workspaceId,
        userIds,
    ])
    return [...rows].sort((left, right) => left.id.localeCompare(right.id))
}

/** Writes a picture address straight to an agent row, as the table check sees it. */
export const writeAgentAvatar = async (manager: EntityManager, agentId: string, address: string): Promise<void> => {
    await manager.update(AgentEntity, { id: agentId }, { avatarUrl: address })
}

/** Reads the grants on the agent picture column. */
export const agentAvatarPrivileges = (manager: EntityManager): Promise<Array<AgentAvatarPrivilegeRow>> =>
    manager.query<Array<AgentAvatarPrivilegeRow>>(AGENT_AVATAR_PRIVILEGES)

/** Reads the grants around the member avatar helper. */
export const roomMemberAvatarPrivileges = (manager: EntityManager): Promise<Array<MemberAvatarPrivilegeRow>> =>
    manager.query<Array<MemberAvatarPrivilegeRow>>(ROOM_MEMBER_AVATAR_PRIVILEGES)

/** Reads the declared limits of the avatars bucket. */
export const avatarsBucket = (manager: EntityManager): Promise<Array<AvatarsBucketRow>> =>
    manager.query<Array<AvatarsBucketRow>>(READ_AVATARS_BUCKET)

/** Reads every storage policy that names the avatars bucket. */
export const avatarsPolicies = (manager: EntityManager): Promise<Array<AvatarsPolicyRow>> =>
    manager.query<Array<AvatarsPolicyRow>>(READ_AVATARS_POLICIES)

/** Runs a proof as the signed-in browser role and rolls back both the local role membership and the proof's writes. */
export const withBrowserRole = async (
    world: LiteWorld,
    proof: (manager: EntityManager) => Promise<void>,
): Promise<void> => {
    const runner = world.db.primary.connection.createQueryRunner()
    try {
        await runner.connect()
        await runner.startTransaction()
        await runner.manager.query(ENTER_BROWSER_ROLE)
        await runner.manager.query(USE_BROWSER_ROLE)
        await proof(runner.manager)
    } finally {
        if (runner.isTransactionActive) await runner.rollbackTransaction()
        await runner.release()
    }
}

/** A browser trying to place an object in the avatars bucket itself. */
export const browserWriteAvatar = async (manager: EntityManager, objectName: string): Promise<void> => {
    await manager.query(BROWSER_WRITE_AVATAR, [objectName])
}
