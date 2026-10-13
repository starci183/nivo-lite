import { createParamDecorator } from "@nestjs/common"
import type { ExecutionContext } from "@nestjs/common"
import { requestOf } from "@modules/platform/http-security"
import type { Locale } from "./i18n.contracts"
import { pickLocale } from "./request-locale.policy"

/** The locale of the request, picked from its `Accept-Language` header: Vietnamese or English, Vietnamese by default. */
export const AcceptedLocale = createParamDecorator((_data: unknown, context: ExecutionContext): Locale =>
    pickLocale(requestOf(context).headers["accept-language"]),
)
