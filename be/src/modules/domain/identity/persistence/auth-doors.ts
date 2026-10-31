import type { EntityManager } from "typeorm"
import { callDbFunction } from "@modules/platform/database"

/** A point in time as a door answers it. */
type Instant = Date | string

/** The account a lookup by email answers. */
export interface AuthUserByEmail {
    /** The account id. */
    readonly id: string
    /** The address. */
    readonly email: string
    /** The stored password hash, or null for an account that never set one. */
    readonly encrypted_password: string | null
    /** When the mailbox was confirmed, or null. */
    readonly email_confirmed_at: Instant | null
    /** Whether the account is disabled. */
    readonly disabled: boolean
}

/** The account a lookup by id answers. */
export interface AuthUserById {
    /** The account id. */
    readonly id: string
    /** The address, or null. */
    readonly email: string | null
    /** The last sign-in, or null. */
    readonly last_sign_in_at: Instant | null
    /** The profile metadata. */
    readonly meta: Record<string, unknown>
    /** Whether the account is disabled. */
    readonly disabled: boolean
}

/** One person as the operator listing answers. */
export interface AuthUserListed {
    /** The account id. */
    readonly id: string
    /** The address, or null. */
    readonly email: string | null
    /** The profile metadata. */
    readonly meta: Record<string, unknown>
}

/** An account to create. */
export interface NewAuthUser {
    /** The account id. */
    readonly id: string
    /** The address. */
    readonly email: string
    /** The password hash, or null for an invited or Google-only account. */
    readonly hash: string | null
    /** Whether the mailbox counts as confirmed. */
    readonly confirmed: boolean
    /** The profile metadata as JSON text. */
    readonly meta: string
    /** The instant of creation. */
    readonly now: Date
}

/** A device session to open. */
export interface NewAuthSession {
    /** The session id. */
    readonly id: string
    /** The account it belongs to. */
    readonly userId: string
    /** The instant it opens. */
    readonly now: Date
    /** The raw user agent, or null. */
    readonly userAgent: string | null
    /** The caller address, or null. */
    readonly ip: string | null
}

/** The SECURITY DEFINER doors of the app-owned auth tables (`auth.users`, `auth.sessions`, `auth.identities`); the app never touches those tables itself. */
export const authDoors = {
    /** The account of an address, or undefined. */
    async userByEmail(manager: EntityManager, email: string): Promise<AuthUserByEmail | undefined> {
        const [row] = await callDbFunction<AuthUserByEmail>(manager, "public.be_auth_user_by_email", [email])
        return row
    },
    /** The account of an id, or undefined. */
    async userById(manager: EntityManager, userId: string): Promise<AuthUserById | undefined> {
        const [row] = await callDbFunction<AuthUserById>(manager, "public.be_auth_user_by_id", [userId])
        return row
    },
    /** The account a Google subject is linked to, or null. */
    async userByGoogle(manager: EntityManager, subject: string): Promise<string | null> {
        const [row] = await callDbFunction<{ be_auth_user_by_google: string | null }>(
            manager,
            "public.be_auth_user_by_google",
            [subject],
        )
        return row?.be_auth_user_by_google ?? null
    },
    /** Creates an account and answers its id. */
    async createUser(manager: EntityManager, user: NewAuthUser): Promise<string | undefined> {
        const [row] = await callDbFunction<{ be_auth_create_user: string }>(manager, "public.be_auth_create_user", [
            user.id,
            user.email,
            user.hash,
            user.confirmed,
            user.meta,
            user.now,
        ])
        return row?.be_auth_create_user
    },
    /** Links a Google subject to an account. */
    async linkGoogle(manager: EntityManager, userId: string, subject: string, data: string, now: Date): Promise<void> {
        await callDbFunction(manager, "public.be_auth_link_google", [userId, subject, data, now])
    },
    /** Records a sign-in and fills profile keys the person did not set. */
    async touchUser(manager: EntityManager, userId: string, now: Date, confirm: boolean, meta: string): Promise<void> {
        await callDbFunction(manager, "public.be_auth_touch_user", [userId, now, confirm, meta])
    },
    /** Sets the password hash of an account. */
    async setPassword(manager: EntityManager, userId: string, hash: string, now: Date): Promise<void> {
        await callDbFunction(manager, "public.be_auth_set_password", [userId, hash, now])
    },
    /** Keeps or drops the uploaded picture; whether an account was changed. */
    async setAvatar(manager: EntityManager, userId: string, url: string | null): Promise<boolean> {
        const [row] = await callDbFunction<{ be_auth_set_avatar: boolean }>(manager, "public.be_auth_set_avatar", [
            userId,
            url,
        ])
        return row?.be_auth_set_avatar === true
    },
    /** Opens a device session. */
    async openSession(manager: EntityManager, session: NewAuthSession): Promise<void> {
        await callDbFunction(manager, "public.be_auth_open_session", [
            session.id,
            session.userId,
            session.now,
            session.userAgent,
            session.ip,
        ])
    },
    /** Marks a session refreshed. */
    async touchSession(manager: EntityManager, sessionId: string, now: Date): Promise<void> {
        await callDbFunction(manager, "public.be_auth_touch_session", [sessionId, now])
    },
    /** Ends one session. */
    async closeSession(manager: EntityManager, sessionId: string): Promise<void> {
        await callDbFunction(manager, "public.be_auth_close_session", [sessionId])
    },
    /** Ends every session of an account. */
    async closeUserSessions(manager: EntityManager, userId: string): Promise<void> {
        await callDbFunction(manager, "public.be_auth_close_user_sessions", [userId])
    },
    /** Ends every session of an account but one. */
    async closeOtherSessions(manager: EntityManager, userId: string, keepSessionId: string): Promise<void> {
        await callDbFunction(manager, "public.be_auth_close_other_sessions", [userId, keepSessionId])
    },
    /** One bounded page of accounts (the door holds a page to 1000 people), oldest first. */
    listUsers(manager: EntityManager, page: number, perPage: number): Promise<ReadonlyArray<AuthUserListed>> {
        return callDbFunction<AuthUserListed>(manager, "public.be_auth_list_users", [page, perPage])
    },
    /** Deletes an account for good; whether one was deleted. */
    async deleteUser(manager: EntityManager, userId: string): Promise<boolean> {
        const [row] = await callDbFunction<{ be_auth_delete_user: boolean }>(manager, "public.be_auth_delete_user", [
            userId,
        ])
        return row?.be_auth_delete_user === true
    },
    /** Confirms the mailbox of an account. */
    async confirmEmail(manager: EntityManager, userId: string, now: Date): Promise<void> {
        await callDbFunction(manager, "public.be_auth_confirm_email", [userId, now])
    },
}
