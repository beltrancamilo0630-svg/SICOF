"use strict";
/* ===== SICOF · Escáner (cámara + escritura manual) =====
   Scanner.abrir({titulo, formatos, numerico, alLeer})
   Usa el lector del navegador; si no existe (Windows), carga uno de internet. */
const Scanner = (() => {
  const LECTOR = "https://fastly.jsdelivr.net/npm/barcode-detector@3/dist/iife/polyfill.min.js";
  let dlg, stream, timer, ultimo = "", t0 = 0, turno = 0;
  const q = s => dlg.querySelector(s);

  function decir(texto, ok) {
    const el = q(".msg");
    el.textContent = texto;
    el.className = "msg " + (ok ? "ok" : "err");
  }

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
    dlg.addEventListener("close", () => { if (!dlg.open) detener(); });
  }

  function detener() {
    turno++;
    clearTimeout(timer);
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    q("video").srcObject = null;
  }

  function cargarLector() {
    if ("BarcodeDetector" in window) return Promise.resolve();
    return new Promise((ok, fallo) => {
      const s = document.createElement("script");
      s.src = LECTOR;
      s.onload = ok;
      s.onerror = () => { s.remove(); fallo(new Error("No cargó el lector")); };
      document.head.append(s);
    });
  }

  async function abrir({titulo, formatos, numerico, alLeer}) {
    if (!dlg) crear();
    detener();
    const actual = turno;
    const video = q("video"), form = q("form"), input = q("input");
    q("h2").textContent = titulo;
    input.inputMode = numerico ? "numeric" : "text";
    input.value = "";
    ultimo = "";

    const procesar = cod => { const r = alLeer(cod); decir(r.msg, r.ok); };
    form.onsubmit = e => {
      e.preventDefault();
      if (input.value.trim()) procesar(input.value.trim());
      input.value = "";
      input.focus();
    };

    video.hidden = false;
    if (!dlg.open) dlg.showModal();
    decir("Abriendo la cámara...", true);

    try {
      await cargarLector();
      const detector = new BarcodeDetector({formats: formatos});
      const camara = await navigator.mediaDevices.getUserMedia({
        video: {facingMode: "environment", width: {ideal: 1280}, height: {ideal: 720}}
      });
      if (actual !== turno) return camara.getTracks().forEach(t => t.stop());
      stream = camara;
      video.srcObject = stream;
      await video.play();
      decir("Pon el código frente a la cámara.", true);

      const leer = async () => {
        try {
          const [c] = await detector.detect(video);
          if (actual !== turno) return;
          if (c && (c.rawValue !== ultimo || Date.now() - t0 > 2500)) {
            ultimo = c.rawValue;
            t0 = Date.now();
            procesar(c.rawValue);
          }
        } catch (err) { console.error(err); }
        if (actual === turno) timer = setTimeout(leer, 300);
      };
      leer();
    } catch (err) {
      console.error(err);
      if (actual !== turno) return;
      detener();
      video.hidden = true;
      decir("No pudimos abrir la cámara (revisa el permiso y el internet). Escribe el código.", false);
    }
  }

  return {abrir};
})();