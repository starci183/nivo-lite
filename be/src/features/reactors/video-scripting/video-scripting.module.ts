import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./video-scripting.module-definition"
import { CompleteVideoScriptHandler } from "./application/complete-video-script.handler"

@Module({ providers: [CompleteVideoScriptHandler] })
/** The video-scripting reactor: the handlers its consumers dispatch to. */
export class VideoScriptingModule extends ConfigurableModuleClass {}
