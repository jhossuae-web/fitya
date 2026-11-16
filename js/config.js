// Conexión con Supabase.
// Si dejas estos dos valores vacíos, la web funciona en MODO DEMO:
// los cambios del panel y las métricas se guardan solo en el navegador donde los hiciste.
// Cuando pegues tu URL y tu clave pública (anon key), todo pasa a guardarse en la nube.

window.FITYA_CONFIG = {
  supabaseUrl: "",
  supabaseClave: "",
  carpetaFotos: "fotos",
  // ID de Google Analytics 4 (ejemplo: "G-ABC123XYZ9"). También se puede poner desde el panel.
  gaId: ""
};
