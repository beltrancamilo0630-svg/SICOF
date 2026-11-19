"use strict";
/* ============================================================
   SICOF · Núcleo compartido (cliente y administrador)
   1. Utilidades   2. Datos (productos, tarjeta, notificaciones, pedidos)   3. Sesión
   Los datos viven en localStorage (demo). Para producción se reemplazan por una API.
   ============================================================ */

/* ---------- 1. Utilidades ---------- */
const $ = s => document.querySelector(s);
const K = {prod: "sicof_productos", usr: "sicof_usuarios", ses: "sicof_sesion", car: "sicof_carrito",
           ped: "sicof_pedidos", rev: "sicof_resenas", tar: "sicof_tarjetas", not: "sicof_notifs"};
const cop = n => new Intl.NumberFormat("es-CO", {style: "currency", currency: "COP", maximumFractionDigits: 0}).format(n);
const fecha = t => new Date(t).toLocaleString("es-CO", {dateStyle: "short", timeStyle: "short"});
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const say = (el, t, ok) => { el.textContent = t; el.className = "msg " + (ok ? "ok" : "err"); };
const rnd = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
async function hash(t) {
  if (!crypto.subtle) return btoa(unescape(encodeURIComponent(t)));
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}

/* ---------- 2a. Productos ---------- */
const CATS = ["Frutas y verduras", "Lácteos", "Despensa", "Aseo", "Bebidas"];
const ean13 = base => base + (10 - [...base].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0) % 10) % 10;   // agrega el dígito verificador
const SEED = [
  {id: 1, nombre: "Plátano hartón (kg)", cat: "Frutas y verduras", precio: 3200, stock: 80, codigo: ean13("770100000001")},
  {id: 2, nombre: "Leche entera 1 L", cat: "Lácteos", precio: 4300, stock: 120, codigo: ean13("770100000002")},
  {id: 3, nombre: "Arroz 500 g", cat: "Despensa", precio: 2900, stock: 200, codigo: ean13("770100000003")},
  {id: 4, nombre: "Café molido 250 g", cat: "Despensa", precio: 11500, stock: 60, codigo: ean13("770100000004")},
  {id: 5, nombre: "Detergente 1 kg", cat: "Aseo", precio: 15800, stock: 40, codigo: ean13("770100000005")},
  {id: 6, nombre: "Jugo de naranja 1 L", cat: "Bebidas", precio: 6900, stock: 50, codigo: ean13("770100000006")}];
const Prod = {
  all() {   // productos guardados; los antiguos sin código de barras se completan con el catálogo base
    const l = load(K.prod, null) || (save(K.prod, SEED), SEED);
    return l.map(p => p.codigo === undefined ? {...p, codigo: (SEED.find(s => s.id === p.id) || {}).codigo || ""} : p);
  },
  guardar: l => save(K.prod, l),
  porCodigo: c => Prod.all().find(p => p.codigo && p.codigo === c)
};

/* ---------- 2b. Tarjeta SICOF (saldo prepago) ---------- */
const Tarjeta = {
  todas: () => load(K.tar, {}),
  saldo: email => (Tarjeta.todas()[email] || {saldo: 0}).saldo,
  de(email) {   // devuelve la tarjeta del cliente y la crea la primera vez
    const all = Tarjeta.todas();
    if (!all[email]) { all[email] = {numero: "SICOF " + [0, 1, 2].map(() => 1000 + rnd(9000)).join(" "), saldo: 0, movs: []}; save(K.tar, all); }
    return all[email];
  },
  mover(email, tipo, monto, ref = "") {   // tipo: "recarga" suma · "pago" resta
    Tarjeta.de(email);
    const all = Tarjeta.todas(), c = all[email];
    c.saldo += tipo === "recarga" ? monto : -monto;
    c.movs.unshift({tipo, monto, ref, fecha: Date.now()});
    save(K.tar, all);
  }
};

/* ---------- 2c. Notificaciones para el administrador ---------- */
const Notif = {
  all: () => load(K.not, []),
  sinLeer: () => Notif.all().filter(n => !n.leida).length,
  add(tipo, texto, extra = {}) { save(K.not, [{id: Date.now(), tipo, texto, fecha: Date.now(), leida: false, ...extra}, ...Notif.all()]); },
  marcarTodas: () => save(K.not, Notif.all().map(n => ({...n, leida: true})))
};

/* ---------- 2d. Pedidos (pago con tarjeta + QR de salida) ---------- */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const codigoQR = () => "SICOF-" + Array.from({length: 10}, () => ALFABETO[rnd(ALFABETO.length)]).join("");
const Pedidos = {
  all: () => load(K.ped, []),
  de: email => Pedidos.all().filter(p => p.email === email),
  pagar(s, carro) {   // → {ok, pedido} | {ok:false, error, falta?}
    const P = Prod.all(), items = []; let total = 0;
    for (const [id, q] of Object.entries(carro)) {
      const p = P.find(x => x.id == id); if (!p) continue;
      if (q > p.stock) return {ok: false, error: `Solo quedan ${p.stock} de «${p.nombre}». Ajusta tu carrito.`};
      items.push({id: p.id, nombre: p.nombre, precio: p.precio, cant: q}); total += p.precio * q;
    }
    if (!items.length) return {ok: false, error: "Tu carrito está vacío."};
    const saldo = Tarjeta.de(s.email).saldo;
    if (saldo < total) return {ok: false, falta: true, error: `Saldo insuficiente: te faltan ${cop(total - saldo)}. Recarga tu tarjeta SICOF.`};
    Prod.guardar(P.map(p => carro[p.id] ? {...p, stock: p.stock - carro[p.id]} : p));
    const ped = {id: Date.now(), codigo: codigoQR(), cliente: s.nombre, email: s.email, items, total, fecha: Date.now(), estado: "Pagado", metodo: "Tarjeta SICOF"};
    save(K.ped, [ped, ...Pedidos.all()]);
    Tarjeta.mover(s.email, "pago", total, ped.codigo);
    Notif.add("pago", `${s.nombre} pagó ${cop(total)} (${items.reduce((a, i) => a + i.cant, 0)} productos). Código ${ped.codigo}.`, {pedidoId: ped.id});
    return {ok: true, pedido: ped};
  },
  verificar(codigo) {   // el administrador valida el QR a la salida; cada QR sirve una sola vez
    const l = Pedidos.all(), p = l.find(x => x.codigo === codigo);
    if (!p) return {ok: false, msg: "QR no válido: no existe ningún pedido con ese código."};
    if (p.estado === "Verificado") return {ok: false, msg: `Este QR ya fue usado el ${fecha(p.verificado)}.`};
    save(K.ped, l.map(x => x === p ? {...x, estado: "Verificado", verificado: Date.now()} : x));
    return {ok: true, msg: `QR válido: ${p.cliente} · ${p.items.reduce((a, i) => a + i.cant, 0)} productos · ${cop(p.total)}. Puede salir.`};
  }
};

/* ---------- 3. Sesión y roles ----------
   Cada rol guarda su propia sesión (persisten hasta pulsar «Salir»), así un administrador
   y un cliente pueden tener abierto SICOF a la vez en pestañas distintas del mismo navegador. */
const Ses = rol => K.ses + "_" + rol;
const sesiones = () => ["cliente", "admin"].map(r => load(Ses(r), null)).filter(Boolean);
const destino = s => s.rol === "admin" ? "admin.html" : "index.html";
const entrar = s => save(Ses(s.rol), {...s, t: Date.now()});
function exigir(rol) {   // sesión de la página, o redirige a la otra sesión abierta / al acceso
  const s = load(Ses(rol), null); if (s) return s;
  const otra = sesiones().sort((a, b) => b.t - a.t)[0];
  location.replace(otra ? destino(otra) : "acceso.html"); return null;
}
const salir = rol => { localStorage.removeItem(Ses(rol)); location.replace("acceso.html"); };
