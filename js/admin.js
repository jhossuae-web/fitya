(async () => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const bs = n => "Bs " + Number(n || 0).toLocaleString("es-BO", { maximumFractionDigits: 0 });
  const num = n => Number(n || 0).toLocaleString("es-BO", { maximumFractionDigits: 1 });
  const plano = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const slug = t => plano(t).replace(/[^a-z0-9]+/g, "").slice(0, 40) || "producto";
  const demo = FY.modo === "demo";

  const toast = (() => { let t; return msg => { const el = $("#toast"); el.textContent = msg; el.classList.add("visible"); clearTimeout(t); t = setTimeout(() => el.classList.remove("visible"), 2400); }; })();
  const confirmar = (titulo, texto, boton = "Confirmar") => new Promise(ok => {
    const d = $("#confirmar"); $("#kTitulo").textContent = titulo; $("#kTexto").textContent = texto; $("#kSi").textContent = boton;
    const fin = v => { d.close(); $("#kSi").onclick = $("#kNo").onclick = null; ok(v); };
    $("#kSi").onclick = () => fin(true); $("#kNo").onclick = () => fin(false);
    d.oncancel = () => fin(false);
    d.showModal();
  });
  const fallo = e => { console.error(e); toast(e.message || "No se pudo guardar. Revisa tu conexión."); };

  // Acceso
  let C;
  async function iniciar() {
    const u = await FY.usuario();
    if (!u) { $("#acceso").hidden = false; $("#panel").hidden = true; $("#aCorreo").focus(); return; }
    $("#acceso").hidden = true; $("#panel").hidden = false;
    $("#usuario").textContent = demo ? "" : u.email;
    $("#modo").textContent = demo ? "Modo demo" : "Conectado a la nube";
    $("#modo").classList.toggle("modo--nube", !demo);
    $("#demoAviso").hidden = !demo; $("#zonaDemo").hidden = !demo; $("#salir").hidden = demo;
    C = await FY.cargar();
    pintarProductos(); pintarCategorias(); pintarTienda(); pintarCombos();
    irA(location.hash.slice(1) || "metricas");
  }
  $("#formAcceso").addEventListener("submit", async e => {
    e.preventDefault(); $("#aError").hidden = true;
    try { await FY.entrar($("#aCorreo").value.trim(), $("#aClave").value); iniciar(); }
    catch (err) { $("#aError").textContent = err.message; $("#aError").hidden = false; }
  });
  $("#salir").addEventListener("click", async () => { await FY.salir(); location.reload(); });

  const todosProd = () => C.productos.concat(FY.armarCombos(C.productos, C.combos || []));

  // Navegación
  const vistas = ["metricas", "productos", "combos", "categorias", "tienda"];
  function irA(v) {
    if (!vistas.includes(v)) v = "metricas";
    vistas.forEach(x => { $("#vista-" + x).hidden = x !== v; });
    $$(".nav button").forEach(b => b.toggleAttribute("aria-current", b.dataset.vista === v));
    $$(".nav button[aria-current]").forEach(b => b.setAttribute("aria-current", "page"));
    history.replaceState(null, "", "#" + v);
    if (v === "metricas") cargarMetricas();
    window.scrollTo(0, 0);
  }
  $(".nav").addEventListener("click", e => { const b = e.target.closest("[data-vista]"); if (b) irA(b.dataset.vista); });

  // Números de WhatsApp
  const numerosDe = T => ((T.numeros || []).length ? T.numeros : [T.whatsapp, T.whatsapp2].filter(Boolean).map((n, i) => ({ nombre: i ? "Ventas 2" : "Ventas", numero: n })));
  const limpiarNum = s => { const d = String(s || "").replace(/\D/g, ""); return d.length === 8 ? "591" + d : d; };
  const verNum = n => n ? "+" + n.replace(/^591/, "591 ") : "";
  const nombreNum = n => { const x = numerosDe(C.tienda).find(k => k.numero === n); return x ? x.nombre : verNum(n); };

  const nombreCat = id => (C.categorias.find(c => c.id === id) || {}).nombre || "Sin categoría";
  const miniFoto = p => p.fotos?.[0] ? `<img src="${esc(p.fotos[0])}" alt="">` : `<img src="img/productos/${esc(p.id)}.jpg" alt="" onerror="this.replaceWith('Sin foto')">`;

  /* ================= MÉTRICAS ================= */
  let tablaOrden = { col: "vistas", dir: -1 }, filasTabla = [], tablaTodo = false;
  async function cargarMetricas() {
    const dias = +$("#mDias input:checked").value;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const inicio = new Date(hoy); inicio.setDate(inicio.getDate() - (dias - 1));
    const previo = new Date(inicio); previo.setDate(previo.getDate() - dias);
    $("#mRango").textContent = dias === 1 ? "Hoy" : `Del ${inicio.toLocaleDateString("es-BO", { day: "numeric", month: "long" })} a hoy`;
    $("#mGa").hidden = !((window.FITYA_CONFIG || {}).gaId || (C.tienda || {}).gaId);
    let todos;
    try { todos = await FY.leerEventos(previo.toISOString()); }
    catch (e) { fallo(e); todos = []; }
    const ev = todos.filter(e => e.creado >= inicio.toISOString());
    const antes = todos.filter(e => e.creado < inicio.toISOString());
    $("#demoDatos").hidden = !(demo && !todos.length);
    pintarMetricas(ev, antes, dias, inicio);
  }
  $("#mDias").addEventListener("change", cargarMetricas);
  $("#mActualizar").addEventListener("click", async () => { C = await FY.cargar(); cargarMetricas(); toast("Métricas actualizadas"); });
  $("#cargarEjemplo").addEventListener("click", () => { FY.cargarEventosEjemplo(C.productos); cargarMetricas(); toast("Datos de ejemplo cargados"); });

  function resumen(ev) {
    const ses = t => new Set(ev.filter(e => e.tipo === t).map(e => e.sesion));
    const pedidos = ev.filter(e => e.tipo === "pedido");
    return {
      visitas: ses("visita").size,
      vistas: ev.filter(e => e.tipo === "vista").length,
      agregados: ev.filter(e => e.tipo === "agregar").reduce((s, e) => s + (e.datos?.cantidad || 1), 0),
      pedidos: pedidos.length,
      monto: pedidos.reduce((s, e) => s + (+e.datos?.total || 0), 0),
      consultas: ev.filter(e => e.tipo === "consulta").length,
      sesVista: ses("vista"), sesAgregar: ses("agregar"), sesPedido: ses("pedido"), sesVisita: ses("visita")
    };
  }
  const cambio = (a, b) => {
    if (!b) return a ? `<small>sin datos para comparar</small>` : `<small>&nbsp;</small>`;
    const p = Math.round((a - b) / b * 100);
    return `<small class="${p >= 0 ? "sube" : "baja"}">${p >= 0 ? "+" : ""}${p}% vs periodo anterior</small>`;
  };

  function pintarMetricas(ev, antes, dias, inicio) {
    const r = resumen(ev), a = resumen(antes);
    const conv = r.visitas ? r.pedidos / r.visitas * 100 : 0, convA = a.visitas ? a.pedidos / a.visitas * 100 : 0;
    $("#cifras").innerHTML = [
      ["Visitas", num(r.visitas), cambio(r.visitas, a.visitas)],
      ["Productos vistos", num(r.vistas), cambio(r.vistas, a.vistas)],
      ["Agregados al pedido", num(r.agregados), cambio(r.agregados, a.agregados)],
      ["Pedidos por WhatsApp", num(r.pedidos), `<small>${num(r.consultas)} consultas directas</small>`],
      ["Monto en pedidos", bs(r.monto), r.pedidos ? `<small>${bs(r.monto / r.pedidos)} por pedido</small>` : `<small>&nbsp;</small>`],
      ["Conversión", num(conv) + "%", cambio(conv, convA)]
    ].map(([t, v, s]) => `<div class="cifra"><span>${t}</span><b>${v}</b>${s}</div>`).join("");

    // Series por día (o por hora si es hoy)
    const cubos = [];
    if (dias === 1) for (let h = 0; h <= new Date().getHours(); h++) cubos.push({ clave: h, x: `${String(h).padStart(2, "0")} h`, etiqueta: `de ${h}:00 a ${h}:59` });
    else for (let i = 0; i < dias; i++) { const d = new Date(inicio); d.setDate(d.getDate() + i); cubos.push({ clave: d.toDateString(), x: d.toLocaleDateString("es-BO", { day: "numeric", month: "short" }).replace(".", ""), etiqueta: d.toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" }) }); }
    const claveDe = e => dias === 1 ? new Date(e.creado).getHours() : new Date(e.creado).toDateString();
    const serie = (filtro, unico) => cubos.map(c => {
      const l = ev.filter(e => filtro(e) && claveDe(e) === c.clave);
      return { x: c.x, etiqueta: c.etiqueta, y: unico ? new Set(l.map(e => e.sesion)).size : l.length };
    });
    G.linea($("#gVisitas"), serie(e => e.tipo === "visita", true), { unidad: " visitas" });
    G.columnas($("#gPedidos"), serie(e => e.tipo === "pedido"), { unidad: " pedidos" });

    // Embudo
    const base = r.visitas || 1;
    G.barras($("#gEmbudo"), r.visitas ? [
      { nombre: "Entraron a la tienda", valor: r.visitas, extra: "100%" },
      { nombre: "Abrieron un producto", valor: r.sesVista.size, extra: Math.round(r.sesVista.size / base * 100) + "%" },
      { nombre: "Agregaron al pedido", valor: r.sesAgregar.size, extra: Math.round(r.sesAgregar.size / base * 100) + "%" },
      { nombre: "Enviaron el pedido", valor: r.sesPedido.size, extra: Math.round(r.sesPedido.size / base * 100) + "%" }
    ] : [], { max: r.visitas });

    // Productos
    const porProd = {};
    const fila = id => porProd[id] ||= { vistas: 0, agregados: 0, vendidos: 0, ingresos: 0, consultas: 0 };
    ev.forEach(e => {
      if (e.tipo === "vista" && e.producto) fila(e.producto).vistas++;
      if (e.tipo === "agregar" && e.producto) fila(e.producto).agregados += e.datos?.cantidad || 1;
      if (e.tipo === "consulta" && e.producto) fila(e.producto).consultas++;
      if (e.tipo === "pedido") (e.datos?.items || []).forEach(i => { const f = fila(i.id); f.vendidos += i.cantidad || 1; f.ingresos += (i.cantidad || 1) * (i.precio || 0); });
    });
    filasTabla = todosProd().map(p => { const f = porProd[p.id] || {}; return { id: p.id, nombre: p.nombre, cat: nombreCat(p.cat), vistas: f.vistas || 0, agregados: f.agregados || 0, consultas: f.consultas || 0, vendidos: f.vendidos || 0, ingresos: f.ingresos || 0, tasa: f.vistas ? Math.round((f.agregados || 0) / f.vistas * 100) : 0 }; });
    pintarTabla();

    // Categorías
    const porCat = {};
    ev.filter(e => e.tipo === "vista" && e.producto).forEach(e => { const p = todosProd().find(x => x.id === e.producto); if (p) porCat[p.cat] = (porCat[p.cat] || 0) + 1; });
    G.barras($("#gCategorias"), Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => ({ nombre: nombreCat(c), valor: v, extra: Math.round(v / r.vistas * 100) + "%" })));

    // Pedidos por número (solo si hay más de uno)
    const porNum = {};
    ev.filter(e => e.tipo === "pedido").forEach(e => { const n = e.datos?.numero || numerosDe(C.tienda)[0]?.numero || ""; porNum[n] = (porNum[n] || 0) + 1; });
    $("#cajaNumeros").hidden = numerosDe(C.tienda).length < 2 && Object.keys(porNum).length < 2;
    G.barras($("#gNumeros"), Object.entries(porNum).sort((a, b) => b[1] - a[1]).map(([n, v]) => ({ nombre: nombreNum(n), valor: v, extra: Math.round(v / (r.pedidos || 1) * 100) + "%" })));

    // Búsquedas
    const bus = {};
    ev.filter(e => e.tipo === "buscar" && e.datos?.texto).forEach(e => { const k = e.datos.texto.trim(); bus[k] ||= { n: 0, cero: true }; bus[k].n++; if (e.datos.resultados > 0) bus[k].cero = false; });
    G.barras($("#gBusquedas"), Object.entries(bus).sort((a, b) => b[1].n - a[1].n).slice(0, 10).map(([k, v]) => ({ nombre: k, valor: v.n, alerta: v.cero ? "sin resultados" : "" })), { vacio: "Nadie usó el buscador en este periodo" });
  }

  const columnasTabla = [
    ["nombre", "Producto"], ["vistas", "Vistas"], ["agregados", "Agregados"], ["tasa", "% que agrega"],
    ["consultas", "Consultas"], ["vendidos", "En pedidos"], ["ingresos", "Monto"]
  ];
  function pintarTabla() {
    const { col, dir } = tablaOrden;
    const l = [...filasTabla].sort((a, b) => col === "nombre" ? a.nombre.localeCompare(b.nombre) * -dir : (a[col] - b[col]) * dir || b.vistas - a.vistas);
    const maxV = Math.max(1, ...l.map(f => f.vistas));
    $("#tProductos").innerHTML = `<thead><tr>${columnasTabla.map(([k, t]) => `<th ${k === col ? `aria-sort="${dir < 0 ? "descending" : "ascending"}"` : ""}><button data-col="${k}">${t}</button></th>`).join("")}</tr></thead>
      <tbody>${l.slice(0, tablaTodo ? 999 : 12).map(f => `<tr>
        <td><div class="celda-nombre">${esc(f.nombre)}<small>${esc(f.cat)}</small><div class="mini-barra" style="width:${f.vistas / maxV * 100}%"></div></div></td>
        <td>${num(f.vistas)}</td><td>${num(f.agregados)}</td><td>${f.vistas ? f.tasa + "%" : "<span class='tenue'>sin vistas</span>"}</td>
        <td>${num(f.consultas)}</td><td>${num(f.vendidos)}</td><td>${f.ingresos ? bs(f.ingresos) : "<span class='tenue'>Bs 0</span>"}</td>
      </tr>`).join("")}</tbody>`;
    $("#tMas").hidden = l.length <= 12;
    $("#tMas").textContent = tablaTodo ? "Mostrar menos" : `Ver los ${l.length} productos`;
  }
  $("#tMas").addEventListener("click", () => { tablaTodo = !tablaTodo; pintarTabla(); });
  $("#tProductos").addEventListener("click", e => {
    const b = e.target.closest("[data-col]"); if (!b) return;
    tablaOrden = { col: b.dataset.col, dir: tablaOrden.col === b.dataset.col ? -tablaOrden.dir : (b.dataset.col === "nombre" ? 1 : -1) };
    if (tablaOrden.col === "nombre") tablaOrden.dir = tablaOrden.dir > 0 ? -1 : 1;
    pintarTabla();
  });
  $("#mCsv").addEventListener("click", () => {
    const filas = [["Producto", "Categoria", "Vistas", "Agregados", "Porcentaje que agrega", "Consultas", "En pedidos", "Monto Bs"], ...filasTabla.map(f => [f.nombre, f.cat, f.vistas, f.agregados, f.tasa, f.consultas, f.vendidos, f.ingresos])];
    const csv = "﻿" + filas.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `fitya metricas ${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  let tRedim; window.addEventListener("resize", () => { clearTimeout(tRedim); tRedim = setTimeout(() => { if (!$("#vista-metricas").hidden) cargarMetricas(); }, 250); });

  /* ================= PRODUCTOS ================= */
  const icoEditar = `<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m14 6 4 4"/></svg>`;
  const icoCopiar = `<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>`;
  const icoBorrar = `<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/></svg>`;

  function pintarProductos() {
    $("#pCat").innerHTML = `<option value="">Todas las categorías</option>` + C.categorias.map(c => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join("");
    listarProductos();
  }
  function listarProductos() {
    const q = plano($("#pBuscar").value), cat = $("#pCat").value, est = $("#pEstado").value;
    const l = C.productos.filter(p => {
      if (q && !plano(p.nombre + " " + p.marca).includes(q)) return false;
      if (cat && p.cat !== cat) return false;
      if (est === "stock" && p.disponible === false) return false;
      if (est === "sin" && p.disponible !== false) return false;
      if (est === "oferta" && !p.antes) return false;
      if (est === "destacado" && !p.destacado) return false;
      if (est === "sinfoto" && p.fotos?.length) return false;
      return true;
    });
    $("#pCuenta").textContent = `${C.productos.length} en total, ${C.productos.filter(p => p.disponible === false).length} sin stock`;
    $("#pLista").innerHTML = l.length ? l.map(p => `
      <li class="item${p.disponible === false ? " item--apagado" : ""}" data-id="${esc(p.id)}">
        <div class="item__foto">${miniFoto(p)}</div>
        <div class="item__nombre">${esc(p.nombre)}<small>${esc([nombreCat(p.cat), p.marca].filter(Boolean).join(", "))}${p.wa ? `<span class="tag-wa">pedidos a ${esc(nombreNum(p.wa))}</span>` : ""}</small></div>
        <div class="item__precio">${bs(p.precio)}${p.antes ? `<s>${bs(p.antes)}</s>` : ""}</div>
        <div class="etiquetas">
          <button class="chip chip--stock" data-accion="stock" aria-pressed="${p.disponible !== false}">${p.disponible !== false ? "Con stock" : "Sin stock"}</button>
          <button class="chip" data-accion="destacado" aria-pressed="${!!p.destacado}">Destacado</button>
        </div>
        <div class="botones-item">
          <button class="icono-btn" data-accion="editar" aria-label="Editar ${esc(p.nombre)}" title="Editar">${icoEditar}</button>
          <button class="icono-btn" data-accion="duplicar" aria-label="Duplicar ${esc(p.nombre)}" title="Duplicar">${icoCopiar}</button>
          <button class="icono-btn icono-btn--peligro" data-accion="borrar" aria-label="Borrar ${esc(p.nombre)}" title="Borrar">${icoBorrar}</button>
        </div>
      </li>`).join("") : `<li class="vacio-grafico">No hay productos con esos filtros.</li>`;
  }
  ["#pBuscar", "#pCat", "#pEstado"].forEach(s => $(s).addEventListener("input", listarProductos));

  $("#pLista").addEventListener("click", async e => {
    const b = e.target.closest("[data-accion]"); if (!b) return;
    const p = C.productos.find(x => x.id === b.closest("[data-id]").dataset.id);
    const accion = b.dataset.accion;
    try {
      if (accion === "editar") return abrirEditor(p);
      if (accion === "duplicar") return abrirEditor({ ...JSON.parse(JSON.stringify(p)), id: null, nombre: p.nombre + " copia" });
      if (accion === "stock" || accion === "destacado") {
        const campo = accion === "stock" ? "disponible" : "destacado";
        const nuevo = { ...p, [campo]: campo === "disponible" ? p.disponible === false : !p.destacado };
        await FY.guardarProducto(nuevo); Object.assign(p, nuevo); listarProductos();
        toast(campo === "disponible" ? (nuevo.disponible ? "Marcado con stock" : "Marcado sin stock") : (nuevo.destacado ? "Ahora es destacado" : "Ya no es destacado"));
      }
      if (accion === "borrar") {
        if (!await confirmar("¿Borrar producto?", `${p.nombre} desaparece de la tienda. Si solo no tienes stock, mejor márcalo sin stock.`, "Borrar")) return;
        await FY.borrarProducto(p.id); C.productos = C.productos.filter(x => x.id !== p.id); listarProductos(); toast("Producto borrado");
      }
    } catch (err) { fallo(err); }
  });

  // Editor de producto
  const ed = $("#editor"), f = $("#eForm");
  let editando = null, fotos = [];
  $("#nuevoProducto").addEventListener("click", () => abrirEditor(null));
  function abrirEditor(p) {
    editando = p && p.id ? p : null;
    const d = p || { disponible: true, cat: C.categorias[0]?.id, orden: Math.max(0, ...C.productos.map(x => x.orden || 0)) + 1 };
    $("#eTitulo").textContent = editando ? "Editar producto" : "Nuevo producto";
    $("#eCat").innerHTML = C.categorias.map(c => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join("");
    $("#eMarcas").innerHTML = [...new Set(C.productos.map(x => x.marca).filter(Boolean))].map(m => `<option value="${esc(m)}">`).join("");
    f.nombre.value = d.nombre || ""; f.cat.value = d.cat || ""; f.marca.value = d.marca || "";
    f.precio.value = d.precio ?? ""; f.antes.value = d.antes ?? ""; f.pres.value = d.pres || "";
    f.desde.checked = !!d.desde; f.descripcion.value = d.descripcion || "";
    f.puntos.value = (d.puntos || []).join("\n"); f.opciones.value = (d.opciones || []).join(", ");
    f.disponible.checked = d.disponible !== false; f.destacado.checked = !!d.destacado; f.orden.value = d.orden ?? 0;
    const nums = numerosDe(C.tienda);
    $("#eWa").innerHTML = nums.map((n, i) => `<option value="${i === 0 ? "" : esc(n.numero)}">${i === 0 ? "Número principal, " : ""}${esc(n.nombre)} (${esc(verNum(n.numero))})</option>`).join("") + `<option value="otro">Otro número</option>`;
    const wa = d.wa || "";
    const enLista = !wa || nums.slice(1).some(n => n.numero === wa);
    $("#eWa").value = enLista ? wa : "otro";
    $("#eWaOtro").value = enLista ? "" : wa; $("#eWaOtro").hidden = enLista;
    fotos = [...(d.fotos || [])]; pintarFotos();
    $("#eError").hidden = true;
    ed.showModal(); f.nombre.focus();
  }
  ed.addEventListener("click", e => { if (e.target.closest("[data-cerrar]")) ed.close(); });
  $("#eWa").addEventListener("change", () => { const otro = $("#eWa").value === "otro"; $("#eWaOtro").hidden = !otro; if (otro) $("#eWaOtro").focus(); });

  function pintarFotos() {
    $("#eFotos").innerHTML = fotos.map((u, i) => `<li><img src="${esc(u)}" alt="Foto ${i + 1}">
      <div class="foto-botones">
        <button type="button" data-mover="${i}" data-d="-1" aria-label="Mover antes" ${i === 0 ? "hidden" : ""}>←</button>
        <button type="button" data-quitar="${i}" aria-label="Quitar foto">✕</button>
        <button type="button" data-mover="${i}" data-d="1" aria-label="Mover después" ${i === fotos.length - 1 ? "hidden" : ""}>→</button>
      </div></li>`).join("");
  }
  $("#eFotos").addEventListener("click", e => {
    const q = e.target.closest("[data-quitar]"), m = e.target.closest("[data-mover]");
    if (q) fotos.splice(+q.dataset.quitar, 1);
    if (m) { const i = +m.dataset.mover, j = i + +m.dataset.d; [fotos[i], fotos[j]] = [fotos[j], fotos[i]]; }
    pintarFotos();
  });
  async function subir(archivos) {
    const l = [...archivos].filter(a => a.type.startsWith("image/"));
    if (!l.length) return;
    $("#eSubiendo").hidden = false; $("#eGuardar").disabled = true;
    try { for (const a of l) { fotos.push(await FY.subirFoto(a)); pintarFotos(); } }
    catch (err) { fallo(err); }
    finally { $("#eSubiendo").hidden = true; $("#eGuardar").disabled = false; $("#eArchivo").value = ""; }
  }
  $("#eArchivo").addEventListener("change", e => subir(e.target.files));
  const zona = $("#eSoltar");
  ["dragenter", "dragover"].forEach(t => zona.addEventListener(t, e => { e.preventDefault(); zona.classList.add("encima"); }));
  ["dragleave", "drop"].forEach(t => zona.addEventListener(t, () => zona.classList.remove("encima")));
  zona.addEventListener("drop", e => { e.preventDefault(); subir(e.dataTransfer.files); });

  f.addEventListener("submit", async e => {
    e.preventDefault();
    const err = msg => { $("#eError").textContent = msg; $("#eError").hidden = false; };
    const nombre = f.nombre.value.trim(), precio = parseFloat(f.precio.value), antes = parseFloat(f.antes.value);
    if (!nombre) return err("Escribe el nombre del producto"), f.nombre.focus();
    if (!(precio >= 0)) return err("Escribe el precio"), f.precio.focus();
    if (antes && antes <= precio) return err("El precio antes tiene que ser mayor que el precio actual para que se vea como oferta"), f.antes.focus();
    let wa = $("#eWa").value === "otro" ? limpiarNum($("#eWaOtro").value) : $("#eWa").value;
    if ($("#eWa").value === "otro" && wa.length < 10) return err("Escribe el otro número de WhatsApp con el 591 adelante"), $("#eWaOtro").focus();
    if (wa === numerosDe(C.tienda)[0]?.numero) wa = "";
    let id = editando?.id;
    if (!id) { id = slug(nombre); let n = 2; while (C.productos.some(p => p.id === id)) id = slug(nombre) + n++; }
    const p = {
      id, nombre, cat: f.cat.value || null, marca: f.marca.value.trim(), precio, antes: antes || null,
      desde: f.desde.checked, pres: f.pres.value.trim(), descripcion: f.descripcion.value.trim(),
      puntos: f.puntos.value.split("\n").map(s => s.trim()).filter(Boolean),
      opciones: f.opciones.value.split(",").map(s => s.trim()).filter(Boolean),
      fotos, wa, destacado: f.destacado.checked, disponible: f.disponible.checked, orden: parseInt(f.orden.value) || 0
    };
    $("#eGuardar").disabled = true;
    try {
      await FY.guardarProducto(p);
      const i = C.productos.findIndex(x => x.id === id);
      i >= 0 ? C.productos[i] = p : C.productos.push(p);
      C.productos.sort((a, b) => (a.orden || 0) - (b.orden || 0));
      ed.close(); listarProductos(); toast(editando ? "Cambios guardados" : "Producto creado");
    } catch (er) { err(er.message); }
    finally { $("#eGuardar").disabled = false; }
  });

  /* ================= CATEGORÍAS ================= */
  function pintarCategorias() {
    $("#cLista").innerHTML = C.categorias.map((c, i) => {
      const n = C.productos.filter(p => p.cat === c.id).length;
      return `<li data-i="${i}">
        <span class="mover"><button data-sub="${i}" aria-label="Subir" ${i === 0 ? "disabled" : ""}>▲</button><button data-baj="${i}" aria-label="Bajar" ${i === C.categorias.length - 1 ? "disabled" : ""}>▼</button></span>
        <input value="${esc(c.nombre)}" aria-label="Nombre de la categoría" data-nombre="${i}">
        <input class="cat-texto" value="${esc(c.texto || "")}" placeholder="Frase corta, ej: Energía antes de entrenar" aria-label="Frase de la categoría" data-texto="${i}">
        <span class="tenue">${n} ${n === 1 ? "producto" : "productos"}</span>
        <button class="icono-btn icono-btn--peligro" data-borrar="${i}" aria-label="Borrar ${esc(c.nombre)}">${icoBorrar}</button>
      </li>`;
    }).join("");
  }
  async function guardarCats(msg) {
    C.categorias.forEach((c, i) => c.orden = i);
    try { await FY.guardarCategorias(C.categorias); pintarCategorias(); pintarProductos(); if (msg) toast(msg); } catch (e) { fallo(e); }
  }
  $("#cLista").addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;
    const L = C.categorias;
    if (b.dataset.sub) { const i = +b.dataset.sub; [L[i - 1], L[i]] = [L[i], L[i - 1]]; return guardarCats("Orden guardado"); }
    if (b.dataset.baj) { const i = +b.dataset.baj; [L[i + 1], L[i]] = [L[i], L[i + 1]]; return guardarCats("Orden guardado"); }
    if (b.dataset.borrar) {
      const c = L[+b.dataset.borrar], n = C.productos.filter(p => p.cat === c.id).length;
      if (n) return confirmar("No se puede borrar todavía", `${c.nombre} tiene ${n} productos. Cámbialos de categoría primero.`, "Entendido");
      if (!await confirmar("¿Borrar categoría?", `${c.nombre} deja de aparecer en la tienda.`, "Borrar")) return;
      L.splice(+b.dataset.borrar, 1); guardarCats("Categoría borrada");
    }
  });
  $("#cLista").addEventListener("change", e => {
    if (e.target.dataset.texto !== undefined) { C.categorias[e.target.dataset.texto].texto = e.target.value.trim(); return guardarCats("Frase guardada"); }
    const i = e.target.dataset.nombre; if (i === undefined) return;
    const v = e.target.value.trim(); if (!v) { e.target.value = C.categorias[i].nombre; return; }
    C.categorias[i].nombre = v; guardarCats("Nombre guardado");
  });
  $("#cForm").addEventListener("submit", e => {
    e.preventDefault();
    const nombre = $("#cNueva").value.trim(); if (!nombre) return;
    let id = slug(nombre), n = 2; while (C.categorias.some(c => c.id === id)) id = slug(nombre) + n++;
    C.categorias.push({ id, nombre, texto: "", orden: C.categorias.length }); $("#cNueva").value = "";
    guardarCats("Categoría agregada");
  });

  /* ================= DATOS DE LA TIENDA ================= */
  const tf = $("#tForm");
  let logo = "";
  function pintarTienda() {
    const T = C.tienda;
    ["aviso", "titulo", "subtitulo", "ciudad", "horario", "envio", "mayoristas", "gaId", "instagram", "tiktok", "facebook"].forEach(k => { tf[k].value = T[k] || ""; });
    nums = numerosDe(T).map(n => ({ ...n })); pintarNumeros();
    tf.pagos.value = (T.pagos || []).join("\n");
    logo = T.logo || ""; pintarLogo();
  }
  let nums = [];
  function pintarNumeros() {
    $("#tNumeros").innerHTML = nums.map((n, i) => `<li>
      <span class="numeros__rol">${i === 0 ? "Principal" : `<button type="button" class="enlace" data-principal="${i}">Hacer principal</button>`}</span>
      <input type="text" value="${esc(n.nombre)}" placeholder="Nombre, ej: Ventas" aria-label="Nombre del número" data-campo="nombre" data-i="${i}">
      <input type="tel" value="${esc(n.numero)}" placeholder="59171234567" aria-label="Número" data-campo="numero" data-i="${i}">
      ${nums.length > 1 ? `<button type="button" class="icono-btn icono-btn--peligro" data-quitarnum="${i}" aria-label="Quitar número">${icoBorrar}</button>` : "<span></span>"}
    </li>`).join("");
  }
  $("#tNumeros").addEventListener("input", e => { const i = e.target.dataset.i; if (i !== undefined) nums[i][e.target.dataset.campo] = e.target.value; });
  $("#tNumeros").addEventListener("click", e => {
    const pr = e.target.closest("[data-principal]"), q = e.target.closest("[data-quitarnum]");
    if (pr) { const [x] = nums.splice(+pr.dataset.principal, 1); nums.unshift(x); pintarNumeros(); }
    if (q) { nums.splice(+q.dataset.quitarnum, 1); pintarNumeros(); }
  });
  $("#tNumeroNuevo").addEventListener("click", () => { nums.push({ nombre: "", numero: "" }); pintarNumeros(); $("#tNumeros li:last-child input").focus(); });

  const pintarLogo = () => { $("#tLogoVista").innerHTML = logo ? `<img src="${esc(logo)}" alt="Logo">` : "Sin logo"; $("#tLogoQuitar").hidden = !logo; };
  $("#tLogo").addEventListener("change", async e => { const a = e.target.files[0]; if (!a) return; try { logo = await FY.subirFoto(a); pintarLogo(); toast("Logo listo, guarda los cambios"); } catch (er) { fallo(er); } });
  $("#tLogoQuitar").addEventListener("click", () => { logo = ""; pintarLogo(); });
  tf.addEventListener("submit", async e => {
    e.preventDefault();
    const T = { ...C.tienda };
    ["aviso", "titulo", "subtitulo", "ciudad", "horario", "envio", "mayoristas", "gaId", "instagram", "tiktok", "facebook"].forEach(k => { T[k] = tf[k].value.trim(); });
    const limpios = nums.map((n, i) => ({ nombre: n.nombre.trim() || (i ? `Ventas ${i + 1}` : "Ventas"), numero: limpiarNum(n.numero) })).filter(n => n.numero);
    const malo = limpios.findIndex(n => n.numero.length < 10);
    if (!limpios.length || malo >= 0) { toast("Revisa los números de WhatsApp: llevan el 591 adelante"); $(`#tNumeros [data-campo=numero][data-i="${Math.max(0, malo)}"]`)?.focus(); return; }
    T.numeros = limpios; T.whatsapp = limpios[0].numero; T.whatsapp2 = limpios[1]?.numero || "";
    T.pagos = tf.pagos.value.split("\n").map(s => s.trim()).filter(Boolean);
    T.logo = logo;
    try { await FY.guardarTienda(T); C.tienda = T; nums = limpios.map(n => ({ ...n })); pintarNumeros(); toast("Datos de la tienda guardados"); } catch (er) { fallo(er); }
  });
  $("#reiniciar").addEventListener("click", async () => {
    if (!await confirmar("¿Reiniciar la demo?", "Vuelve el catálogo original y se borran las métricas de este navegador.", "Reiniciar")) return;
    FY.reiniciarDemo(); location.reload();
  });


  // ===== Combos =====
  const kb = { editando: null, items: [] };
  const precioNormal = items => items.reduce((s, i) => { const p = C.productos.find(x => x.id === i.id); return s + (p ? p.precio * (+i.cant || 1) : 0); }, 0);
  function pintarCombos() {
    const L = C.combos || [];
    $("#kbLista").innerHTML = L.length ? L.map((c, i) => {
      const normal = precioNormal(c.items || []);
      const ahorro = Math.max(0, normal - c.precio);
      const faltan = (c.items || []).some(it => { const p = C.productos.find(x => x.id === it.id); return !p || p.disponible === false; });
      return `<li class="item-combo ${c.activo === false ? "item-combo--apagado" : ""}" data-i="${i}">
        <div class="item-combo__info">
          <b>${esc(c.nombre)}</b>
          <small>${(c.items || []).map(it => { const p = C.productos.find(x => x.id === it.id); return `${it.cant} x ${esc(p ? p.nombre : it.id)}${it.op ? " (" + esc(it.op) + ")" : ""}`; }).join(" + ")}</small>
          ${faltan ? `<span class="marca-alerta">Un producto está sin stock</span>` : ""}
        </div>
        <div class="item-combo__precio"><strong>${bs(c.precio)}</strong><s>${bs(normal)}</s>${ahorro ? `<span class="tag-wa">Ahorra ${bs(ahorro)}</span>` : `<span class="marca-alerta">Sin ahorro</span>`}</div>
        <button class="chip" data-accion="activo" aria-pressed="${c.activo !== false}">${c.activo === false ? "Oculto" : "Visible"}</button>
        <span class="botones-item">
          <button class="icono-btn" data-accion="editar" aria-label="Editar"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4ZM13.500 6.500l4 4"/></svg></button>
          <button class="icono-btn" data-accion="duplicar" aria-label="Duplicar"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg></button>
          <button class="icono-btn icono-btn--peligro" data-accion="borrar" aria-label="Borrar"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>
        </span>
      </li>`;
    }).join("") : `<li class="vacio-lista"><p>Todavía no hay combos.</p><p class="tenue">Crea uno juntando 2 o más productos a un precio menor que por separado.</p></li>`;
  }
  $("#kbLista").addEventListener("click", async e => {
    const b = e.target.closest("[data-accion]"); if (!b) return;
    const c = C.combos[+b.closest("[data-i]").dataset.i];
    try {
      if (b.dataset.accion === "activo") { const n = { ...c, activo: c.activo === false }; await FY.guardarCombo(n); Object.assign(c, n); pintarCombos(); toast(n.activo ? "Combo visible en la tienda" : "Combo oculto"); }
      else if (b.dataset.accion === "editar") abrirCombo(c);
      else if (b.dataset.accion === "duplicar") { const id = slug(c.nombre) + Date.now().toString(36).slice(-3); const n = { ...JSON.parse(JSON.stringify(c)), id, nombre: c.nombre + " (copia)", orden: (C.combos.length) }; await FY.guardarCombo(n); C.combos.push(n); pintarCombos(); toast("Combo duplicado"); }
      else if (b.dataset.accion === "borrar") { if (!await confirmar("¿Borrar combo?", `${c.nombre} desaparece de la tienda. Los productos no se tocan.`, "Borrar")) return; await FY.borrarCombo(c.id); C.combos = C.combos.filter(x => x.id !== c.id); pintarCombos(); toast("Combo borrado"); }
    } catch (er) { fallo(er); }
  });

  const opcionesProd = id => { const p = C.productos.find(x => x.id === id); return p && (p.opciones || []).length ? `<option value="">Elegir opción</option>` + p.opciones.map(o => `<option>${esc(o)}</option>`).join("") : ""; };
  function pintarItemsCombo() {
    $("#kcItems").innerHTML = kb.items.map((it, i) => `<li data-i="${i}">
      <select data-campo="id" aria-label="Producto">${C.productos.map(p => `<option value="${esc(p.id)}" ${p.id === it.id ? "selected" : ""}>${esc(p.nombre)} (${bs(p.precio)})</option>`).join("")}</select>
      <input type="number" data-campo="cant" min="1" max="99" value="${it.cant || 1}" aria-label="Cantidad">
      <select data-campo="op" aria-label="Opción" ${opcionesProd(it.id) ? "" : "hidden"}>${opcionesProd(it.id).replace(`<option>${esc(it.op)}</option>`, `<option selected>${esc(it.op)}</option>`)}</select>
      <button type="button" class="icono-btn icono-btn--peligro" data-quitar aria-label="Quitar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </li>`).join("");
    resumenCombo();
  }
  function resumenCombo() {
    const normal = precioNormal(kb.items), precio = +$("#kcPrecio").value || 0, ahorro = normal - precio;
    $("#kcResumen").innerHTML = `<span>Por separado: <b>${bs(normal)}</b></span>` + (precio ? (ahorro > 0 ? `<span class="tag-wa">El cliente ahorra ${bs(ahorro)} (${Math.round(ahorro / normal * 100)}%)</span>` : `<span class="marca-alerta">El combo no es más barato que comprar por separado</span>`) : "");
  }
  $("#kcItems").addEventListener("change", e => {
    const li = e.target.closest("li"); if (!li) return; const it = kb.items[+li.dataset.i], k = e.target.dataset.campo;
    if (k === "id") { it.id = e.target.value; it.op = ""; } else if (k === "cant") it.cant = Math.max(1, +e.target.value || 1); else it.op = e.target.value;
    pintarItemsCombo();
  });
  $("#kcItems").addEventListener("click", e => { const q = e.target.closest("[data-quitar]"); if (!q) return; kb.items.splice(+q.closest("li").dataset.i, 1); pintarItemsCombo(); });
  $("#kcAgregar").addEventListener("click", () => { kb.items.push({ id: C.productos[0]?.id, cant: 1, op: "" }); pintarItemsCombo(); });
  $("#kcPrecio").addEventListener("input", resumenCombo);
  function abrirCombo(c) {
    kb.editando = c || null;
    kb.items = c ? JSON.parse(JSON.stringify(c.items || [])) : [{ id: C.productos[0]?.id, cant: 1, op: "" }, { id: C.productos[1]?.id, cant: 1, op: "" }];
    $("#kcTitulo").textContent = c ? "Editar combo" : "Nuevo combo";
    $("#kcNombre").value = c?.nombre || ""; $("#kcDesc").value = c?.descripcion || ""; $("#kcPrecio").value = c?.precio || ""; $("#kcActivo").checked = c ? c.activo !== false : true;
    const n = numerosDe(C.tienda);
    $("#kcWa").innerHTML = n.map((x, i) => `<option value="${i === 0 ? "" : esc(x.numero)}">${i === 0 ? "Principal, " : ""}${esc(x.nombre)} (${esc(verNum(x.numero))})</option>`).join("");
    $("#kcWa").value = c?.wa || "";
    pintarItemsCombo(); $("#editorCombo").showModal(); $("#kcNombre").focus();
  }
  $("#nuevoCombo").addEventListener("click", () => abrirCombo(null));
  $("#kcCerrar").addEventListener("click", () => $("#editorCombo").close());
  $("#kcCancelar").addEventListener("click", () => $("#editorCombo").close());
  $("#kcForm").addEventListener("submit", async e => {
    e.preventDefault();
    const items = kb.items.filter(i => i.id);
    if (items.length < 2) return toast("Un combo necesita al menos 2 productos");
    const falta = items.find(i => opcionesProd(i.id) && !i.op);
    if (falta) return toast("Elige la opción (sabor) de cada producto que la tenga");
    const nombre = $("#kcNombre").value.trim(); if (!nombre) return;
    let id = kb.editando?.id;
    if (!id) { id = slug(nombre); let n = 2; while ((C.combos || []).some(c => c.id === id)) id = slug(nombre) + n++; }
    const cb = { id, nombre, descripcion: $("#kcDesc").value.trim(), precio: +$("#kcPrecio").value, activo: $("#kcActivo").checked, wa: $("#kcWa").value, items, fotos: kb.editando?.fotos || [], orden: kb.editando?.orden ?? (C.combos || []).length };
    try {
      await FY.guardarCombo(cb); C.combos = C.combos || [];
      const i = C.combos.findIndex(x => x.id === id); i >= 0 ? C.combos[i] = cb : C.combos.push(cb);
      $("#editorCombo").close(); pintarCombos(); toast(kb.editando ? "Combo guardado" : "Combo creado");
    } catch (er) { fallo(er); }
  });

  iniciar().catch(fallo);
})();
