"use strict";
/* ============================================================
   SICOF · Panel de administración
   1. Sesión y navegación   2. Resumen   3. Productos (CRUD + código de barras)
   4. Pedidos y validación de QR   5. Notificaciones   6. Clientes   7. Tiempo real
   ============================================================ */

/* ---------- 1. Sesión y navegación ---------- */
const S = exigir("admin"); if (!S) throw new Error("Redirigiendo al acceso");
$("#aquien").textContent = S.nombre;
$("#aout").onclick = () => salir("admin");
document.querySelector(".side").onclick = e => {
  const b = e.target.closest("button[data-t]"); if (!b) return;
  document.querySelectorAll(".side button[data-t]").forEach(x => x.setAttribute("aria-current", x === b));
  document.querySelectorAll("[data-s]").forEach(s => s.hidden = s.dataset.s !== b.dataset.t); todo();
};
$("#pcat").innerHTML = CATS.map(c => `<option>${c}</option>`).join("");
const vacio = (cols, txt) => `<tr><td colspan="${cols}" class="empty">${txt}</td></tr>`;

/* ---------- 2. Resumen ---------- */
function resumen() {
  const P = Prod.all(), O = Pedidos.all(), U = load(K.usr, []), bajo = P.filter(p => p.stock < 30);
  const saldos = Object.values(Tarjeta.todas()).reduce((a, t) => a + t.saldo, 0);
  $("#stats").innerHTML = [["Productos", P.length], ["Pedidos", O.length], ["Ventas", cop(O.reduce((a, o) => a + o.total, 0))], ["Clientes", U.filter(u => u.rol !== "admin").length], ["Saldo en tarjetas", cop(saldos)]]
    .map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join("") + `<div class="stat warn"><b>${bajo.length}</b><span>Con stock bajo</span></div>`;
  $("#low").innerHTML = bajo.length ? bajo.map(p => `<tr><td>${esc(p.nombre)}</td><td><span class="tag low">${p.stock}</span></td></tr>`).join("") : vacio(2, "Todo el inventario está por encima de 30 unidades.");
}

/* ---------- 3. Productos ---------- */
let productos = Prod.all();
function pintar() {
  productos = Prod.all(); const q = $("#psearch").value.trim().toLowerCase();
  const l = productos.filter(p => (p.nombre + " " + p.cat + " " + p.codigo).toLowerCase().includes(q));
  $("#ptable").innerHTML = l.length ? l.map(p => `<tr><td>${esc(p.nombre)}</td><td>${esc(p.cat)}</td><td class="num">${cop(p.precio)}</td>
    <td class="num"><span class="${p.stock < 30 ? "tag low" : "tag"}">${p.stock}</span></td><td class="num">${esc(p.codigo || "—")}</td>
    <td class="acts"><button class="btn small" data-edit="${p.id}">Editar</button> <button class="btn danger" data-del="${p.id}">Eliminar</button></td></tr>`).join("")
    : vacio(6, "No hay productos. Agrega el primero con el formulario.");
  $("#pcount").textContent = l.length + " producto" + (l.length === 1 ? "" : "s");
}
function limpiar() { $("#pform").reset(); $("#pid").value = ""; $("#psave").textContent = "Agregar producto"; $("#pcancel").hidden = true; }
$("#pform").onsubmit = e => { e.preventDefault();
  const nombre = $("#pname").value.trim(), precio = Number($("#pprice").value), stock = Number($("#pstock").value), codigo = $("#pcode").value.trim(), m = $("#pmsg");
  const id = Number($("#pid").value), cat = $("#pcat").value;
  if (nombre.length < 2) return say(m, "Escribe un nombre de al menos 2 letras.");
  if (!Number.isInteger(precio) || precio <= 0) return say(m, "El precio debe ser un número entero mayor a 0.");
  if (!Number.isInteger(stock) || stock < 0) return say(m, "El stock debe ser un número entero, 0 o más.");
  if (codigo && !/^\d{8,14}$/.test(codigo)) return say(m, "El código de barras debe tener entre 8 y 14 números.");
  if (codigo && productos.some(p => p.codigo === codigo && p.id !== id)) return say(m, "Ese código de barras ya pertenece a otro producto.");
  if (id) { productos = productos.map(p => p.id === id ? {...p, nombre, cat, precio, stock, codigo} : p); say(m, "Producto actualizado.", true); }
  else { productos.push({id: Date.now(), nombre, cat, precio, stock, codigo}); say(m, "Producto agregado.", true); }
  Prod.guardar(productos); limpiar(); pintar(); };
$("#ptable").onclick = e => { const ed = e.target.dataset.edit, del = e.target.dataset.del;
  if (ed) { const p = productos.find(x => x.id == ed); if (!p) return;
    $("#pid").value = p.id; $("#pname").value = p.nombre; $("#pcat").value = p.cat; $("#pprice").value = p.precio; $("#pstock").value = p.stock; $("#pcode").value = p.codigo || "";
    $("#psave").textContent = "Guardar cambios"; $("#pcancel").hidden = false; $("#pname").focus(); }
  if (del) { const p = productos.find(x => x.id == del);
    if (p && confirm(`¿Eliminar "${p.nombre}"?`)) { productos = productos.filter(x => x.id !== p.id); Prod.guardar(productos);
      if ($("#pid").value == p.id) limpiar(); say($("#pmsg"), "Producto eliminado.", true); pintar(); } } };
$("#pcancel").onclick = () => { limpiar(); say($("#pmsg"), ""); };
$("#psearch").oninput = pintar;

/* ---------- 4. Pedidos y validación del QR de salida ---------- */
function pedidos() {
  const O = Pedidos.all();
  $("#otable").innerHTML = O.length ? O.map(o => `<tr><td>${fecha(o.fecha)}</td><td>${esc(o.cliente)}<br><small>${esc(o.email)}</small></td>
    <td>${o.items.map(i => `${i.cant} × ${esc(i.nombre)}`).join("<br>")}</td><td class="num">${cop(o.total)}</td>
    <td class="num">${esc(o.codigo || "—")}</td><td><span class="tag ${o.estado === "Pagado" ? "low" : ""}">${esc(o.estado)}</span></td></tr>`).join("")
    : vacio(6, "Aún no hay pedidos. Aparecerán cuando un cliente pague su compra.");
}
function validar(cod) { const r = Pedidos.verificar(cod.trim().toUpperCase()); if (r.ok) todo(); return r; }
$("#vform").onsubmit = e => { e.preventDefault(); const c = $("#vcode").value; if (!c.trim()) return say($("#vmsg"), "Escribe o escanea el código del QR.");
  const r = validar(c); say($("#vmsg"), r.msg, r.ok); if (r.ok) $("#vcode").value = ""; };
$("#vscan").onclick = () => Scanner.abrir({titulo: "Escanear el QR del cliente", formatos: ["qr_code"], alLeer: validar});

/* ---------- 5. Notificaciones ---------- */
function notifs() {
  const N = Notif.all(), sin = Notif.sinLeer();
  $("#nbadge").hidden = !sin; $("#nbadge").textContent = sin;
  $("#nlist").innerHTML = N.length ? N.map(n => `<article class="rev ${n.leida ? "" : "nuevo"}"><b>${n.tipo === "pago" ? "Pago recibido" : "Recarga de tarjeta"}</b><p>${esc(n.texto)}</p><small>${fecha(n.fecha)}</small></article>`).join("")
    : '<p class="empty">Aún no hay notificaciones. Llegarán cuando un cliente pague o recargue su tarjeta.</p>';
}
$("#nread").onclick = () => { Notif.marcarTodas(); notifs(); };

/* ---------- 6. Clientes ---------- */
function usuarios() {
  const U = load(K.usr, []);
  $("#utable").innerHTML = U.length ? U.map(u => `<tr><td>${esc(u.nombre)}</td><td>${esc(u.email)}</td><td><span class="tag">${u.rol === "admin" ? "Administrador" : "Cliente"}</span></td>
    <td class="num">${u.rol === "admin" ? "—" : cop(Tarjeta.saldo(u.email))}</td><td>${fecha(u.creado)}</td>
    <td>${u.email === S.email ? "Tu cuenta" : `<button class="btn danger" data-u="${esc(u.email)}">Eliminar</button>`}</td></tr>`).join("")
    : vacio(6, "Aún no hay clientes registrados.");
}
$("#utable").onclick = e => { const m = e.target.dataset.u;
  if (m && confirm(`¿Eliminar la cuenta ${m}?`)) { save(K.usr, load(K.usr, []).filter(u => u.email !== m)); usuarios(); } };

/* ---------- 7. Tiempo real: avisa cuando otra pestaña del navegador paga o recarga ---------- */
function aviso(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(aviso.t); aviso.t = setTimeout(() => el.hidden = true, 6000); }
addEventListener("storage", e => {
  if (![K.not, K.ped, K.prod, K.tar, K.usr].includes(e.key)) return;
  if (e.key === K.not) { const n = Notif.all()[0]; if (n && !n.leida) aviso("Nueva notificación: " + n.texto); }
  todo();
});

function todo() { resumen(); pintar(); pedidos(); notifs(); usuarios(); }
todo();
