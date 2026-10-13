import { Injectable } from "@nestjs/common"
import type { SupabaseAdminClient } from "./supabase.client"
import { InjectSupabaseAdminClient } from "./supabase.decorators"

type Bucket = ReturnType<SupabaseAdminClient["storage"]["from"]>

@Injectable()
/** File storage through Supabase Storage for the domains: read one file of a bucket, write one file replacing an earlier one. */
export class SupabaseStorageService {
    constructor(@InjectSupabaseAdminClient() private readonly admin: SupabaseAdminClient) {}

    /** Reads one file of a bucket. */
    download(bucket: string, path: string): ReturnType<Bucket["download"]> {
        return this.admin.storage.from(bucket).download(path)
    }

    /** Writes one file into a bucket, replacing an earlier file at the same path. */
    upload(bucket: string, path: string, body: Buffer, contentType: string): ReturnType<Bucket["upload"]> {
        return this.admin.storage.from(bucket).upload(path, body, { contentType, upsert: true })
    }
}
