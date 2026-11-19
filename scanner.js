"use strict";
/* ===== SICOF · Escáner reutilizable (cámara + escritura manual) =====
   Scanner.abrir({titulo, formatos, numerico, alLeer})
   alLeer(codigo) debe devolver {ok, msg}; el mensaje se muestra en el diálogo.
   La cámara usa BarcodeDetector (Chrome/Edge/Android). Sin cámara o en otros
   navegadores sirve la escritura manual y los lectores USB (actúan como teclado). */
const Scanner = (() => {
  let dlg, stream, timer, ultimo = "", t0 = 0;
  const q = s => dlg.querySelector(s);
  function crear() {
    dlg = document.createElement("dialog");
    dlg.innerHTML = `<div class="in"><h2></h2>
      <video playsinline muted style="width:100%;border-radius:10px;background:#0b1f4d"></video>
      <p class="msg" role="status"></p>
      <form class="grid" novalidate><label>O escribe el código<input autocomplete="off"></label>
        <div><button class="btn sec" type="submit">Aceptar</button></div></form>
      <p><button class="btn small" type="button" data-x>Terminar</button></p></div>`;
    document.body.append(dlg);
    q("[data-x]").onclick = () => dlg.close();
    dlg.addEventListener("close", detener);
  }
  function detener() { clearInterval(timer); if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; q("video").srcObject = null; }
  async function abrir({titulo, formatos, numerico, alLeer}) {
    if (!dlg) crear();
    const msg = q(".msg"), video = q("video"), form = q("form"), input = q("input");
    q("h2").textContent = titulo; input.inputMode = numerico ? "numeric" : "text"; input.value = ""; say(msg, ""); ultimo = "";
    const procesar = cod => { const r = alLeer(cod); say(msg, r.msg, r.ok); };
    form.onsubmit = e => { e.preventDefault(); if (input.value.trim()) procesar(input.value.trim()); input.value = ""; input.focus(); };
    video.hidden = false; dlg.showModal(); input.focus();
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
      video.hidden = true; say(msg, "Este navegador no lee códigos con la cámara. Escribe el código o usa Chrome en Android.", false); return;
    }
    try {
      const soportados = await BarcodeDetector.getSupportedFormats();
      const det = new BarcodeDetector({formats: formatos.filter(f => soportados.includes(f))});
      stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: "environment"}});
      video.srcObject = stream; await video.play();
      timer = setInterval(async () => {
        try {
          const [c] = await det.detect(video);
          if (c && (c.rawValue !== ultimo || Date.now() - t0 > 2500)) { ultimo = c.rawValue; t0 = Date.now(); procesar(c.rawValue); }
        } catch { /* fotograma sin código */ }
      }, 300);
    } catch { video.hidden = true; say(msg, "No pudimos abrir la cámara (revisa el permiso). Escribe el código.", false); }
  }
  return {abrir};
})();
