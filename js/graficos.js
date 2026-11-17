// Gráficos simples en SVG, sin librerías.
window.G = (() => {
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const num = n => Number(n).toLocaleString("es-BO", { maximumFractionDigits: 1 });
  const COLOR = "#4104a0", REJILLA = "#ece9f3", TEXTO = "#6a6380";

  // Escala "linda" para el eje Y
  function techo(max) {
    if (max <= 4) return 4;
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    const n = max / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }

  function base(el, datos, alto) {
    el.innerHTML = "";
    if (!datos.length || datos.every(d => !d.y)) { el.innerHTML = `<p class="vacio-grafico">Sin datos en este periodo</p>`; return null; }
    const ancho = Math.max(280, el.clientWidth || 600);
    const m = { t: 12, r: 8, b: 28, l: 36 };
    const w = ancho - m.l - m.r, h = alto - m.t - m.b;
    const maxY = techo(Math.max(...datos.map(d => d.y)));
    const y = v => m.t + h - (v / maxY) * h;
    const lineasY = [0, .25, .5, .75, 1].map(f => f * maxY);
    const cadaX = Math.max(1, Math.ceil(datos.length / Math.floor(w / 64)));
    let svg = `<svg viewBox="0 0 ${ancho} ${alto}" role="img">`;
    svg += lineasY.map(v => `<line x1="${m.l}" x2="${ancho - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? "#d6d2e0" : REJILLA}"/><text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end" font-size="12" fill="${TEXTO}">${num(v)}</text>`).join("");
    return { ancho, alto, m, w, h, y, cadaX, svg };
  }

  function tooltip(el) {
    const tip = document.createElement("div"); tip.className = "tip"; el.appendChild(tip);
    return {
      mostrar(x, yPx, html) { tip.innerHTML = html; tip.style.left = x + "px"; tip.style.top = yPx + "px"; tip.classList.add("visible"); },
      ocultar() { tip.classList.remove("visible"); }
    };
  }

  // Línea con área suave, para tendencias por día
  function linea(el, datos, { unidad = "", alto = 240 } = {}) {
    const b = base(el, datos, alto); if (!b) return;
    const { m, w, y, cadaX } = b;
    const paso = datos.length > 1 ? w / (datos.length - 1) : 0;
    const x = i => m.l + (datos.length > 1 ? i * paso : w / 2);
    const pts = datos.map((d, i) => `${x(i)},${y(d.y)}`).join(" ");
    let svg = b.svg;
    svg += `<polygon points="${x(0)},${y(0)} ${pts} ${x(datos.length - 1)},${y(0)}" fill="${COLOR}" opacity=".08"/>`;
    svg += `<polyline points="${pts}" fill="none" stroke="${COLOR}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    svg += datos.map((d, i) => i % cadaX === 0 ? `<text x="${x(i)}" y="${b.alto - 8}" text-anchor="middle" font-size="12" fill="${TEXTO}">${esc(d.x)}</text>` : "").join("");
    svg += `<line class="cruz" x1="0" x2="0" y1="${m.t}" y2="${y(0)}" stroke="#1a1426" stroke-width="1" opacity="0"/>`;
    svg += `<circle class="punto" r="5" fill="${COLOR}" stroke="#fff" stroke-width="2" opacity="0"/>`;
    svg += `<rect x="${m.l}" y="${m.t}" width="${w}" height="${b.h}" fill="transparent" class="zona"/></svg>`;
    el.insertAdjacentHTML("beforeend", svg);
    const s = el.querySelector("svg"), cruz = s.querySelector(".cruz"), punto = s.querySelector(".punto"), t = tooltip(el);
    const mover = ev => {
      const r = s.getBoundingClientRect(), k = b.ancho / r.width;
      const px = (ev.clientX - r.left) * k;
      const i = Math.max(0, Math.min(datos.length - 1, Math.round((px - m.l) / (paso || 1))));
      const d = datos[i];
      cruz.setAttribute("x1", x(i)); cruz.setAttribute("x2", x(i)); cruz.setAttribute("opacity", ".25");
      punto.setAttribute("cx", x(i)); punto.setAttribute("cy", y(d.y)); punto.setAttribute("opacity", "1");
      t.mostrar(x(i) / k, y(d.y) / k, `<b>${num(d.y)}${unidad}</b>${esc(d.etiqueta || d.x)}`);
    };
    s.querySelector(".zona").addEventListener("pointermove", mover);
    s.querySelector(".zona").addEventListener("pointerleave", () => { t.ocultar(); cruz.setAttribute("opacity", "0"); punto.setAttribute("opacity", "0"); });
  }

  // Columnas, para cantidades por día
  function columnas(el, datos, { unidad = "", alto = 220 } = {}) {
    const b = base(el, datos, alto); if (!b) return;
    const { m, w, y, cadaX } = b;
    const paso = w / datos.length, ancho = Math.max(2, Math.min(28, paso - 2));
    let svg = b.svg;
    svg += datos.map((d, i) => {
      const cx = m.l + paso * i + paso / 2, alto2 = y(0) - y(d.y);
      const barra = d.y ? `<path d="M${cx - ancho / 2},${y(0)} V${y(d.y) + Math.min(4, alto2)} q0,-${Math.min(4, alto2)} ${Math.min(4, ancho / 2)},-${Math.min(4, alto2)} H${cx + ancho / 2 - Math.min(4, ancho / 2)} q${Math.min(4, ancho / 2)},0 ${Math.min(4, ancho / 2)},${Math.min(4, alto2)} V${y(0)} Z" fill="${COLOR}"/>` : "";
      const etq = i % cadaX === 0 ? `<text x="${cx}" y="${b.alto - 8}" text-anchor="middle" font-size="12" fill="${TEXTO}">${esc(d.x)}</text>` : "";
      return `${barra}${etq}<rect x="${m.l + paso * i}" y="${m.t}" width="${paso}" height="${b.h}" fill="transparent" data-i="${i}"/>`;
    }).join("");
    svg += `</svg>`;
    el.insertAdjacentHTML("beforeend", svg);
    const s = el.querySelector("svg"), t = tooltip(el);
    s.addEventListener("pointermove", ev => {
      const i = ev.target.dataset?.i; if (i === undefined) return t.ocultar();
      const d = datos[+i], k = b.ancho / s.getBoundingClientRect().width;
      t.mostrar((m.l + paso * i + paso / 2) / k, y(d.y) / k, `<b>${num(d.y)}${unidad}</b>${esc(d.etiqueta || d.x)}`);
    });
    s.addEventListener("pointerleave", () => t.ocultar());
  }

  // Barras horizontales en HTML: nombre, valor y una pista proporcional
  function barras(el, filas, { max, vacio = "Sin datos en este periodo" } = {}) {
    if (!filas.length) { el.innerHTML = `<p class="vacio-grafico">${esc(vacio)}</p>`; return; }
    const tope = max || Math.max(...filas.map(f => f.valor)) || 1;
    el.innerHTML = `<div class="barras">${filas.map(f => `
      <div class="barra${f.alerta ? " barra--alerta" : ""}">
        <span class="barra__nombre">${esc(f.nombre)}${f.alerta ? `<span class="marca-alerta">${esc(f.alerta)}</span>` : ""}</span>
        <span class="barra__valor">${num(f.valor)}${f.extra ? `<small>${esc(f.extra)}</small>` : ""}</span>
        <span class="barra__pista"><span class="barra__relleno" style="width:${Math.max(1, (f.valor / tope) * 100)}%"></span></span>
      </div>`).join("")}</div>`;
  }

  return { linea, columnas, barras, num };
})();
