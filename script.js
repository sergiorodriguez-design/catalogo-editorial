document.addEventListener('DOMContentLoaded', () => {
  const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQzTLQAi1kX_H_ZfonV0s6LHuaG7WoCNuudNSuDtR8Sqym96ItIb0NKScuCAccxlSWqSQh1LH7dUeg0/pub?gid=1407754531&single=true&output=csv";
  const PAGE_SIZE = 24;

  const catalogo = document.getElementById("catalogo");
  const sentinel = document.getElementById("sentinel");
  const searchInput = document.getElementById("search");
  const idiomaFilter = document.getElementById("idiomaFilter");
  const anioFilter = document.getElementById("anioFilter");
  const themeToggle = document.getElementById("themeToggle");
  const viewToggle = document.getElementById("viewToggle");
  const modal = document.getElementById("modal");
  const closeModal = document.getElementById("closeModal");

  let allBooks = [];
  let filtered = [];
  let page = 0;
  let observer;
  let view = localStorage.getItem('catalog_view') || 'grid';

  // === Tema ===
  initTheme();
  function initTheme() {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (saved === "dark" || (!saved && prefersDark)) {
      document.documentElement.classList.add("dark");
      updateThemeIcon(true);
    } else {
      document.documentElement.classList.remove("dark");
      updateThemeIcon(false);
    }
  }

  themeToggle.addEventListener("click", () => {
    const isDark = document.documentElement.classList.toggle("dark");
    updateThemeIcon(isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });

  function updateThemeIcon(isDark) {
    themeToggle.textContent = isDark ? "🌞 Claro" : "🌜 Oscuro";
  }

  // === Vista (rejilla / lista) ===
  setView(view);
  viewToggle.addEventListener('click', () => {
    view = (view === 'grid') ? 'list' : 'grid';
    setView(view);
    localStorage.setItem('catalog_view', view);
  });

  function setView(v) {
    if (v === 'list') {
      catalogo.classList.add('list');
      viewToggle.textContent = "🔳 Rejilla";
    } else {
      catalogo.classList.remove('list');
      viewToggle.textContent = "🗂️ Lista";
    }
  }

  // === Cargar PapaParse y datos ===
  const papa = document.createElement('script');
  papa.src = "https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js";
  papa.onload = loadData;
  document.body.appendChild(papa);

  async function loadData() {
    const res = await fetch(CSV_URL, { cache: 'no-cache' });
    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true }).data;

    allBooks = parsed
      .map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.trim(), (v || '').toString().trim()])))
      .filter(b => b['titulo']);
    filtered = [...allBooks];

    renderFilters(allBooks);
    resetAndRender();
    setupInfiniteScroll();
    bindUI();
  }

  function renderFilters(books) {
    const idiomas = [...new Set(books.map(b => b['idioma']).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    idiomas.forEach(id => {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = id;
      idiomaFilter.appendChild(o);
    });

    const anios = [...new Set(books.map(b => b['año_public']).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
    anios.forEach(y => {
      const o = document.createElement('option');
      o.value = y;
      o.textContent = y;
      anioFilter.appendChild(o);
    });
  }

  function resetAndRender() {
    page = 0;
    catalogo.innerHTML = '';
    loadNextPage();
  }

  function loadNextPage() {
    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const slice = filtered.slice(start, end);
    appendCards(slice);
    page++;
    toggleSentinel();
  }

  function toggleSentinel() {
    sentinel.style.display = (page * PAGE_SIZE >= filtered.length) ? 'none' : 'flex';
  }

  function appendCards(books) {
    const frag = document.createDocumentFragment();
    books.forEach(b => {
      const card = document.createElement('article');
      card.className = 'card';
      const cover = b['imagen_cubierta'] || 'https://via.placeholder.com/400x550?text=Sin+imagen';
      const price = b['precio_venta_publico'] ? `€ ${b['precio_venta_publico']}` : '';
      card.innerHTML = `
        <img loading="lazy" src="${cover}" alt="${escapeHtml(b['titulo'])}">
        <div class="card-body">
          <h3>${escapeHtml(b['titulo'])}</h3>
          <p><strong>${escapeHtml(b['autor'] || '')}</strong></p>
          <p>${escapeHtml(b['editorial'] || '')}</p>
          <p class="price">${price}</p>
        </div>
      `;
      card.querySelector('img').addEventListener('error', e => {
        e.currentTarget.src = 'https://via.placeholder.com/400x550?text=Sin+imagen';
      });
      card.addEventListener('click', () => openModal(b));
      frag.appendChild(card);
    });
    catalogo.appendChild(frag);
  }

  function setupInfiniteScroll() {
    if (observer) observer.disconnect();
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && page * PAGE_SIZE < filtered.length) loadNextPage();
      }
    }, { rootMargin: '800px 0px' });
    observer.observe(sentinel);
  }

  function bindUI() {
    searchInput.addEventListener('input', applyFilters);
    idiomaFilter.addEventListener('change', applyFilters);
    anioFilter.addEventListener('change', applyFilters);

    closeModal.addEventListener('click', closeModalFn);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModalFn(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModalFn(); });
  }

  function applyFilters() {
    const q = (searchInput.value || '').toLowerCase();
    const idioma = idiomaFilter.value;
    const anio = anioFilter.value;
    filtered = allBooks.filter(b => {
      const text = `${(b['titulo'] || '').toLowerCase()} ${(b['autor'] || '').toLowerCase()}`;
      const okText = text.includes(q);
      const okIdioma = idioma ? b['idioma'] === idioma : true;
      const okAnio = anio ? b['año_public'] === anio : true;
      return okText && okIdioma && okAnio;
    });
    resetAndRender();
  }

  // === MODAL ===
  function openModal(b) {
    document.getElementById("modalImg").src = b['imagen_cubierta'] || 'https://via.placeholder.com/600x800?text=Sin+imagen';
    document.getElementById("modalTitulo").textContent = b['titulo'] || 'Sin título';
    document.getElementById("modalAutor").textContent = b['autor'] || '';
    document.getElementById("modalEditorial").textContent = b['editorial'] || '';
    document.getElementById("modalDescripcion").textContent = b['texto_resumen'] || 'Sin descripción disponible.';
    document.getElementById("modalPrecio").textContent = b['precio_venta_publico'] ? `Precio: € ${b['precio_venta_publico']}` : '';
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function closeModalFn() {
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
  }
});
