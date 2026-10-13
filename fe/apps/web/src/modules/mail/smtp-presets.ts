import type { SmtpPreset } from "./smtp-presets.types"

/**
 * The SMTP providers the outgoing-email wizard offers. Each choice prefills host, port and security and carries a short guide for a
 * non-technical owner (checked against each provider's own documentation). Every word is a key of the `smtpPresets` catalog.
 */
export const SMTP_PRESETS: ReadonlyArray<SmtpPreset> = [
    {
        id: "google_workspace",
        title: "google_workspace_title",
        blurb: "google_workspace_blurb",
        modes: [
            {
                id: "app_password",
                label: "google_workspace_app_password_label",
                when: "google_workspace_app_password_when",
                host: "smtp.gmail.com",
                port: 587,
                security: "starttls",
                userIsEmail: true,
                passwordLabel: "google_workspace_app_password_passwordLabel",
                passwordHint: "google_workspace_app_password_passwordHint",
                steps: [
                    {
                        text: "google_workspace_app_password_step1",
                        link: {
                            label: "google_workspace_app_password_step1_link",
                            url: "https://myaccount.google.com/signinoptions/twosv",
                        },
                    },
                    {
                        text: "google_workspace_app_password_step2",
                        link: {
                            label: "google_workspace_app_password_step2_link",
                            url: "https://myaccount.google.com/apppasswords",
                        },
                    },
                    { text: "google_workspace_app_password_step3" },
                    { text: "google_workspace_app_password_step4" },
                ],
                cautions: ["google_workspace_app_password_caution1"],
            },
            {
                id: "relay",
                label: "google_workspace_relay_label",
                when: "google_workspace_relay_when",
                host: "smtp-relay.gmail.com",
                port: 587,
                security: "starttls",
                userIsEmail: true,
                passwordLabel: "google_workspace_relay_passwordLabel",
                passwordHint: "google_workspace_relay_passwordHint",
                steps: [
                    {
                        text: "google_workspace_relay_step1",
                        link: { label: "google_workspace_relay_step1_link", url: "https://admin.google.com" },
                    },
                    {
                        text: "google_workspace_relay_step2",
                        link: {
                            label: "google_workspace_relay_step2_link",
                            url: "https://knowledge.workspace.google.com/admin/gmail/advanced/route-outgoing-smtp-relay-messages-through-google",
                        },
                    },
                ],
                cautions: ["google_workspace_relay_caution1"],
            },
        ],
    },
    {
        id: "gmail",
        title: "gmail_title",
        blurb: "gmail_blurb",
        modes: [
            {
                id: "app_password",
                label: "gmail_app_password_label",
                when: "gmail_app_password_when",
                host: "smtp.gmail.com",
                port: 587,
                security: "starttls",
                userIsEmail: true,
                passwordLabel: "gmail_app_password_passwordLabel",
                passwordHint: "gmail_app_password_passwordHint",
                steps: [
                    {
                        text: "gmail_app_password_step1",
                        link: {
                            label: "gmail_app_password_step1_link",
                            url: "https://myaccount.google.com/signinoptions/twosv",
                        },
                    },
                    {
                        text: "gmail_app_password_step2",
                        link: {
                            label: "gmail_app_password_step2_link",
                            url: "https://myaccount.google.com/apppasswords",
                        },
                    },
                    { text: "gmail_app_password_step3" },
                ],
                cautions: ["gmail_app_password_caution1"],
            },
        ],
    },
    {
        id: "microsoft365",
        title: "microsoft365_title",
        blurb: "microsoft365_blurb",
        modes: [
            {
                id: "smtp_auth",
                label: "microsoft365_smtp_auth_label",
                when: "microsoft365_smtp_auth_when",
                host: "smtp.office365.com",
                port: 587,
                security: "starttls",
                userIsEmail: true,
                passwordLabel: "microsoft365_smtp_auth_passwordLabel",
                passwordHint: "microsoft365_smtp_auth_passwordHint",
                steps: [
                    {
                        text: "microsoft365_smtp_auth_step1",
                        link: {
                            label: "microsoft365_smtp_auth_step1_link",
                            url: "https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission",
                        },
                    },
                    { text: "microsoft365_smtp_auth_step2" },
                ],
                cautions: ["microsoft365_smtp_auth_caution1", "microsoft365_smtp_auth_caution2"],
            },
        ],
    },
    {
        id: "zoho",
        title: "zoho_title",
        blurb: "zoho_blurb",
        modes: [
            {
                id: "custom_domain",
                label: "zoho_custom_domain_label",
                when: "zoho_custom_domain_when",
                host: "smtppro.zoho.com",
                port: 587,
                security: "starttls",
                userIsEmail: true,
                passwordLabel: "zoho_custom_domain_passwordLabel",
                passwordHint: "zoho_custom_domain_passwordHint",
                steps: [
                    {
                        text: "zoho_custom_domain_step1",
                        link: {
                            label: "zoho_custom_domain_step1_link",
                            url: "https://accounts.zoho.com/home#security/app_password",
                        },
                    },
                    { text: "zoho_custom_domain_step2" },
                ],
                cautions: ["zoho_custom_domain_caution1"],
            },
            {
                id: "personal",
                label: "zoho_personal_label",
                when: "zoho_personal_when",
                host: "smtp.zoho.com",
                port: 587,
                security: "starttls",
                userIsEmail: true,
                passwordLabel: "zoho_personal_passwordLabel",
                passwordHint: "zoho_personal_passwordHint",
                steps: [{ text: "zoho_personal_step1" }],
                cautions: [],
            },
        ],
    },
    {
        id: "vn_hosting",
        title: "vn_hosting_title",
        blurb: "vn_hosting_blurb",
        modes: [
            {
                id: "hosting",
                label: "vn_hosting_hosting_label",
                when: "vn_hosting_hosting_when",
                host: "",
                port: 587,
                security: "starttls",
                hostEditable: true,
                userIsEmail: true,
                passwordLabel: "vn_hosting_hosting_passwordLabel",
                passwordHint: "vn_hosting_hosting_passwordHint",
                steps: [{ text: "vn_hosting_hosting_step1" }, { text: "vn_hosting_hosting_step2" }],
                cautions: ["vn_hosting_hosting_caution1"],
            },
        ],
    },
    {
        id: "relay_service",
        title: "relay_service_title",
        blurb: "relay_service_blurb",
        modes: [
            {
                id: "resend",
                label: "relay_service_resend_label",
                when: "relay_service_resend_when",
                host: "smtp.resend.com",
                port: 587,
                security: "starttls",
                fixedUser: "resend",
                passwordLabel: "relay_service_resend_passwordLabel",
                passwordHint: "relay_service_resend_passwordHint",
                steps: [
                    {
                        text: "relay_service_resend_step1",
                        link: { label: "relay_service_resend_step1_link", url: "https://resend.com/domains" },
                    },
                    {
                        text: "relay_service_resend_step2",
                        link: { label: "relay_service_resend_step2_link", url: "https://resend.com/api-keys" },
                    },
                ],
                cautions: ["relay_service_resend_caution1"],
            },
            {
                id: "sendgrid",
                label: "relay_service_sendgrid_label",
                when: "relay_service_sendgrid_when",
                host: "smtp.sendgrid.net",
                port: 587,
                security: "starttls",
                fixedUser: "apikey",
                passwordLabel: "relay_service_sendgrid_passwordLabel",
                passwordHint: "relay_service_sendgrid_passwordHint",
                steps: [
                    {
                        text: "relay_service_sendgrid_step1",
                        link: {
                            label: "relay_service_sendgrid_step1_link",
                            url: "https://app.sendgrid.com/settings/sender_auth",
                        },
                    },
                    {
                        text: "relay_service_sendgrid_step2",
                        link: {
                            label: "relay_service_sendgrid_step2_link",
                            url: "https://app.sendgrid.com/settings/api_keys",
                        },
                    },
                ],
                cautions: [],
            },
            {
                id: "ses",
                label: "relay_service_ses_label",
                when: "relay_service_ses_when",
                host: "email-smtp.ap-southeast-1.amazonaws.com",
                port: 587,
                security: "starttls",
                hostEditable: true,
                passwordLabel: "relay_service_ses_passwordLabel",
                passwordHint: "relay_service_ses_passwordHint",
                steps: [
                    {
                        text: "relay_service_ses_step1",
                        link: {
                            label: "relay_service_ses_step1_link",
                            url: "https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html",
                        },
                    },
                    { text: "relay_service_ses_step2" },
                ],
                cautions: ["relay_service_ses_caution1"],
            },
        ],
    },
]

/** The mode of a preset by id, or its first mode. */
export const modeOf = (preset: SmtpPreset, id: string): SmtpPreset["modes"][number] =>
    preset.modes.find((mode) => mode.id === id) ?? preset.modes[0]
