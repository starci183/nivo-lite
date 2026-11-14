import type {
    ConnectionFieldChange,
    FieldRefusal,
    ProviderFieldsDeclaration,
} from "@modules/domain/connection-fields"
import type { ConnectionRecord } from "@modules/domain/connections"
import { LISTED_BANKS } from "./bank-name.policy"
import type { UpdateMoneyInput } from "./channel-connections.contracts"
import { MONEY_FIELD_WORDS } from "./messages/channel-connections.messages"
import { isAccountNumber, isSepayKey, squeeze } from "./money-provider.policy"

/** The name of the list the bank picker draws (its options are `LISTED_BANKS`; a page may draw each with its logo). */
const BANKS_SOURCE = "banks"

/** The bank account fields every bank feed has (`needsBank`), as its edit takes them. */
const BANK_FIELDS: ProviderFieldsDeclaration["fields"] = [
    {
        key: "bankCode",
        label: MONEY_FIELD_WORDS.bankCode,
        kind: "choice",
        required: true,
        maxLength: null,
        choices: LISTED_BANKS.map((bank) => ({ value: bank.code, label: { vi: bank.name, en: bank.name } })),
        choiceSource: BANKS_SOURCE,
        searchable: true,
        source: { kind: "meta", key: "bank_code" },
    },
    {
        key: "accountNumber",
        label: MONEY_FIELD_WORDS.accountNumber,
        kind: "text",
        required: false,
        maxLength: 20,
        choices: [],
        source: { kind: "meta", key: "account_masked" },
        guidance: { text: null, key: "sepayConnection.stepAccountHint" },
    },
    {
        key: "holder",
        label: MONEY_FIELD_WORDS.holder,
        kind: "text",
        required: true,
        maxLength: 80,
        choices: [],
        source: { kind: "meta", key: "account_holder" },
    },
]

/**
 * The connection forms of the bank and payment feeds, the fields `updateMoneyConnection` edits (owner only). SePay: its webhook
 * address to paste at SePay (shown, copyable), its bank account (bank from the listed banks), test or live (going live asks first:
 * from then on real money is booked) and its API key (sealed, write-only). Casso: its bank account (its secure key keeps its own
 * step). payOS: only its name (its three keys are replaced together in their own step).
 */
export const MONEY_FIELD_DECLARATIONS: ReadonlyArray<ProviderFieldsDeclaration> = [
    {
        provider: "sepay",
        editableBy: ["owner"],
        canTest: false,
        guidance: { text: null, key: "sepayConnection.stepPasteHint" },
        fields: [
            {
                key: "webhookUrl",
                label: MONEY_FIELD_WORDS.webhookUrl,
                kind: "identity",
                required: false,
                maxLength: null,
                choices: [],
                copyable: true,
                source: { kind: "webhook-url" },
            },
            ...BANK_FIELDS,
            {
                key: "environment",
                label: MONEY_FIELD_WORDS.environment,
                kind: "choice",
                required: true,
                maxLength: null,
                choices: [
                    { value: "test", label: MONEY_FIELD_WORDS.test },
                    {
                        value: "live",
                        label: MONEY_FIELD_WORDS.live,
                        confirm: { text: null, key: "sepayConnection.liveConfirmBody" },
                    },
                ],
                source: { kind: "environment" },
                guidance: { text: null, key: "sepayConnection.stepEnvironmentHint" },
            },
            {
                key: "apiKey",
                label: MONEY_FIELD_WORDS.apiKey,
                kind: "secret",
                required: false,
                maxLength: 128,
                choices: [],
                source: { kind: "none" },
                sealedBy: { kind: "stored-secret" },
                guidance: { text: null, key: "sepayConnection.keyNote" },
            },
        ],
    },
    { provider: "casso", editableBy: ["owner"], canTest: false, fields: BANK_FIELDS },
    { provider: "payos", editableBy: ["owner"], canTest: false, fields: [] },
]

/**
 * The values of a change the feed's own edit would refuse, found before anything is written, with the SAME rule functions the edit
 * uses: an account number that is not 6 to 20 digits, a SePay key that is not one.
 */
export const moneyRefusalsOf = (change: ConnectionFieldChange): ReadonlyArray<FieldRefusal> => {
    const refusals: Array<FieldRefusal> = []
    const account = change.values.accountNumber
    if (account !== undefined && !isAccountNumber(squeeze(account))) refusals.push({ key: "accountNumber", reason: "not_an_account_number" })
    const apiKey = change.values.apiKey
    if (apiKey !== undefined && !isSepayKey(apiKey)) refusals.push({ key: "apiKey", reason: "not_a_key" })
    return refusals
}

/**
 * The input of the feed's own edit for a checked change: what the change leaves out keeps the stored value (the name, the bank facts,
 * the environment; a blank account number and an absent key keep theirs, as the edit itself rules).
 */
export const moneyUpdateOf = (record: ConnectionRecord, change: ConnectionFieldChange): UpdateMoneyInput => ({
    environment: change.values.environment ?? record.environment,
    name: change.displayName ?? record.name,
    bankCode: change.values.bankCode ?? record.meta.bank_code ?? "",
    accountNumber: change.values.accountNumber ?? "",
    holder: change.values.holder ?? record.meta.account_holder ?? "",
    apiKey: change.values.apiKey,
})
