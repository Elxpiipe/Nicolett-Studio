// src/utils/webpay.js
// Webpay exige que el navegador llegue a su formulario con un POST que lleve
// el token en el campo "token_ws". Se arma un formulario invisible y se envia.
export function irAWebpay({ url, token }) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = url;
  const campo = document.createElement("input");
  campo.type = "hidden";
  campo.name = "token_ws";
  campo.value = token;
  form.appendChild(campo);
  document.body.appendChild(form);
  form.submit();
}
