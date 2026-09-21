/** The Facebook / Instagram chat inbox: the Leads page, the chat history on customer
 * pages, and copying new Messenger / Instagram messages into the CRM.
 *
 * It's OFF unless the setting META_CHATS_ENABLED is exactly "true" -- chats are handled
 * on Facebook itself, and orders arrive from Reckon invoices. Switching it back on is
 * just adding that setting in Vercel and redeploying; nothing has to be rebuilt, and any
 * chats already stored are still there. */
export const metaChatsEnabled = () => process.env.META_CHATS_ENABLED === "true";
