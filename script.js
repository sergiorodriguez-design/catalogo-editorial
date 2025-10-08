document.addEventListener('DOMContentLoaded', () => {
  // Depuración: comprobar si el botón existe
  if (document.getElementById('categoriasCPBtn')) {
    console.log('Botón Categorías CP encontrado en el DOM');
  } else {
    console.warn('Botón Categorías CP NO encontrado en el DOM');
  }
  const categoriasCPBtn = document.getElementById('categoriasCPBtn');
  const cpContainer = document.getElementById('categoriasCP');
  // Mostrar/ocultar categorías CP al hacer clic en el botón
  if (categoriasCPBtn && cpContainer) {
    categoriasCPBtn.addEventListener('click', () => {
      cpContainer.style.display = (cpContainer.style.display === 'none' || !cpContainer.style.display) ? 'block' : 'none';
    });
    // Ocultar por defecto
    cpContainer.style.display = 'none';
  }
  // URL de la hoja principal
  const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQzTLQAi1kX_H_ZfonV0s6LHuaG7WoCNuudNSuDtR8Sqym96ItIb0NKScuCAccxlSWqSQh1LH7dUeg0/pub?gid=1407754531&single=true&output=csv";
  // URL de la nueva hoja "Hoja 1" con el gid correcto
  const CSV_URL_HOJA1 = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQzTLQAi1kX_H_ZfonV0s6LHuaG7WoCNuudNSuDtR8Sqym96ItIb0NKScuCAccxlSWqSQh1LH7dUeg0/pub?gid=111084286&single=true&output=csv";
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
  let hoja1Data = [];
  let mergedBooks = [];
  let filtered = [];
  let page = 0;
  let observer;
  let view = localStorage.getItem('catalog_view') || 'grid';
  let categoriasCP = {};

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
    // Leer hoja principal
    const res = await fetch(CSV_URL, { cache: 'no-cache' });
    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true }).data;
    allBooks = parsed
      .map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.trim(), (v || '').toString().trim()])))
      .filter(b => b['ISBN'] || b['isbn'] || b['titulo']);

    // Leer Hoja 1
    const resHoja1 = await fetch(CSV_URL_HOJA1, { cache: 'no-cache' });
    const csvHoja1 = await resHoja1.text();
    hoja1Data = Papa.parse(csvHoja1, { header: true }).data
      .map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.trim(), (v || '').toString().trim()])));

    // Función para normalizar ISBN
    function normalizeISBN(isbn) {
      return (isbn || '').replace(/[-\s]/g, '').toLowerCase();
    }

    // Cruce por ISBN normalizado
    const hoja1PorISBN = {};
    hoja1Data.forEach(row => {
      const isbn = row['ISBN'] || row['isbn'];
      if (isbn) hoja1PorISBN[normalizeISBN(isbn)] = row;
    });

    mergedBooks = allBooks.map(book => {
      const isbn = book['ISBN'] || book['isbn'];
      const norm = normalizeISBN(isbn);
      if (norm && hoja1PorISBN[norm]) {
        return { ...book, ...hoja1PorISBN[norm] };
      }
      return book;
    });
    filtered = [...mergedBooks];

    // Crear categorías por CP usando ISBN normalizado
    categoriasCP = {};
    hoja1Data.forEach(row => {
      const cp = row['CP'] || row['cp'];
      const isbn = row['ISBN'] || row['isbn'];
      if (cp && isbn) {
        const norm = normalizeISBN(isbn);
        if (!categoriasCP[cp]) categoriasCP[cp] = [];
        categoriasCP[cp].push(norm);
      }
    });

    renderFilters(mergedBooks);
    resetAndRender();
    setupInfiniteScroll();
    bindUI();
    renderCategoriasCP();
  }
  // Renderizar categorías por certificados de profesionalidad (CP)
  function renderCategoriasCP() {
    const cpContainer = document.getElementById('categoriasCP');
    if (!cpContainer) return;
    cpContainer.innerHTML = '';
    Object.keys(categoriasCP).forEach(cp => {
      const div = document.createElement('div');
      div.className = 'cp-categoria';
      div.innerHTML = `<h4>${cp}</h4><ul>${categoriasCP[cp].map(isbn => `<li>${isbn}</li>`).join('')}</ul>`;
      cpContainer.appendChild(div);
    });
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
