// Brevo config for client-side confirmation emails.
// IMPORTANT: for production, move this API key to a backend / Firebase Function.
// For now, paste your Brevo API key below to send confirmation emails directly with Brevo.

export const BREVO_CONFIG = {
    apiKey: "ADD API KEY",
    senderName: "UBarbershop",
    senderEmail: "ubarbershop2023@gmail.com",
    confirmTemplateId: 1,
    reminderTemplateId: 3,
    cancelTemplateId: 4
};
