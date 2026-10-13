import { Injectable } from "@nestjs/common"
import type { SupabaseAdminClient } from "./supabase.client"
import { InjectSupabaseAdminClient } from "./supabase.decorators"

type Bucket = ReturnType<SupabaseAdminClient["storage"]["from"]>

@Injectable()
/** Object storage through Supabase Storage for the domains that move files: read one object and write one object of a bucket. */
export class SupabaseStorageService {
    constructor(@InjectSupabaseAdminClient() private readonly admin: SupabaseAdminClient) {}

    /** The bytes of one object of a bucket; the answer carries the storage error instead of throwing it. */
    download(bucket: string, path: string): ReturnType<Bucket["download"]> {
        return this.admin.storage.from(bucket).download(path)
    }

    /** Writes one object into a bucket; the answer carries the storage error instead of throwing it. */
    upload(
        bucket: string,
        path: string,
        body: Parameters<Bucket["upload"]>[1],
        options: Parameters<Bucket["upload"]>[2],
    ): ReturnType<Bucket["upload"]> {
        return this.admin.storage.from(bucket).upload(path, body, options)
    }
}
