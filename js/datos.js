// Capa de datos de FITYA.
// Habla con Supabase si está configurado; si no, usa el navegador (modo demo).
(() => {
  const cfg = window.FITYA_CONFIG || {};
  const nube = !!(cfg.supabaseUrl && cfg.supabaseClave && window.supabase);
  const sb = nube ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseClave) : null;
  const CLAVE = "fityaDemoCatalogo";
  const CLAVE_EV = "fityaDemoEventos";

  const leerLocal = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch (e) { return def; } };
  const guardarLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const copia = o => JSON.parse(JSON.stringify(o));

  let sesion = null;
  try { sesion = sessionStorage.getItem("fityaSesion"); } catch (e) {}
  if (!sesion) {
    sesion = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try { sessionStorage.setItem("fityaSesion", sesion); } catch (e) {}
  }

  const demo = () => leerLocal(CLAVE, null) || copia(window.CATALOGO_INICIAL);
  const guardarDemo = c => {
    if (!guardarLocal(CLAVE, c)) throw new Error("El navegador no tiene espacio para más fotos en modo demo. Conecta Supabase para guardar sin límite.");
  };
  const ordenar = c => {
    c.categorias.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    c.productos.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    return c;
  };
  const revisar = ({ error, data }) => { if (error) throw new Error(error.message); return data; };

  // Achica la foto antes de guardarla para que la web cargue rápido
  function achicar(archivo, lado = 1000, calidad = 0.85) {
    return new Promise((ok, mal) => {
      const lector = new FileReader();
      lector.onerror = () => mal(new Error("No se pudo leer la foto"));
      lector.onload = () => {
        const img = new Image();
        img.onerror = () => mal(new Error("Ese archivo no es una imagen válida"));
        img.onload = () => {
          const k = Math.min(1, lado / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          const x = c.getContext("2d");
          x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
          x.drawImage(img, 0, 0, c.width, c.height);
          c.toBlob(b => ok(b), "image/jpeg", calidad);
        };
        img.src = lector.result;
      };
      lector.readAsDataURL(archivo);
    });
  }
  const aDataUrl = blob => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });


  // Google Analytics 4 (opcional). Se activa con un ID tipo G-XXXXXXXXXX,
  // ya sea en js/config.js o desde el panel en "Datos de la tienda".
  let gaListo = false; const gaPendientes = [];
  const enAdmin = /admin\.html$/.test(location.pathname);
  const gaItem = (id, extra = {}) => {
    const p = (window.FY.productos || []).find(x => x.id === id);
    return { item_id: id, item_name: p ? p.nombre : id, item_brand: p?.marca || undefined, item_category: p?.cat || undefined, price: p?.precio, ...extra };
  };
  function gaEnviar(tipo, producto, datos) {
    const g = window.gtag; if (!g) return;
    const mon = { currency: "BOB" };
    if (tipo === "vista") g("event", "view_item", { ...mon, value: gaItem(producto).price, items: [gaItem(producto)] });
    else if (tipo === "agregar") { const it = gaItem(producto, { quantity: datos.cantidad || 1, item_variant: datos.opcion || undefined }); g("event", "add_to_cart", { ...mon, value: (it.price || 0) * it.quantity, items: [it] }); }
    else if (tipo === "buscar") g("event", "search", { search_term: datos.texto, resultados: datos.resultados });
    else if (tipo === "consulta") g("event", "consulta_whatsapp", { motivo: datos.motivo || "general", item_id: producto || undefined, texto: datos.texto || undefined });
    else if (tipo === "pedido") g("event", "generate_lead", { ...mon, value: datos.total, numero_whatsapp: datos.numero, entrega: datos.entrega, pago: datos.pago, items: (datos.items || []).map(i => gaItem(i.id, { quantity: i.cantidad, price: i.precio, item_variant: i.opcion || undefined })) });
  }
  function iniciarGA(id) {
    id = (id || "").trim();
    if (gaListo || enAdmin || !/^G-[A-Z0-9]{6,}$/i.test(id)) return;
    gaListo = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", id, { anonymize_ip: true });
    const s = document.createElement("script"); s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.appendChild(s);
    gaPendientes.splice(0).forEach(a => gaEnviar(...a));
  }

  window.FY = {
    productos: [],
    iniciarGA,
    modo: nube ? "nube" : "demo",

    async cargar() {
      if (!nube) { const c = ordenar(demo()); c.combos = (c.combos || []).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)); return c; }
      const [t, c, p, k] = await Promise.all([
        sb.from("tienda").select("datos").eq("id", 1).maybeSingle(),
        sb.from("categorias").select("*"),
        sb.from("productos").select("*"),
        sb.from("combos").select("id,datos,orden")
      ]);
      // Si todavía no creaste la tabla de combos, la tienda sigue funcionando sin ellos
      const combos = k.error ? [] : (k.data || []).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).map(x => ({ ...x.datos, id: x.id, orden: x.orden }));
      return ordenar({
        tienda: revisar(t)?.datos || copia(window.CATALOGO_INICIAL.tienda),
        categorias: revisar(c) || [],
        productos: revisar(p) || [],
        combos
      });
    },

    async guardarProducto(p) {
      if (!nube) { const c = demo(); const i = c.productos.findIndex(x => x.id === p.id); i >= 0 ? c.productos[i] = p : c.productos.push(p); guardarDemo(c); return p; }
      return revisar(await sb.from("productos").upsert(p).select().single());
    },
    async borrarProducto(id) {
      if (!nube) { const c = demo(); c.productos = c.productos.filter(x => x.id !== id); guardarDemo(c); return; }
      revisar(await sb.from("productos").delete().eq("id", id));
    },
    async guardarCombo(cb) {
      if (!nube) { const c = demo(); c.combos = c.combos || []; const i = c.combos.findIndex(x => x.id === cb.id); i >= 0 ? c.combos[i] = cb : c.combos.push(cb); guardarDemo(c); return cb; }
      revisar(await sb.from("combos").upsert({ id: cb.id, datos: cb, orden: cb.orden || 0 }));
      return cb;
    },
    async borrarCombo(id) {
      if (!nube) { const c = demo(); c.combos = (c.combos || []).filter(x => x.id !== id); guardarDemo(c); return; }
      revisar(await sb.from("combos").delete().eq("id", id));
    },
    // Convierte los combos en "productos virtuales" para que la tienda los trate igual que cualquier producto
    armarCombos(productos, combos) {
      const out = [];
      (combos || []).filter(c => c.activo !== false).forEach(c => {
        const items = (c.items || []).map(i => ({ p: productos.find(x => x.id === i.id), cant: Math.max(1, +i.cant || 1), op: i.op || "" })).filter(x => x.p);
        if (!items.length) return;
        const normal = items.reduce((s, x) => s + x.p.precio * x.cant, 0);
        const detalle = items.map(x => `${x.cant} x ${x.p.nombre}${x.op ? " (" + x.op + ")" : ""}`);
        out.push({
          id: "combo" + c.id, combo: true, idCombo: c.id, nombre: c.nombre, cat: "combos", marca: "Combo", precio: +c.precio || 0,
          antes: normal > c.precio ? normal : null, desde: false, pres: "Combo", descripcion: c.descripcion || "", puntos: detalle, opciones: [],
          fotos: (c.fotos && c.fotos.length) ? c.fotos : [...new Set(items.map(x => { const f = x.p.fotos || [], o = x.p.opciones || []; const k = x.op ? o.indexOf(x.op) : -1; return (f.length === o.length && k >= 0) ? f[k] : f[0]; }).filter(Boolean))].slice(0, 3),
          destacado: true, disponible: items.every(x => x.p.disponible !== false), orden: -1, wa: c.wa || "", normal, ahorro: Math.max(0, normal - c.precio)
        });
      });
      return out;
    },
    async guardarOrden(lista) {
      if (!nube) { const c = demo(); lista.forEach(({ id, orden }) => { const p = c.productos.find(x => x.id === id); if (p) p.orden = orden; }); guardarDemo(c); return; }
      await Promise.all(lista.map(({ id, orden }) => sb.from("productos").update({ orden }).eq("id", id)));
    },
    async guardarCategorias(lista) {
      if (!nube) { const c = demo(); c.categorias = lista; guardarDemo(c); return; }
      const actuales = revisar(await sb.from("categorias").select("id")) || [];
      const quitar = actuales.map(x => x.id).filter(id => !lista.some(l => l.id === id));
      if (quitar.length) revisar(await sb.from("categorias").delete().in("id", quitar));
      if (lista.length) revisar(await sb.from("categorias").upsert(lista));
    },
    async guardarTienda(t) {
      if (!nube) { const c = demo(); c.tienda = t; guardarDemo(c); return; }
      revisar(await sb.from("tienda").upsert({ id: 1, datos: t }));
    },

    async subirFoto(archivo) {
      const blob = await achicar(archivo, nube ? 1200 : 700, nube ? 0.86 : 0.78);
      if (!nube) return aDataUrl(blob);
      const nombre = `${Date.now()}${Math.random().toString(36).slice(2, 7)}.jpg`;
      revisar(await sb.storage.from(cfg.carpetaFotos).upload(nombre, blob, { contentType: "image/jpeg", cacheControl: "31536000" }));
      return sb.storage.from(cfg.carpetaFotos).getPublicUrl(nombre).data.publicUrl;
    },

    evento(tipo, producto = null, datos = {}) {
      if (!enAdmin) { if (gaListo) gaEnviar(tipo, producto, datos); else if (gaPendientes.length < 50) gaPendientes.push([tipo, producto, datos]); }
      const ev = { tipo, producto, datos, sesion, creado: new Date().toISOString() };
      if (!nube) { const l = leerLocal(CLAVE_EV, []); l.push(ev); if (l.length > 5000) l.splice(0, l.length - 5000); guardarLocal(CLAVE_EV, l); return; }
      sb.from("eventos").insert({ tipo, producto, datos, sesion }).then(() => {}, () => {});
    },
    async leerEventos(desde) {
      if (!nube) return leerLocal(CLAVE_EV, []).filter(e => e.creado >= desde);
      const todos = []; const paso = 1000;
      for (let i = 0; i < 50; i++) {
        const lote = revisar(await sb.from("eventos").select("tipo,producto,datos,sesion,creado").gte("creado", desde).order("creado").range(i * paso, i * paso + paso - 1));
        todos.push(...lote);
        if (lote.length < paso) break;
      }
      return todos;
    },

    async usuario() {
      if (!nube) return { email: "modo demo" };
      return (await sb.auth.getSession()).data.session?.user || null;
    },
    async entrar(email, clave) {
      if (!nube) return { email: "modo demo" };
      const r = await sb.auth.signInWithPassword({ email, password: clave });
      if (r.error) throw new Error("Correo o contraseña incorrectos");
      return r.data.user;
    },
    async salir() { if (nube) await sb.auth.signOut(); },

    // Solo para modo demo
    reiniciarDemo() { try { localStorage.removeItem(CLAVE); localStorage.removeItem(CLAVE_EV); } catch (e) {} },
    cargarEventosEjemplo(productos) {
      const l = []; const ahora = Date.now(); const dia = 864e5;
      const peso = productos.map((p, i) => ({ p, w: (p.destacado ? 4 : 1) * (1 + ((i * 37) % 11) / 4) }));
      const total = peso.reduce((s, x) => s + x.w, 0);
      const elegir = () => { let r = Math.random() * total; for (const x of peso) { r -= x.w; if (r <= 0) return x.p; } return peso[0].p; };
      const busq = ["creatina", "whey", "proteina", "pre entreno", "colageno", "straps", "bcaa", "quemador"];
      for (let d = 59; d >= 0; d--) {
        const visitas = 25 + Math.round(Math.random() * 30) + (d < 10 ? 15 : 0);
        for (let v = 0; v < visitas; v++) {
          const s = "ej" + d + "x" + v; const t = () => new Date(ahora - d * dia - Math.random() * dia).toISOString();
          l.push({ tipo: "visita", producto: null, datos: {}, sesion: s, creado: t() });
          if (Math.random() < .3) { const q = busq[Math.floor(Math.random() * busq.length)]; l.push({ tipo: "buscar", producto: null, datos: { texto: q, resultados: ["colageno", "bcaa"].includes(q) ? 0 : 4 }, sesion: s, creado: t() }); }
          const vistos = Math.floor(Math.random() * 4);
          const carrito = [];
          for (let k = 0; k < vistos; k++) {
            const p = elegir(); l.push({ tipo: "vista", producto: p.id, datos: {}, sesion: s, creado: t() });
            if (Math.random() < .06) l.push({ tipo: "consulta", producto: p.id, datos: { motivo: "comprar ahora" }, sesion: s, creado: t() });
            if (Math.random() < .35) { carrito.push(p); l.push({ tipo: "agregar", producto: p.id, datos: { cantidad: 1 }, sesion: s, creado: t() }); }
          }
          if (carrito.length && Math.random() < .45) {
            const items = carrito.map(p => ({ id: p.id, cantidad: 1, precio: p.precio }));
            l.push({ tipo: "pedido", producto: null, datos: { items, total: items.reduce((x, i) => x + i.precio, 0) }, sesion: s, creado: t() });
          }
        }
      }
      guardarLocal(CLAVE_EV, l.sort((a, b) => a.creado.localeCompare(b.creado)));
    }
  };
})();

