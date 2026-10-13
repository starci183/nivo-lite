import { Injectable } from "@nestjs/common"
import { InjectSupabaseObjects } from "@modules/integrations/supabase"
import type { SupabaseObjectsPort } from "@modules/integrations/supabase"
import { CvStorage } from "./cv-storage.port"

/** The private Storage bucket of candidate CVs (managers read it through their own policy, the back end through the service role). */
const BUCKET = "hiring"

/** How long a link to look at a CV lives: ten minutes. */
const VIEW_SECONDS = 600

@Injectable()
/** Candidate CV files in Supabase Storage: short-lived view links, one-time upload tokens for the public apply page, and removal. */
export class SupabaseCvStorageService extends CvStorage {
    constructor(@InjectSupabaseObjects() private readonly objects: SupabaseObjectsPort) {
        super()
    }

    /** Removes files by path; a Storage failure removes nothing. */
    override async remove(paths: ReadonlyArray<string>): Promise<number> {
        const removed = await this.objects.remove(BUCKET, paths)
        return removed.kind === "ok" ? removed.value : 0
    }

    /** A ten-minute link to the file, or null when it is not there. */
    override async signedUrl(path: string): Promise<string | null> {
        const signed = await this.objects.signedUrls(BUCKET, [path], VIEW_SECONDS)
        return signed.kind === "ok" ? (signed.value[0]?.signedUrl ?? null) : null
    }

    /** The one-time token the apply page uploads the file at `path` with, or null when Storage refuses. */
    override async signedUpload(path: string): Promise<string | null> {
        const signed = await this.objects.signedUpload(BUCKET, path)
        return signed.kind === "ok" ? signed.value.token : null
    }
}
