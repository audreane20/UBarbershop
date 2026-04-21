// Frontend-safe Brevo settings only.
// The actual Brevo API key must be stored in config.local.php on the server.

export const BREVO_CONFIG = {
    senderName: "UBarbershop",
    senderEmail: "ubarbershop2023@gmail.com",
    confirmTemplateId: 1,
    reminderTemplateId: 3,
    cancelTemplateId: 4
};
