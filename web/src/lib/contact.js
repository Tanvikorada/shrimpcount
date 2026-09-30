// Where "Contact us for access" goes. Fill in CONTACT_PHONE (with country code, digits only, e.g. "919876543210") to
// also show a WhatsApp button - it opens a chat with the message pre-typed. Left blank, only the email button shows.
export const CONTACT_EMAIL = 'tanvikorada@gmail.com'
export const CONTACT_PHONE = ''

export const mailtoAccess = (hatchery) =>
  `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('ShrimpCount access')}&body=${encodeURIComponent(`Hatchery: ${hatchery || ''}\nI'd like to start using ShrimpCount. Please send login details.`)}`

export const whatsappAccess = (hatchery) =>
  CONTACT_PHONE ? `https://wa.me/${CONTACT_PHONE}?text=${encodeURIComponent(`Hi, I'd like to start using ShrimpCount for ${hatchery || 'my hatchery'}. Please send login details.`)}` : null
