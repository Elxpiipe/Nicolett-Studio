// src/utils/contacto.js
// Datos de contacto del salon (tomados de sus publicaciones de Instagram).

export const CONTACTO = {
  direccion: "Avenida Bernardo O'Higgins 979, Buin",
  mapa: "https://www.google.com/maps/search/?api=1&query=Avenida+Bernardo+O'Higgins+979+Buin",
  whatsappVisible: "+56 9 4032 2551",
  whatsappNumero: "56940322551",
  instagram: "@nicolettstudiofantasy",
  instagramUrl: "https://www.instagram.com/nicolettstudiofantasy/",
};

export function enlaceWhatsApp(mensaje) {
  return `https://wa.me/${CONTACTO.whatsappNumero}?text=${encodeURIComponent(mensaje)}`;
}
