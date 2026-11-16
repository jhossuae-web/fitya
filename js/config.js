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

// Supabase solo se descarga cuando está configurado: en modo demo la tienda carga más rápido.
if (window.FITYA_CONFIG.supabaseUrl) {
  document.write('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"><\/script>');
}
