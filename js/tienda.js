(async () => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const bs = n => "Bs " + Number(n).toLocaleString("es-BO", { maximumFractionDigits: 2 });
  const plano = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const local = {
    leer(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
    guardar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  let C;
  try { C = await FY.cargar(); }
  catch (e) { C = JSON.parse(JSON.stringify(window.CATALOGO_INICIAL)); console.warn("No se pudo leer la base, usando catálogo local", e); }
  const T = C.tienda;
  // Combos: se agregan como productos virtuales de la categoría Combos
  const combosVirtuales = FY.armarCombos(C.productos, C.combos);
  if (combosVirtuales.length) {
    C.productos = [...combosVirtuales, ...C.productos];
    if (!C.categorias.some(c => c.id === "combos")) C.categorias = [{ id: "combos", nombre: "Combos", texto: "Llevá más y pagá menos", orden: -1 }, ...C.categorias];
  }
  FY.productos = C.productos;
  FY.iniciarGA((window.FITYA_CONFIG || {}).gaId || T.gaId);
  const visibles = () => C.productos;
  const prod = id => C.productos.find(p => p.id === id);
  const nombreCat = id => (C.categorias.find(c => c.id === id) || {}).nombre || "";

  // Registrar la visita una vez por sesión
  try { if (!sessionStorage.getItem("fityaVisita")) { FY.evento("visita", null, { desde: document.referrer ? new URL(document.referrer).hostname : "directo" }); sessionStorage.setItem("fityaVisita", "1"); } } catch (e) {}

  // Textos de la tienda
  const poner = (sel, txt) => { const el = $(sel); if (el && txt) el.textContent = txt; };
  if (T.aviso) { $("#aviso").textContent = T.aviso; $("#aviso").hidden = false; }
  poner("#titulo", T.titulo); poner("#subtitulo", T.subtitulo);
  poner("#textoMayoristas", T.mayoristas);
  poner("#pieCiudad", T.ciudad ? `Suplementos y accesorios deportivos en ${T.ciudad}.` : "");
  poner("#pieHorario", T.horario); poner("#pieEnvio", T.envio);
  poner("#piePagos", (T.pagos || []).join(", "));
  // Números de WhatsApp: el primero es el principal; cada producto puede usar otro
  const numeros = ((T.numeros || []).length ? T.numeros : [T.whatsapp, T.whatsapp2].filter(Boolean).map((n, i) => ({ nombre: i ? "Ventas 2" : "Ventas", numero: n }))).filter(n => n.numero);
  const principal = numeros[0]?.numero || T.whatsapp || "";
  const numeroDe = p => (p && p.wa) || principal;
  const nombreNumero = n => (numeros.find(x => x.numero === n) || {}).nombre || "";
  const numVisible = n => n ? "+" + n.replace(/^591/, "591 ").replace(/(\d{3})(\d{5})$/, "$1 $2") : "";
  $("#pieWa").innerHTML = numeros.map(n => `<a href="https://wa.me/${esc(n.numero)}" target="_blank" rel="noopener">${esc(numVisible(n.numero))}</a>${numeros.length > 1 && n.nombre ? ` <span class="tenue">${esc(n.nombre)}</span>` : ""}`).join("<br>");
  $("#pieRedes").innerHTML = [["Instagram", T.instagram], ["TikTok", T.tiktok], ["Facebook", T.facebook]].filter(r => r[1]).map(r => `<a href="${esc(r[1])}" target="_blank" rel="noopener">${r[0]}</a>`).join("");
  $("#anio").textContent = new Date().getFullYear();
  if (T.logo) $("#logo").innerHTML = `<img src="${esc(T.logo)}" alt="${esc(T.nombre || "FITYA")}">`;
  document.title = `${T.nombre || "FITYA"} | Suplementos y accesorios deportivos`;

  // WhatsApp
  const linkWa = (texto, num = principal) => `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
  const abrirWa = url => { const v = window.open(url, "_blank", "noopener"); if (!v) location.href = url; };
  const toast = (() => { let t; return msg => { const el = $("#toast"); el.textContent = msg; el.classList.add("visible"); clearTimeout(t); t = setTimeout(() => el.classList.remove("visible"), 2200); }; })();

  // Fotos: primero las cargadas desde el panel, luego img/productos/ID.jpg, si no, la presentación en grande
  const reemplazo = p => p.pres
    ? `<div class="sinfoto sinfoto--${esc(p.cat)}"><b>${esc(p.pres)}</b><span>${esc(nombreCat(p.cat))}</span></div>`
    : `<div class="sinfoto sinfoto--palabra sinfoto--${esc(p.cat)}"><b>${esc(p.nombre.split(" ")[0])}</b><span>${esc(nombreCat(p.cat))}</span></div>`;
  const foto = (p, i = 0) => {
    if (p.combo && (p.fotos || []).length > 1 && i === 0) return `<div class="collage collage--${p.fotos.length}">${p.fotos.map(f => `<img src="${esc(f)}" alt="" loading="lazy">`).join("")}</div>`;
    const src = (p.fotos || [])[i];
    return src ? `<img src="${esc(src)}" alt="${esc(p.nombre)}" loading="lazy" data-pid="${esc(p.id)}" data-local="no">`
      : `<img src="img/productos/${esc(p.id)}.jpg" alt="${esc(p.nombre)}" loading="lazy" data-pid="${esc(p.id)}" data-local="0">`;
  };
  const formatos = ["jpg"];
  document.addEventListener("error", e => {
    const img = e.target;
    if (img.tagName !== "IMG" || !img.dataset.pid) return;
    const p = prod(img.dataset.pid);
    if (img.dataset.local !== "no") {
      const i = Number(img.dataset.local) + 1;
      if (i < formatos.length) { img.dataset.local = i; img.src = `img/productos/${p.id}.${formatos[i]}`; return; }
    }
    img.outerHTML = reemplazo(p);
  }, true);

  const precioHTML = p => `${p.desde ? "<small>desde</small>" : ""}${bs(p.precio)}${p.antes ? `<s>${bs(p.antes)}</s>` : ""}`;
  const icoMas = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
  const tarjeta = p => `
    <article class="tarjeta${p.disponible === false ? " tarjeta--agotado" : ""}${p.combo ? " tarjeta--combo" : ""}">
      ${p.disponible === false ? `<span class="sello sello--gris">Sin stock</span>` : p.antes ? `<span class="sello">${Math.round((1 - p.precio / p.antes) * 100)}% menos</span>` : ""}
      <div class="tarjeta__foto">${foto(p)}</div>
      <div class="tarjeta__info">
        ${p.combo && p.ahorro ? `<span class="ahorro">Ahorrás ${bs(p.ahorro)}</span>` : ""}<span class="tarjeta__marca">${esc(p.marca || nombreCat(p.cat))}</span>
        <button class="tarjeta__nombre" data-ver="${esc(p.id)}">${esc(p.nombre)}</button>
        ${(p.opciones || []).length > 1 ? `<span class="tarjeta__opciones">${p.opciones.length} opciones</span>` : ""}
        <div class="tarjeta__pie">
          <span class="precio">${precioHTML(p)}</span>
          ${p.disponible === false ? "" : `<button class="sumar" data-sumar="${esc(p.id)}" aria-label="Agregar ${esc(p.nombre)} al pedido">${icoMas}<span>Agregar</span></button>`}
        </div>
      </div>
    </article>`;

  // Filtros
  const estado = { cat: "todo", texto: "", marca: "", orden: "" };
  const cuenta = id => id === "todo" ? visibles().length : id === "ofertas" ? visibles().filter(p => p.antes).length : visibles().filter(p => p.cat === id).length;
  const chips = [{ id: "todo", nombre: "Todo" }, ...C.categorias, { id: "ofertas", nombre: "Ofertas" }].filter(c => cuenta(c.id) > 0);
  $("#cats").innerHTML = chips.map(c => `<button role="tab" data-cat="${esc(c.id)}" aria-selected="${c.id === "todo"}">${esc(c.nombre)} <small>${cuenta(c.id)}</small></button>`).join("");
  const marcas = [...new Set(visibles().map(p => p.marca).filter(Boolean))].sort();
  $("#marca").innerHTML = `<option value="">Todas las marcas</option>` + marcas.map(m => `<option>${esc(m)}</option>`).join("");
  $("#marca").hidden = marcas.length < 2;

  const ofertas = visibles().filter(p => p.antes && p.disponible !== false);
  if (ofertas.length) { $("#ofertas").hidden = false; $("#carrilOfertas").innerHTML = ofertas.map(tarjeta).join(""); }

  // Franja de confianza
  const icono = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  $("#confianza").innerHTML = [
    [icono('<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'), "Delivery", T.ciudad ? `en ${T.ciudad}` : "a coordinar"],
    [icono('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>'), "Pagás como quieras", (T.pagos || []).slice(0, 3).join(", ") || "a coordinar"],
    [icono('<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20Z"/>'), "Te asesoramos", "por WhatsApp, sin compromiso"],
    [icono('<path d="M4 20V10M10 20V4M16 20v-7"/>'), "Precios por mayor", "para gyms y revendedores"]
  ].map(([i, t, s]) => `<li>${i}<span><b>${esc(t)}</b>${esc(s)}</span></li>`).join("");

  // Categorías como accesos grandes
  $("#objetivos").innerHTML = C.categorias.filter(c => cuenta(c.id) > 0).map(c => {
    const muestra = C.productos.find(p => p.cat === c.id && p.fotos?.length);
    return `<li><button class="objetivo objetivo--${esc(c.id)}" data-ir-cat="${esc(c.id)}">
      <span class="objetivo__texto"><b>${esc(c.nombre)}</b><span>${esc(c.texto || "")}</span></span>
      <span class="objetivo__pie"><small>${cuenta(c.id)} productos</small>${muestra ? `<img src="${esc(muestra.fotos[0])}" alt="" loading="lazy">` : ""}</span>
    </button></li>`;
  }).join("");

  const elegirCat = id => { estado.cat = id; $$("#cats button").forEach(b => b.setAttribute("aria-selected", b.dataset.cat === id)); pintar(); };
  $("#cats").addEventListener("click", e => { const b = e.target.closest("button"); if (b) elegirCat(b.dataset.cat); });
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-ir-cat]"); if (!b) return;
    elegirCat(b.dataset.irCat); $("#catalogo").scrollIntoView({ behavior: "smooth" });
  });
  let tBusca;
  $("#buscar").addEventListener("input", e => {
    estado.texto = plano(e.target.value.trim());
    if (estado.texto && estado.cat !== "todo") elegirCat("todo"); else pintar();
    if (estado.texto && window.scrollY < $("#catalogo").offsetTop - 200) $("#catalogo").scrollIntoView({ behavior: "smooth" });
    clearTimeout(tBusca);
    tBusca = setTimeout(() => { if (estado.texto.length >= 3) FY.evento("buscar", null, { texto: estado.texto, resultados: filtrar().length }); }, 1200);
  });
  $("#marca").addEventListener("change", e => { estado.marca = e.target.value; pintar(); });
  $("#orden").addEventListener("change", e => { estado.orden = e.target.value; pintar(); });

  function filtrar() {
    const palabras = estado.texto.split(/\s+/).filter(Boolean);
    let l = visibles().filter(p => {
      if (estado.cat === "ofertas" && !p.antes) return false;
      if (!["todo", "ofertas"].includes(estado.cat) && p.cat !== estado.cat) return false;
      if (estado.marca && p.marca !== estado.marca) return false;
      const base = plano([p.nombre, p.marca, nombreCat(p.cat), p.pres, ...(p.opciones || [])].join(" "));
      return palabras.every(w => base.includes(w));
    });
    const o = estado.orden;
    if (o === "menor") l.sort((a, b) => a.precio - b.precio);
    else if (o === "mayor") l.sort((a, b) => b.precio - a.precio);
    else if (o === "az") l.sort((a, b) => a.nombre.localeCompare(b.nombre));
    else l.sort((a, b) => (a.disponible === false) - (b.disponible === false) || (estado.cat === "todo" ? (b.destacado ? 1 : 0) - (a.destacado ? 1 : 0) : 0));
    return l;
  }
  function pintar() {
    const l = filtrar();
    $("#grilla").innerHTML = l.map(tarjeta).join("");
    $("#vacio").hidden = l.length > 0;
    $("#resultado").textContent = l.length === 1 ? "1 producto" : `${l.length} productos`;
  }
  $("#pedirRaro").addEventListener("click", () => {
    FY.evento("consulta", null, { texto: estado.texto });
    abrirWa(linkWa(`Hola FITYA, ¿tienen ${$("#buscar").value.trim() || "este producto"}?`));
  });

  // Clics en tarjetas (grilla, ofertas y relacionados)
  document.addEventListener("click", e => {
    const ver = e.target.closest("[data-ver]");
    const sumar = e.target.closest("[data-sumar]");
    if (sumar) {
      const p = prod(sumar.dataset.sumar);
      if ((p.opciones || []).length) return abrirDetalle(p.id);
      agregar(p, 1, "", sumar);
      sumar.classList.add("ok"); sumar.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg><span>Listo</span>`;
      setTimeout(() => { sumar.classList.remove("ok"); sumar.innerHTML = icoMas + "<span>Agregar</span>"; }, 1100);
      return;
    }
    if (ver) abrirDetalle(ver.dataset.ver);
  });
  // Toda la tarjeta abre el detalle
  document.addEventListener("click", e => {
    const t = e.target.closest(".tarjeta");
    if (t && !e.target.closest("button")) $("[data-ver]", t)?.click();
  });

  // Detalle de producto
  const dlg = $("#detalle");
  let actual = null, cant = 1, opcion = "";
  function abrirDetalle(id, desdeHash = false) {
    const p = prod(id); if (!p) return;
    actual = p; cant = 1; opcion = "";
    const fotos = p.fotos || [];
    $("#dFoto").innerHTML = foto(p, 0);
    $("#dMinis").innerHTML = fotos.length > 1 ? fotos.map((f, i) => `<button data-foto="${i}" aria-current="${i === 0}" aria-label="Foto ${i + 1}"><img src="${esc(f)}" alt=""></button>`).join("") : "";
    $("#dMarca").textContent = [p.marca, nombreCat(p.cat)].filter(Boolean).join(", ");
    $("#dNombre").textContent = p.nombre;
    $("#dPrecio").innerHTML = precioHTML(p);
    $("#dDesc").textContent = p.descripcion || ""; $("#dDesc").hidden = !p.descripcion;
    $("#dPuntos").innerHTML = (p.puntos || []).map(t => `<li>${esc(t)}</li>`).join("");
    const ops = p.opciones || [];
    $("#dOpciones").hidden = !ops.length; $("#dOpciones").classList.remove("falta"); $("#dOpcionError").hidden = true;
    $("#dOpcionesLista").innerHTML = `<div class="segmentos">${ops.map(o => `<label><input type="radio" name="opcion" value="${esc(o)}"><span>${esc(o)}</span></label>`).join("")}</div>`;
    if (ops.length === 1) { opcion = ops[0]; $("#dOpcionesLista input").checked = true; }
    $("#dCant").textContent = cant;
    const agotado = p.disponible === false;
    $(".comprar").hidden = agotado; $("#dAgotado").hidden = !agotado;
    $("#dAhora").lastChild.textContent = agotado ? " Avisame cuando llegue" : " Comprar ahora por WhatsApp";
    const rel = C.productos.filter(x => x.cat === p.cat && x.id !== p.id && x.disponible !== false).slice(0, 3);
    $("#dRelacionados").innerHTML = rel.length ? `<h3>También te puede servir</h3><ul>${rel.map(r => `<li><button data-ver="${esc(r.id)}"><span class="mini">${foto(r)}</span><span><strong>${esc(r.nombre)}</strong><span class="tenue">${bs(r.precio)}</span></span></button></li>`).join("")}</ul>` : "";
    if (!dlg.open) dlg.showModal();
    $(".detalle__info").scrollTop = 0;
    if (!desdeHash) history.replaceState(null, "", "#" + p.id);
    FY.evento("vista", p.id);
  }
  const cerrarDetalle = () => { dlg.close(); };
  dlg.addEventListener("close", () => { if (location.hash) history.replaceState(null, "", location.pathname + location.search); });
  dlg.addEventListener("click", e => {
    if (e.target === dlg || e.target.closest("[data-cerrar]")) return cerrarDetalle();
    if (e.target.closest("[data-mas]")) cant = Math.min(99, cant + 1);
    if (e.target.closest("[data-menos]")) cant = Math.max(1, cant - 1);
    $("#dCant").textContent = cant;
    const mini = e.target.closest("[data-foto]");
    if (mini) { $("#dFoto").innerHTML = foto(actual, +mini.dataset.foto); $$("#dMinis button").forEach(b => b.setAttribute("aria-current", b === mini)); }
  });
  $("#dOpcionesLista").addEventListener("change", e => { opcion = e.target.value; $("#dOpciones").classList.remove("falta"); $("#dOpcionError").hidden = true; });
  const faltaOpcion = () => {
    if ((actual.opciones || []).length && !opcion) { $("#dOpciones").classList.add("falta"); $("#dOpcionError").hidden = false; $("#dOpciones").scrollIntoView({ block: "center", behavior: "smooth" }); return true; }
    return false;
  };
  $("#dAgregar").addEventListener("click", () => {
    if (faltaOpcion()) return;
    agregar(actual, cant, opcion, $("#dAgregar")); cerrarDetalle();
  });
  $("#dAhora").addEventListener("click", () => {
    const p = actual;
    if (p.disponible === false) {
      FY.evento("consulta", p.id, { motivo: "sin stock" });
      return abrirWa(linkWa(`Hola FITYA, avisame cuando llegue ${p.nombre}.`, numeroDe(p)));
    }
    if (faltaOpcion()) return;
    FY.evento("consulta", p.id, { motivo: "comprar ahora", cantidad: cant, numero: numeroDe(p) });
    abrirWa(linkWa(`Hola FITYA, quiero comprar:\n\n${cant} x ${p.nombre}${opcion ? " (" + opcion + ")" : ""}: ${bs(p.precio * cant)}\n\n¿Está disponible?`, numeroDe(p)));
  });

  // Abrir producto si el link trae #id (para compartir productos)
  const desdeHash = () => { const id = decodeURIComponent(location.hash.slice(1)); if (prod(id)) abrirDetalle(id, true); };
  window.addEventListener("hashchange", desdeHash);

  // Pedido
  let pedido = local.leer("fityaPedido", []).filter(l => prod(l.id));
  const guardarPedido = () => local.guardar("fityaPedido", pedido);
  const totalPedido = () => pedido.reduce((s, l) => s + prod(l.id).precio * l.cant, 0);
  const unidades = () => pedido.reduce((s, l) => s + l.cant, 0);

  const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function volar(desde) {
    if (!desde || sinMovimiento) return;
    const destino = window.innerWidth <= 760 && !$("#barraMovil").hidden ? $("#barraMovil") : $("#abrirPedido");
    const a = desde.getBoundingClientRect(), b = destino.getBoundingClientRect();
    const punto = document.createElement("span"); punto.className = "vuelo";
    punto.style.left = a.left + a.width / 2 + "px"; punto.style.top = a.top + a.height / 2 + "px";
    document.body.appendChild(punto);
    punto.animate([
      { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
      { transform: `translate(calc(-50% + ${(b.left + b.width / 2) - (a.left + a.width / 2)}px), calc(-50% + ${(b.top + b.height / 2) - (a.top + a.height / 2)}px)) scale(.4)`, opacity: .6 }
    ], { duration: 550, easing: "cubic-bezier(.5, -.2, .7, 1)" }).onfinish = () => punto.remove();
  }
  function agregar(p, n, op, desde) {
    volar(desde);
    const l = pedido.find(x => x.id === p.id && x.op === op);
    if (l) l.cant += n; else pedido.push({ id: p.id, cant: n, op });
    guardarPedido(); pintarPedido();
    FY.evento("agregar", p.id, { cantidad: n, opcion: op });
    toast(`Agregaste ${p.nombre}`);
    const b = $("#abrirPedido"); b.classList.remove("salto"); void b.offsetWidth; b.classList.add("salto");
  }

  // Agrupa el pedido según el número de WhatsApp de cada producto
  const grupos = () => {
    const g = new Map();
    pedido.forEach((l, i) => { const n = numeroDe(prod(l.id)); if (!g.has(n)) g.set(n, []); g.get(n).push({ ...l, i }); });
    const orden = n => { const i = numeros.findIndex(x => x.numero === n); return i < 0 ? 99 : i; };
    return [...g].sort((x, y) => orden(x[0]) - orden(y[0])).map(([numero, lineas]) => ({ numero, nombre: nombreNumero(numero), lineas, total: lineas.reduce((s, l) => s + prod(l.id).precio * l.cant, 0) }));
  };
  let enviados = new Set();
  const lineaHTML = l => {
    const p = prod(l.id);
    return `<li>
        <span class="mini">${foto(p)}</span>
        <span class="nombre">${esc(p.nombre)}<small>${l.op ? esc(l.op) + ", " : ""}${bs(p.precio)} c/u</small></span>
        <span class="importe">${bs(p.precio * l.cant)}</span>
        <span class="controles">
          <span class="cantidad"><button data-l="${l.i}" data-d="-1" aria-label="Una menos">−</button><output>${l.cant}</output><button data-l="${l.i}" data-d="1" aria-label="Una más">+</button></span>
          <button class="quitar" data-q="${l.i}">Quitar</button>
        </span>
      </li>`;
  };
  const icoWa = `<svg viewBox="0 0 24 24" aria-hidden="true" class="icono-wa"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Z"/></svg>`;

  function pintarPedido() {
    const u = unidades(), t = totalPedido();
    const G = grupos();
    enviados = new Set([...enviados].filter(n => G.some(g => g.numero === n)));
    $("#contador").textContent = u;
    $("#abrirPedido").setAttribute("aria-label", u ? `Abrir tu pedido, ${u} ${u === 1 ? "producto" : "productos"}` : "Abrir tu pedido");
    $("#total").textContent = bs(t);
    const hay = pedido.length > 0;
    $("#pedidoVacio").hidden = hay; $("#formPedido").hidden = !hay; $("#pedidoPie").hidden = !hay;
    $("#barraMovil").hidden = !hay; document.body.classList.toggle("con-pedido", hay);
    $("#barraMovilTexto").textContent = `${u} ${u === 1 ? "producto" : "productos"}, ${bs(t)}`;
    $("#lineas").innerHTML = G.length > 1
      ? G.map((g, k) => `<li class="grupo"><b>Parte ${k + 1}</b> se envía a ${esc(g.nombre || numVisible(g.numero))}</li>${g.lineas.map(lineaHTML).join("")}`).join("")
      : pedido.map((l, i) => lineaHTML({ ...l, i })).join("");
    $("#envios").innerHTML = G.length > 1
      ? `<p class="aviso-envios">Estos productos los atienden ${G.length} números distintos. Enviá cada parte a su WhatsApp:</p>` + G.map((g, k) => {
          const listo = enviados.has(g.numero);
          return `<button class="btn btn--ancho ${listo ? "btn--linea" : "btn--wa"}" data-enviar="${k}">${listo ? "Enviada, abrir de nuevo" : `${icoWa} Enviar parte ${k + 1} a ${esc(g.nombre || numVisible(g.numero))}`}<span class="envio__monto">${bs(g.total)}</span></button>`;
        }).join("")
      : `<button class="btn btn--wa btn--ancho btn--grande" data-enviar="0">${icoWa} Enviar pedido por WhatsApp</button>`;
    pintarChat();
  }
  $("#lineas").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.q !== undefined) pedido.splice(+b.dataset.q, 1);
    if (b.dataset.d) { const l = pedido[+b.dataset.l]; l.cant += +b.dataset.d; if (l.cant < 1) pedido.splice(+b.dataset.l, 1); }
    guardarPedido(); pintarPedido();
  });

  // Formulario de entrega
  const cliente = local.leer("fityaCliente", {});
  $("#cPago").innerHTML = (T.pagos || ["QR", "Efectivo"]).map((p, i) => `<label><input type="radio" name="pago" value="${esc(p)}" ${(cliente.pago ? cliente.pago === p : i === 0) ? "checked" : ""}><span>${esc(p)}</span></label>`).join("");
  $("#cNombre").value = cliente.nombre || ""; $("#cZona").value = cliente.zona || "";
  if (cliente.entrega === "recojo") $("#cEntrega input[value=recojo]").checked = true;
  const entrega = () => $("#cEntrega input:checked").value;
  const zonaVisible = () => { $("#campoZona").hidden = entrega() === "recojo"; };
  $("#cEntrega").addEventListener("change", zonaVisible); zonaVisible();

  function mensaje(g) {
    const lineas = g.lineas.map(l => { const p = prod(l.id); return `${l.cant} x ${p.nombre}${l.op ? " (" + l.op + ")" : ""}: ${bs(p.precio * l.cant)}${p.combo ? "\n   Incluye: " + p.puntos.join(" + ") : ""}`; });
    const datos = [
      `*Nombre:* ${$("#cNombre").value.trim()}`,
      entrega() === "recojo" ? `*Entrega:* paso a recoger` : `*Entrega:* delivery a ${$("#cZona").value.trim()}`,
      `*Pago:* ${$("#cPago input:checked")?.value || "a coordinar"}`,
      $("#cNota").value.trim() ? `*Nota:* ${$("#cNota").value.trim()}` : null
    ].filter(Boolean);
    return [`Hola FITYA, quiero hacer este pedido:`, ``, ...lineas, ``, `*Total: ${bs(g.total)}*`, ``, ...datos].join("\n");
  }

  $("#envios").addEventListener("click", e => {
    const b = e.target.closest("[data-enviar]"); if (!b) return;
    const G = grupos(), g = G[+b.dataset.enviar];
    const err = $("#formError"); err.hidden = true;
    $$(".campo--error").forEach(c => c.classList.remove("campo--error"));
    const faltan = [];
    if (!$("#cNombre").value.trim()) faltan.push($("#cNombre"));
    if (entrega() === "delivery" && !$("#cZona").value.trim()) faltan.push($("#cZona"));
    if (faltan.length) {
      faltan.forEach(i => i.closest(".campo").classList.add("campo--error"));
      err.textContent = faltan.length > 1 ? "Completá tu nombre y la zona de entrega" : faltan[0].id === "cNombre" ? "Escribí tu nombre" : "Escribí la zona o dirección de entrega";
      err.hidden = false; faltan[0].focus(); faltan[0].scrollIntoView({ block: "center", behavior: "smooth" }); return;
    }
    local.guardar("fityaCliente", { nombre: $("#cNombre").value.trim(), zona: $("#cZona").value.trim(), entrega: entrega(), pago: $("#cPago input:checked")?.value });
    const url = linkWa(mensaje(g), g.numero);
    if (!enviados.has(g.numero)) FY.evento("pedido", null, { items: g.lineas.map(l => ({ id: l.id, cantidad: l.cant, precio: prod(l.id).precio, opcion: l.op })), total: g.total, numero: g.numero, entrega: entrega(), pago: $("#cPago input:checked")?.value });
    enviados.add(g.numero);
    abrirWa(url);
    if (G.length === 1) { $("#reabrir").href = url; $("#reabrir").hidden = false; $("#enviado").hidden = false; }
    else if (G.every(x => enviados.has(x.numero))) { $("#reabrir").hidden = true; $("#enviado").hidden = false; }
    else pintarPedido();
  });
  $("#vaciar").addEventListener("click", () => { pedido = []; enviados = new Set(); guardarPedido(); pintarPedido(); $("#enviado").hidden = true; $("#cNota").value = ""; cerrarPedido(); });

  const panel = $("#pedido");
  let focoPrevio = null;
  const fondoInerte = v => $$("header.cabecera, main, footer.pie, #barraMovil, .saltar").forEach(el => { v ? el.setAttribute("inert", "") : el.removeAttribute("inert"); });
  const abrirPedido = () => { focoPrevio = document.activeElement; fondoInerte(true); panel.classList.add("abierto"); panel.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; setTimeout(() => $(".pedido__panel button, .pedido__panel input")?.focus({ preventScroll: true }), 50); };
  const cerrarPedido = () => { fondoInerte(false); panel.classList.remove("abierto"); panel.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; if (focoPrevio && document.contains(focoPrevio)) focoPrevio.focus({ preventScroll: true }); };
  $("#abrirPedido").addEventListener("click", abrirPedido);
  $("#barraMovil").addEventListener("click", abrirPedido);
  panel.addEventListener("click", e => { if (e.target.closest("[data-cerrar-pedido]")) cerrarPedido(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && panel.classList.contains("abierto")) cerrarPedido(); });

  // Consultas sueltas (mayoristas)
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-consulta]"); if (!b) return;
    FY.evento("consulta", null, { motivo: b.dataset.consulta });
    abrirWa(linkWa(b.dataset.consulta));
  });

  // Vista del chat en la portada: muestra el pedido real o un ejemplo
  function pintarChat() {
    let txt;
    if (pedido.length) {
      txt = `Hola FITYA, quiero hacer este pedido:\n\n` + pedido.slice(0, 4).map(l => `${l.cant} x ${prod(l.id).nombre}${l.op ? " (" + l.op + ")" : ""}`).join("\n") + (pedido.length > 4 ? `\ny ${pedido.length - 4} más` : "") + `\n\nTotal: ${bs(totalPedido())}`;
      $("#chatEstado").textContent = "así va a llegar tu pedido";
    } else {
      const ej = C.productos.filter(p => p.destacado && p.disponible !== false).slice(0, 2);
      txt = `Hola FITYA, quiero hacer este pedido:\n\n` + ej.map(p => `1 x ${p.nombre}`).join("\n") + `\n\nTotal: ${bs(ej.reduce((s, p) => s + p.precio, 0))}\nEntrega: delivery a Equipetrol`;
      $("#chatEstado").textContent = "en línea";
    }
    $("#chatGlobo").textContent = txt;
  }

  pintar();
  pintarPedido();
  desdeHash();
})();
