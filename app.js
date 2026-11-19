"use strict";
/* ============================================================
   SICOF · Interfaz de cliente
   1. Sesión   2. Hero y migas   3. Catálogo + escáner   4. Carrito y pago
   5. Tarjeta SICOF   6. Comprobante QR   7. Reseñas
   ============================================================ */

/* ---------- 1. Sesión (solo clientes) ---------- */
const S = exigir("cliente"); if (!S) throw new Error("Redirigiendo al acceso");
const pintarCuenta = () => {
  const n = S.nombre.split(" ")[0];
  $("#quien").textContent = n; $("#saldo").textContent = cop(Tarjeta.de(S.email).saldo);
  $("#hola").textContent = `Hola, ${n}. Escanea tus productos, paga con tu tarjeta y sal con tu QR.`;
};
$("#navout").onclick = () => salir("cliente");

/* ---------- 2. Hero y migas ---------- */
const frases = ["sin filas.", "desde tu celular.", "listo en minutos.", "a buen precio."], typed = $("#typed");
if (matchMedia("(prefers-reduced-motion: reduce)").matches) { typed.textContent = frases[0]; typed.style.borderRight = "0"; }
else { let f = 0, i = 0, b = false; const tick = () => { const t = frases[f]; i += b ? -1 : 1; typed.textContent = t.slice(0, i); let d = b ? 40 : 90;
  if (!b && i === t.length) { b = true; d = 1400; } else if (b && i === 0) { b = false; f = (f + 1) % frases.length; d = 400; } setTimeout(tick, d); }; tick(); }
const nombres = {"#catalogo": "Productos", "#resenas": "Reseñas"};
const crumbs = () => { const n = nombres[location.hash]; $("#crumbs").innerHTML = '<li><a href="index.html">Inicio</a></li>' + (n ? `<li aria-current="page">${n}</li>` : ""); };
addEventListener("hashchange", crumbs); crumbs();

/* ---------- 3. Catálogo + escáner de código de barras ---------- */
let cat = "Todos";
const pintarChips = () => { $("#chips").innerHTML = ["Todos", ...CATS].map(c => `<button class="chip" data-c="${c}" aria-pressed="${c === cat}">${c}</button>`).join(""); };
function pintarCat() {
  const q = $("#psearch").value.trim().toLowerCase();
  const l = Prod.all().filter(p => (cat === "Todos" || p.cat === cat) && p.nombre.toLowerCase().includes(q));
  $("#cards").innerHTML = l.length ? l.map(p => `<article class="card"><span class="cat">${esc(p.cat)}</span><h3>${esc(p.nombre)}</h3>
    <span class="price">${cop(p.precio)}</span><small>${p.stock > 0 ? p.stock + " disponibles" : "Agotado"}</small>
    <button class="btn sec" data-add="${p.id}" ${p.stock < 1 ? "disabled" : ""}>Agregar al carrito</button></article>`).join("")
    : '<p class="empty">No encontramos productos con ese filtro. Prueba con otra categoría.</p>';
}
$("#chips").onclick = e => { if (e.target.dataset.c) { cat = e.target.dataset.c; pintarChips(); pintarCat(); } };
$("#psearch").oninput = pintarCat;
$("#scanopen").onclick = () => Scanner.abrir({
  titulo: "Escanear código de barras", numerico: true,
  formatos: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"],
  alLeer: cod => {
    const p = Prod.porCodigo(cod);
    if (!p) return {ok: false, msg: `No encontramos un producto con el código ${cod}.`};
    return setQ(p.id, 1) ? {ok: true, msg: `Agregado al carrito: ${p.nombre}`} : {ok: false, msg: `${p.nombre}: no hay más unidades disponibles.`};
  }});

/* ---------- 4. Carrito y pago con la tarjeta ---------- */
const carro = () => load(K.car, {});
function pintarCarro() {
  const c = carro(), P = Prod.all(); let total = 0, n = 0;
  $("#clines").innerHTML = Object.entries(c).map(([id, q]) => { const p = P.find(x => x.id == id); if (!p) return ""; total += p.precio * q; n += q;
    return `<div class="line"><span>${esc(p.nombre)}<br><small>${cop(p.precio)}</small></span><span class="qty"><button data-m="${id}" aria-label="Quitar uno">−</button> ${q} <button data-p="${id}" aria-label="Agregar uno">+</button></span></div>`; }).join("")
    || '<p class="empty">Tu carrito está vacío. Agrega productos del catálogo.</p>';
  $("#ctotal").textContent = cop(total); $("#cn").textContent = n; $("#csaldo").textContent = cop(Tarjeta.de(S.email).saldo);
}
function setQ(id, d) {   // devuelve true si la cantidad cambió (respeta el stock)
  const c = carro(), p = Prod.all().find(x => x.id == id); if (!p) return false;
  const antes = c[id] || 0, q = Math.max(0, Math.min(p.stock, antes + d));
  q ? c[id] = q : delete c[id]; save(K.car, c); pintarCarro(); return q !== antes;
}
$("#cards").onclick = e => { if (e.target.dataset.add) { setQ(e.target.dataset.add, 1); abrirCarro(); } };
$("#clines").onclick = e => { if (e.target.dataset.p) setQ(e.target.dataset.p, 1); if (e.target.dataset.m) setQ(e.target.dataset.m, -1); };
function abrirCarro() { say($("#cmsg"), ""); $("#cgo").hidden = true; pintarCarro(); if (!$("#cart").open) $("#cart").showModal(); }
$("#cartopen").onclick = abrirCarro;
$("#cclose").onclick = () => $("#cart").close();
$("#cgo").onclick = () => { $("#cart").close(); abrirTarjeta(); };
$("#cbuy").onclick = () => {
  const r = Pedidos.pagar(S, carro());
  if (!r.ok) { say($("#cmsg"), r.error); $("#cgo").hidden = !r.falta; return; }
  save(K.car, {}); pintarCarro(); pintarCat(); pintarCuenta(); $("#cart").close(); mostrarQR(r.pedido, true);
};

/* ---------- 5. Tarjeta SICOF: saldo, recargas, movimientos y compras ---------- */
const MONTOS = [10000, 20000, 50000, 100000];
$("#recchips").innerHTML = MONTOS.map(m => `<button class="chip" data-m="${m}" type="button">${cop(m)}</button>`).join("");
$("#recchips").onclick = e => { if (e.target.dataset.m) $("#recmonto").value = e.target.dataset.m; };
function pintarTarjeta() {
  const c = Tarjeta.de(S.email);
  $("#tarj").innerHTML = `<small>Tarjeta SICOF</small><b class="num">${c.numero}</b><span>${esc(S.nombre)}</span><strong>${cop(c.saldo)}</strong>`;
  $("#movs").innerHTML = c.movs.length ? c.movs.slice(0, 8).map(m => { const suma = m.tipo === "recarga";
    return `<div class="line"><span>${suma ? "Recarga" : "Pago"} <small>${fecha(m.fecha)}</small></span><b class="${suma ? "pos" : "neg"}">${suma ? "+" : "−"}${cop(m.monto)}</b></div>`; }).join("")
    : '<p class="empty">Aún no tienes movimientos.</p>';
  const mis = Pedidos.de(S.email);
  $("#compras").innerHTML = mis.length ? mis.slice(0, 8).map(p => `<div class="line"><span>${cop(p.total)} <small>${fecha(p.fecha)} · <span class="tag">${esc(p.estado)}</span></small></span>
    <button class="btn small" data-qr="${p.id}">Ver QR</button></div>`).join("") : '<p class="empty">Aún no tienes compras.</p>';
}
function abrirTarjeta() { say($("#recmsg"), ""); pintarTarjeta(); if (!$("#wallet").open) $("#wallet").showModal(); }
$("#walletopen").onclick = abrirTarjeta;
$("#wclose").onclick = () => $("#wallet").close();
$("#recform").onsubmit = e => { e.preventDefault();
  const m = Number($("#recmonto").value);
  if (!Number.isInteger(m) || m < 5000 || m > 1000000) return say($("#recmsg"), "Recarga entre $5.000 y $1.000.000, sin decimales.");
  Tarjeta.mover(S.email, "recarga", m, "Recarga");
  Notif.add("recarga", `${S.nombre} recargó ${cop(m)} a su tarjeta SICOF.`, {email: S.email});
  $("#recform").reset(); pintarTarjeta(); pintarCuenta(); pintarCarro(); say($("#recmsg"), `Recarga exitosa: +${cop(m)}.`, true); };
$("#compras").onclick = e => { const p = Pedidos.de(S.email).find(x => x.id == e.target.dataset.qr); if (p) mostrarQR(p, false); };

/* ---------- 6. Comprobante con QR de salida ---------- */
function mostrarQR(p, nuevo) {
  $("#qrt").textContent = nuevo ? "¡Pago exitoso!" : "Tu código QR de salida";
  $("#qrinfo").textContent = `${cop(p.total)} · ${fecha(p.fecha)} · ${p.estado}`;
  $("#qrbox").innerHTML = QR.svg(p.codigo); $("#qrcod").textContent = p.codigo;
  if ($("#wallet").open) $("#wallet").close(); $("#qrd").showModal();
}
$("#qrclose").onclick = () => $("#qrd").close();

/* ---------- 7. Reseñas ---------- */
let reseñas = load(K.rev, []);
function pintarReseñas() {
  $("#rlist").innerHTML = reseñas.map(r => `<article class="rev"><div class="stars" aria-label="${r.estrellas} de 5">${"★".repeat(r.estrellas)}${"☆".repeat(5 - r.estrellas)}</div><p>${esc(r.texto)}</p><small>${esc(r.nombre)} · ${new Date(r.fecha).toLocaleDateString("es-CO")}</small></article>`).join("");
  const prom = reseñas.reduce((a, r) => a + r.estrellas, 0) / (reseñas.length || 1);
  $("#ravg").textContent = reseñas.length ? `${prom.toFixed(1)} de 5 · ${reseñas.length} reseña${reseñas.length === 1 ? "" : "s"}` : "Aún no hay reseñas. Cuéntanos tu experiencia y sé el primero.";
}
$("#rform").onsubmit = e => { e.preventDefault();
  const nombre = $("#rname").value.trim(), texto = $("#rtext").value.trim();
  if (!nombre || texto.length < 10) return say($("#rmsg"), "Escribe tu nombre y una reseña de al menos 10 caracteres.");
  reseñas.unshift({nombre, texto, estrellas: Number($("#rstars").value), fecha: Date.now()});
  save(K.rev, reseñas); $("#rform").reset(); pintarReseñas(); say($("#rmsg"), "Gracias, tu reseña ya está publicada.", true); };

pintarCuenta(); pintarChips(); pintarCat(); pintarCarro(); pintarReseñas();
