"use strict";
/* ===== SICOF · Generador de códigos QR (sin librerías) =====
   Modo byte, corrección de errores nivel M, versiones 1–10 (hasta 213 caracteres).
   Uso: QR.svg("SICOF-ABC123") → string SVG listo para insertar en la página. */
const QR = (() => {
  const ECC = [0,10,16,26,18,24,16,18,22,22,26], BLOQUES = [0,1,1,1,2,2,4,4,4,5,5];   // nivel M, por versión
  const EXP = [], LOG = [];
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  const mul = (a, b) => a && b ? EXP[(LOG[a] + LOG[b]) % 255] : 0;
  const bit = (n, i) => ((n >>> i) & 1) === 1;
  const bitsDatos = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };

  function resto(datos, n) {                      // Reed-Solomon: n bytes de corrección
    let g = [1];
    for (let i = 0; i < n; i++) { const ng = Array(g.length + 1).fill(0); g.forEach((c, j) => { ng[j] ^= c; ng[j + 1] ^= mul(c, EXP[i]); }); g = ng; }
    const r = Array(n).fill(0);
    for (const b of datos) { const f = b ^ r.shift(); r.push(0); g.slice(1).forEach((c, i) => { r[i] ^= mul(c, f); }); }
    return r;
  }
  function codewords(bytes, v) {                  // datos + corrección, entrelazados por bloques
    const total = Math.floor(bitsDatos(v) / 8), nb = BLOQUES[v], ecc = ECC[v];
    const cap = total - ecc * nb, bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push(bit(val, i) ? 1 : 0); };
    push(4, 4); push(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => push(b, 8));
    push(0, Math.min(4, cap * 8 - bits.length)); while (bits.length % 8) bits.push(0);
    const datos = []; for (let i = 0; i < bits.length; i += 8) datos.push(parseInt(bits.slice(i, i + 8).join(""), 2));
    for (let p = 0xEC; datos.length < cap; p ^= 0xEC ^ 0x11) datos.push(p);
    const cortos = nb - total % nb, largoCorto = Math.floor(total / nb), bl = []; let k = 0;
    for (let i = 0; i < nb; i++) { const d = datos.slice(k, k += largoCorto - ecc + (i < cortos ? 0 : 1)); const e = resto(d, ecc); if (i < cortos) d.push(0); bl.push(d.concat(e)); }
    const out = [];
    for (let i = 0; i < bl[0].length; i++) bl.forEach((b, j) => { if (i !== largoCorto - ecc || j >= cortos) out.push(b[i]); });
    return out;
  }
  function matriz(bytes) {
    let v = 1; while (v <= 10 && Math.floor(bitsDatos(v) / 8) - ECC[v] * BLOQUES[v] < Math.ceil((4 + (v < 10 ? 8 : 16) + bytes.length * 8) / 8)) v++;
    if (v > 10) throw new Error("Texto demasiado largo para el QR");
    const size = v * 4 + 17, m = Array.from({length: size}, () => Array(size).fill(false)), fn = m.map(r => r.map(() => false));
    const set = (x, y, d) => { m[y][x] = d; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]])
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy)); if (x >= 0 && y >= 0 && x < size && y < size) set(x, y, d !== 2 && d !== 4); }
    if (v > 1) {
      const n = Math.floor(v / 7) + 2, paso = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, pos = [6];
      for (let p = size - 7; pos.length < n; p -= paso) pos.splice(1, 0, p);
      pos.forEach((px, i) => pos.forEach((py, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }));
    }
    const formato = mask => {                      // nivel M = 0
      const d = mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412;
      for (let i = 0; i <= 5; i++) set(8, i, bit(b, i)); set(8, 7, bit(b, 6)); set(8, 8, bit(b, 7)); set(7, 8, bit(b, 8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(b, i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(b, i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(b, i));
      set(8, size - 8, true);
    };
    formato(0);
    if (v >= 7) { let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25); const b = (v << 12) | r;
      for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, bit(b, i)); set(c, a, bit(b, i)); } }
    const cw = codewords(bytes, v); let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fn[y][x] && i < cw.length * 8) { m[y][x] = bit(cw[i >>> 3], 7 - (i & 7)); i++; }
      }
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && (x + y) % 2 === 0) m[y][x] = !m[y][x];   // máscara 0
    formato(0);
    return m;
  }
  function svg(texto) {
    const m = matriz([...new TextEncoder().encode(texto)]), n = m.length + 8; let d = "";
    m.forEach((fila, y) => fila.forEach((on, x) => { if (on) d += `M${x + 4} ${y + 4}h1v1h-1z`; }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="Código QR ${texto}"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }
  return {svg};
})();
if (typeof module !== "undefined") module.exports = QR;
