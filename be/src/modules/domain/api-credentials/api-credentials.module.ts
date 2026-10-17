import { Module } from "@nestjs/common"
import { ApiCredentialAuthenticatorService } from "./api-credential-authenticator.service"
import { ConfigurableModuleClass } from "./api-credentials.module-definition"

@Module({ providers: [ApiCredentialAuthenticatorService], exports: [ApiCredentialAuthenticatorService] })
/** Composes domain credential checks behind identity's authentication port. */
export class ApiCredentialsModule extends ConfigurableModuleClass {}
