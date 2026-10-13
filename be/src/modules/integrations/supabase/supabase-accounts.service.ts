import { Injectable } from "@nestjs/common"
import type { SupabaseAdminClient } from "./supabase.client"
import { InjectSupabaseAdminClient } from "./supabase.decorators"

type Admin = SupabaseAdminClient["auth"]

/** Which page of users to list. */
export interface AccountsPage {
    /** The page number, from 1. */
    readonly page: number
    /** How many users a page holds. */
    readonly perPage: number
}

@Injectable()
/** Account administration through Supabase Auth for the operator commands: list, create and update users. */
export class SupabaseAccountsService {
    constructor(@InjectSupabaseAdminClient() private readonly admin: SupabaseAdminClient) {}

    /** One page of users. */
    listUsers(params: AccountsPage): ReturnType<Admin["listUsers"]> {
        return this.admin.auth.listUsers(params)
    }

    /** Creates a user. */
    createUser(attributes: Parameters<Admin["createUser"]>[0]): ReturnType<Admin["createUser"]> {
        return this.admin.auth.createUser(attributes)
    }

    /** Updates a user's password, confirmation and metadata. */
    updateUserById(
        id: string,
        attributes: Parameters<Admin["updateUserById"]>[1],
    ): ReturnType<Admin["updateUserById"]> {
        return this.admin.auth.updateUserById(id, attributes)
    }
}
