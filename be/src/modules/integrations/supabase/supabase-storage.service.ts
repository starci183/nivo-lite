import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import { SupabaseErrorCode } from "./errors/supabase.error"
import type { SupabaseAdminClient } from "./supabase.client"
import { InjectSupabaseAdminClient } from "./supabase.decorators"
import { SupabaseLogEvent } from "./supabase.log-events"
import type { SignedUploadOutcome, StoredObjectOutcome, SupabaseStoragePort } from "./supabase.port"

/** The HTTP statuses Storage uses for an object that is not there. */
const NOT_FOUND_STATUSES = new Set(["400", "404"])

@Injectable()
/** Issues upload addresses and reads objects through Supabase Storage; the only door domains have to Storage. */
export class SupabaseStorageService implements SupabaseStoragePort {
    constructor(
        @InjectSupabaseAdminClient() private readonly admin: SupabaseAdminClient,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** A one-time address a browser PUTs one object to at `path` of `bucket`. */
    async signedUpload(bucket: string, path: string): Promise<SignedUploadOutcome> {
        const signed = await this.admin.storage.from(bucket).createSignedUploadUrl(path)
        if (signed.error !== null) {
            this.logger.error(SupabaseLogEvent.StorageFailed, signed.error, { bucket })
            return refused(SupabaseErrorCode.ProviderUnavailable)
        }
        return ok({ path: signed.data.path, token: signed.data.token, signedUrl: signed.data.signedUrl })
    }

    /** The bytes and content type of the object at `path` of `bucket`. */
    async download(bucket: string, path: string): Promise<StoredObjectOutcome> {
        const found = await this.admin.storage.from(bucket).download(path)
        if (found.error !== null) {
            const status = String(Reflect.get(found.error, "statusCode") ?? Reflect.get(found.error, "status"))
            if (NOT_FOUND_STATUSES.has(status) || /not.?found/iu.test(found.error.message)) {
                return refused(SupabaseErrorCode.ObjectNotFound)
            }
            this.logger.error(SupabaseLogEvent.StorageFailed, found.error, { bucket })
            return refused(SupabaseErrorCode.ProviderUnavailable)
        }
        return ok({ bytes: new Uint8Array(await found.data.arrayBuffer()), contentType: found.data.type })
    }
}
