// Mirrors major_data_link/lib/core/config/app_config.dart and
// major_data_link_backend/src/routes/legal.routes.ts. If contact details
// change, update all three.
export const CONTACT = {
  whatsapp: '+2348037289774',
  phoneAlt: '07025859543',
  whatsappChannelUrl: 'https://whatsapp.com/channel/0029Vb8KzHy5PO0stgnsNy0l',
  email: 'kindnesscomp20@gmail.com',
  emailDisplay: 'kindnesscomp20@gmail.com / sunusiusama94@gmail.com',
};

export function whatsappLink(text: string) {
  const digits = CONTACT.whatsapp.replace('+', '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
