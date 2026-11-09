// Pantalla de inicio de sesión / registro: correo + contraseña, o Google.
import {
  auth, googleProvider, configLista,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
  signInWithPopup, signInWithRedirect, onAuthStateChanged
} from "./firebase.js";

const $ = (id) => document.getElementById(id);
const form = $("form-auth");
const mensaje = $("mensaje");
const btnSubmit = $("btn-submit");
const btnGoogle = $("btn-google");
const btnOlvide = $("btn-olvide");
const campoConfirmar = $("campo-confirmar");
const inputEmail = $("email");
const inputPassword = $("password");

let modo = "login"; // "login" | "registro"

function mostrarMensaje(texto, tipo = "error") {
  mensaje.textContent = texto;
  mensaje.dataset.tipo = tipo;
}

function cambiarModo(nuevo) {
  modo = nuevo;
  document.querySelectorAll(".tab").forEach((t) => {
    const activo = t.dataset.modo === modo;
    t.classList.toggle("active", activo);
    t.setAttribute("aria-selected", String(activo));
  });
  campoConfirmar.hidden = modo !== "registro";
  btnOlvide.hidden = modo === "registro";
  btnSubmit.textContent = modo === "registro" ? "Crear cuenta" : "Ingresar";
  inputPassword.autocomplete = modo === "registro" ? "new-password" : "current-password";
  mostrarMensaje("");
}

function ocupado(estado) {
  btnSubmit.disabled = estado;
  btnGoogle.disabled = estado;
  btnOlvide.disabled = estado;
  form.classList.toggle("ocupado", estado);
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function traducirError(err) {
  const codigo = err?.code || "";
  const mapa = {
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/wrong-password": "Correo o contraseña incorrectos.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/invalid-email": "El correo no es válido.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Ingresa en lugar de registrarte.",
    "auth/account-exists-with-different-credential": "Ese correo ya está registrado con otro método de ingreso.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos e intenta de nuevo.",
    "auth/network-request-failed": "Sin conexión. Revisa tu internet.",
    "auth/popup-closed-by-user": "Cerraste la ventana de Google antes de terminar.",
    "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase (Authentication → Settings → Authorized domains).",
    "auth/operation-not-allowed": "Este método de ingreso no está activado en Firebase.",
    "auth/invalid-api-key": "Falta configurar Firebase (js/firebase-config.js)."
  };
  return mapa[codigo] || "Ocurrió un error. Intenta de nuevo.";
}

// Si ya hay sesión, ir directo al panel.
if (configLista) {
  onAuthStateChanged(auth, (user) => {
    if (user) location.replace("app.html");
  });
} else {
  mostrarMensaje("Falta pegar la configuración de Firebase en js/firebase-config.js.");
  ocupado(true);
}

document.querySelectorAll(".tab").forEach((t) =>
  t.addEventListener("click", () => cambiarModo(t.dataset.modo))
);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = inputEmail.value.trim();
  const password = inputPassword.value;

  if (!emailValido(email)) return mostrarMensaje("Escribe un correo válido.");
  if (password.length < 6) return mostrarMensaje("La contraseña debe tener al menos 6 caracteres.");
  if (modo === "registro" && password !== $("password2").value) {
    return mostrarMensaje("Las contraseñas no coinciden.");
  }

  ocupado(true);
  mostrarMensaje("");
  try {
    if (modo === "registro") {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    // onAuthStateChanged redirige a app.html
  } catch (err) {
    console.error(err);
    mostrarMensaje(traducirError(err));
    ocupado(false);
  }
});

btnOlvide.addEventListener("click", async () => {
  const email = inputEmail.value.trim();
  if (!emailValido(email)) {
    inputEmail.focus();
    return mostrarMensaje("Escribe tu correo arriba y vuelve a tocar «¿Olvidaste tu contraseña?».");
  }
  ocupado(true);
  try {
    await sendPasswordResetEmail(auth, email);
    mostrarMensaje(`Si existe una cuenta con ${email}, te enviamos un enlace para cambiar la contraseña.`, "ok");
  } catch (err) {
    console.error(err);
    mostrarMensaje(traducirError(err));
  } finally {
    ocupado(false);
  }
});

btnGoogle.addEventListener("click", async () => {
  ocupado(true);
  mostrarMensaje("");
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    if (err?.code === "auth/popup-blocked" || err?.code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    console.error(err);
    mostrarMensaje(traducirError(err));
    ocupado(false);
  }
});
