import type { EntityManager } from "typeorm"
import { callDbFunction } from "@modules/platform/database"

/** A point in time as a door answers it. */
type Instant = Date | string

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

/**
 * The SECURITY DEFINER doors of the product beside the account doors of the sign-in glue (`account-doors.port.ts`): the profile of
 * one account, the uploaded picture, the operator listing and the deletion. The app never touches the auth tables itself.
 */
export const authDoors = {
    /** The profile of an account by id, or undefined. */
    async userById(manager: EntityManager, userId: string): Promise<AuthUserById | undefined> {
        const [row] = await callDbFunction<AuthUserById>(manager, "public.be_auth_user_by_id", [userId])
        return row
    },
    /** Keeps or drops the uploaded picture; whether an account was changed. */
    async setAvatar(manager: EntityManager, userId: string, url: string | null): Promise<boolean> {
        const [row] = await callDbFunction<{ be_auth_set_avatar: boolean }>(manager, "public.be_auth_set_avatar", [
            userId,
            url,
        ])
        return row?.be_auth_set_avatar === true
    },
    /** Writes the full name of an unconfirmed account that has none; whether an account was changed. */
    async setSignupName(manager: EntityManager, email: string, name: string): Promise<boolean> {
        const [row] = await callDbFunction<{ be_auth_set_signup_name: boolean }>(
            manager,
            "public.be_auth_set_signup_name",
            [email, name],
        )
        return row?.be_auth_set_signup_name === true
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
}
