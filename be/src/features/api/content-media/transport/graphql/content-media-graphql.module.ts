import { Module } from "@nestjs/common"
import { ContentMediaApiModule } from "../../content-media.module"
import { ContentMediaLibraryResolver } from "./content-media-library.resolver"
import { ContentMediaResolver } from "./content-media.resolver"
import { RequestContentMediaUploadResolver } from "./request-content-media-upload.resolver"

@Module({
    imports: [ContentMediaApiModule],
    providers: [ContentMediaLibraryResolver, ContentMediaResolver, RequestContentMediaUploadResolver],
})
/** The GraphQL transport of workspace content media. */
export class ContentMediaGraphqlModule {}
