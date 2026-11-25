const codigoInput = document.getElementById("codigo");
const btnIniciar = document.getElementById("btnIniciar");
const btnDetener = document.getElementById("btnDetener");
const estado = document.getElementById("estado");

const lector = new Html5Qrcode("lector");
let camaraActiva = false;

const configuracion = {
  fps: 10,
  qrbox: { width: 250, height: 250 },
  formatsToSupport: [
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.CODE_128
  ]
};

async function iniciarCamara() {
  estado.textContent = "Iniciando cámara...";
  btnIniciar.disabled = true;

  try {
    await lector.start(
      { facingMode: "environment" },
      configuracion,
      (textoLeido) => {
        codigoInput.value = textoLeido;
        estado.textContent = "Código leído correctamente.";
        detenerCamara();
      },
      () => {} // errores de cada cuadro sin código: se ignoran
    );
    camaraActiva = true;
    btnDetener.disabled = false;
    estado.textContent = "Apunta la cámara al código de barras.";
  } catch (error) {
    console.error(error);
    estado.textContent = "No se pudo iniciar la cámara. Revisa el permiso y que la página se abra con Live Server.";
    btnIniciar.disabled = false;
  }
}

async function detenerCamara() {
  if (!camaraActiva) return;
  try {
    await lector.stop();
    lector.clear();
  } catch (error) {
    console.error(error);
  }
  camaraActiva = false;
  btnIniciar.disabled = false;
  btnDetener.disabled = true;
}

btnIniciar.addEventListener("click", iniciarCamara);
btnDetener.addEventListener("click", detenerCamara);