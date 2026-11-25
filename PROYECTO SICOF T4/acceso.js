/* Demo: el código de administrador está en el navegador. En producción se valida en un servidor. */
const CODIGO_ADMIN = "SICOF-ADMIN-2026";
const abiertas = sesiones();
if (abiertas.length) { $("#ya").hidden = false; $("#ya").innerHTML = "<b>Tienes sesión abierta</b>" + abiertas.map(s => `<p style="margin:8px 0 0"><a class="btn small" href="${destino(s)}">Continuar como ${esc(s.nombre.split(" ")[0])} (${s.rol === "admin" ? "administrador" : "cliente"})</a></p>`).join(""); }
const okMail = m => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m);
const okNombre = n => /^(?=.{3,60}$)\p{L}+(?:[ '-]\p{L}+)*$/u.test(n);
const msg = $("#amsg");
function ver(v) {
  $("#floginf").hidden = v !== "login"; $("#fregf").hidden = v !== "reg";
  if (!okNombre(u.nombre)) return say(msg, "Esta cuenta tiene un nombre no válido. Regístrate con otro correo y tu nombre real.");
}
$("#tlogin").onclick = () => ver("login"); $("#treg").onclick = () => ver("reg");
$("#rrol").onchange = () => { $("#rcw").hidden = $("#rrol").value !== "admin"; };
if (location.hash === "#registro") ver("reg");
$("#fregf").onsubmit = async e => { e.preventDefault();
  const nombre = $("#rn").value.trim(), email = $("#rm").value.trim().toLowerCase(), rol = $("#rrol").value, p1 = $("#rp1").value, p2 = $("#rp2").value;
   if (!okNombre(nombre)) return say(msg, "El nombre solo puede tener letras y espacios (mínimo 3).");
  if (!okMail(email)) return say(msg, "Escribe un correo válido, por ejemplo nombre@correo.com.");
  if (rol === "admin" && $("#rcode").value !== CODIGO_ADMIN) return say(msg, "El código de administrador no es correcto.");
  if (p1.length < 8) return say(msg, "La contraseña debe tener mínimo 8 caracteres.");
  if (p1 !== p2) return say(msg, "Las contraseñas no coinciden.");
  const us = load("sicof_usuarios", []);
  if (us.some(u => u.email === email)) return say(msg, "Ese correo ya está registrado. Inicia sesión.");
  us.push({nombre, email, rol, clave: await hash(p1), creado: Date.now()}); save("sicof_usuarios", us);
  location.href = "gracias.html?n=" + encodeURIComponent(nombre.split(" ")[0]); };
$("#floginf").onsubmit = async e => { e.preventDefault();
  const email = $("#lmail").value.trim().toLowerCase(), pass = $("#lpass").value;
  if (!okMail(email) || !pass) return say(msg, "Escribe tu correo y tu contraseña.");
  const u = load("sicof_usuarios", []).find(x => x.email === email);
  if (!u) return say(msg, "Esa cuenta no existe. Primero regístrate.");
  if (u.clave !== await hash(pass)) return say(msg, "La contraseña es incorrecta.");
  const s = {nombre: u.nombre, email, rol: u.rol || "cliente"}; entrar(s); location.href = destino(s); };
function limpiarLogin() {
  ["#lmail", "#lpass"].forEach(id => {
    const i = $(id);
    i.value = ""; i.readOnly = true;
    i.onfocus = () => i.readOnly = false;
  });
}
limpiarLogin();
addEventListener("pageshow", () => { limpiarLogin(); setTimeout(limpiarLogin, 300); });
$("#rn").addEventListener("input", function () {
  this.value = this.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü '\-]/g, "");
});