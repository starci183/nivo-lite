import { Module } from "@nestjs/common"
import { DataHubModule } from "@modules/domain/data-hub"
import { OpenApiCli } from "./openapi.cli"
import { ConfigurableModuleClass } from "./openapi.module-definition"
import { NamesOpenApiCli } from "./subs/names.cli"
import { PinViewOpenApiCli } from "./subs/pin-view.cli"
import { PinOpenApiCli } from "./subs/pin.cli"

@Module({ imports: [DataHubModule.pinOnly({})], providers: [OpenApiCli, PinOpenApiCli, PinViewOpenApiCli, NamesOpenApiCli] })
/** The openapi group: the command, its two sub-commands over the pin of an API account (pin, pin-view) and the names generator of a source (names). */
export class OpenApiCliModule extends ConfigurableModuleClass {}
