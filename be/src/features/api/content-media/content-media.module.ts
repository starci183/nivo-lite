import { Module } from "@nestjs/common"
import { GetContentMediaHandler } from "./application/get-content-media.handler"
import { ListContentMediaLibraryHandler } from "./application/list-content-media-library.handler"
import { RequestContentMediaUploadHandler } from "./application/request-content-media-upload.handler"

@Module({ providers: [GetContentMediaHandler, ListContentMediaLibraryHandler, RequestContentMediaUploadHandler] })
/** The application handlers of the content-media feature. */
export class ContentMediaApiModule {}
