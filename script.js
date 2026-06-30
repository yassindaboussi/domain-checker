// script.js
(function () {

  /* ——— Elements ——— */
  const domainInput    = document.getElementById('domainInput');
  const checkBtn       = document.getElementById('checkBtn');
  const resultBox      = document.getElementById('resultBox');
  const resultIcon     = resultBox.querySelector('.result-content i');
  const resultDomain   = resultBox.querySelector('.result-domain');
  const resultSub      = document.getElementById('resultSub');

  const bulkInput      = document.getElementById('bulkInput');
  const bulkCheckBtn   = document.getElementById('bulkCheckBtn');
  const bulkResults    = document.getElementById('bulkResults');

  const singleWrap     = document.getElementById('singleInputWrap');
  const bulkWrap       = document.getElementById('bulkInputWrap');

  const modeSingle     = document.getElementById('modeSingle');
  const modeBulk       = document.getElementById('modeBulk');

  let currentMode = 'single';

  /* ——— Mode toggle ——— */
  modeSingle.addEventListener('click', () => {
    currentMode = 'single';
    modeSingle.classList.add('active');    modeSingle.classList.remove('inactive');
    modeBulk.classList.add('inactive');    modeBulk.classList.remove('active');
    singleWrap.style.display = '';
    bulkWrap.style.display   = 'none';
    resultBox.style.display  = '';
    bulkResults.style.display = 'none';
    domainInput.focus();
  });

  modeBulk.addEventListener('click', () => {
    currentMode = 'bulk';
    modeBulk.classList.add('active');    modeBulk.classList.remove('inactive');
    modeSingle.classList.add('inactive');modeSingle.classList.remove('active');
    singleWrap.style.display  = 'none';
    bulkWrap.style.display    = '';
    resultBox.style.display   = 'none';
    bulkResults.style.display = 'none';
    bulkInput.focus();
  });

  /* ——— RDAP helpers ——— */
  function getRdapUrl(domain) {
    // Use ICANN bootstrap for proper TLD routing via a CORS-friendly approach
    // Fallback: always try rdap.org which supports all TLDs
    return `https://rdap.org/domain/${encodeURIComponent(domain)}`;
  }

  /* ——— Single mode ——— */
  function setSingle(extraClass, iconClass, mainText, subText) {
    resultBox.classList.remove('available','taken','error','network','empty','loading');
    resultBox.classList.add(extraClass);
    resultIcon.className = iconClass;
    resultDomain.textContent = mainText;
    resultSub.textContent    = subText || '';
  }

  function setLoading() {
    resultBox.classList.remove('available','taken','error','network','empty');
    resultBox.classList.add('loading');
    resultIcon.className = 'fas fa-spinner';
    resultDomain.textContent = 'checking…';
    resultSub.textContent    = 'querying RDAP registry';
  }

  async function checkDomain() {
    const raw = domainInput.value.trim();
    if (!raw) {
      setSingle('empty','fas fa-circle-info','enter a domain','e.g. example.com');
      return;
    }
    if (!raw.includes('.') || raw.startsWith('.') || raw.endsWith('.')) {
      setSingle('error','fas fa-triangle-exclamation','invalid format','include a TLD (e.g. example.com)');
      return;
    }

    const domain = raw.toLowerCase();
    setLoading();

    try {
      const res = await fetch(getRdapUrl(domain), { headers: { Accept: 'application/json' } });
      if (res.status === 200)
        setSingle('taken','fas fa-circle-xmark',`${domain} · taken`,'registered in the domain registry');
      else if (res.status === 404)
        setSingle('available','fas fa-circle-check',`${domain} · available`,'you can register this domain');
      else if (res.status === 429)
        setSingle('error','fas fa-clock','rate limit','too many requests — please wait');
      else
        setSingle('error','fas fa-bug',`error ${res.status}`,'RDAP service returned an error');
    } catch {
      setSingle('network','fas fa-wifi-slash','network error','check your internet connection');
    }
  }

  checkBtn.addEventListener('click', checkDomain);
  domainInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); checkDomain(); } });

  /* ——— Bulk mode ——— */

  function parseDomains(raw) {
    return raw.split(',')
      .map(d => d.trim().toLowerCase())
      .filter(d => d.length > 0);
  }

  function isValidDomain(d) {
    return d.includes('.') && !d.startsWith('.') && !d.endsWith('.');
  }

  function createRow(domain) {
    const row = document.createElement('div');
    row.className = 'bulk-row loading';
    row.id = `row-${CSS.escape(domain)}`;
    row.innerHTML = `
      <i class="fas fa-spinner bulk-row-icon"></i>
      <span class="bulk-row-name">${domain}</span>
      <span class="bulk-row-status">checking…</span>`;
    return row;
  }

  function updateRow(row, status, iconClass, statusText) {
    row.className = `bulk-row ${status}`;
    row.querySelector('.bulk-row-icon').className = `${iconClass} bulk-row-icon`;
    row.querySelector('.bulk-row-status').textContent = statusText;
  }

  // Track all results for filtering + export
  let bulkResultsData = []; // { domain, status }
  let activeFilter = 'all';

  function updateSummary(counts) {
    const summary = document.getElementById('bulkSummary');
    if (!summary) return;
    summary.innerHTML = `
      <button class="bulk-filter-btn ${activeFilter==='all'?'active':''}" data-filter="all">
        All <span>${counts.available + counts.taken + counts.error + counts.pending}</span>
      </button>
      <button class="bulk-filter-btn avail ${activeFilter==='available'?'active':''}" data-filter="available">
        <i class="fas fa-circle-check"></i> Available <span>${counts.available}</span>
      </button>
      <button class="bulk-filter-btn taken ${activeFilter==='taken'?'active':''}" data-filter="taken">
        <i class="fas fa-circle-xmark"></i> Taken <span>${counts.taken}</span>
      </button>
      ${counts.pending > 0 ? `<span class="bulk-badge pend"><i class="fas fa-spinner"></i> ${counts.pending}</span>` : ''}
    `;
    // Attach filter listeners
    summary.querySelectorAll('.bulk-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        applyFilter();
        updateSummary(counts);
      });
    });
  }

  function applyFilter() {
    const rows = document.querySelectorAll('.bulk-row');
    rows.forEach(row => {
      if (activeFilter === 'all') {
        row.style.display = '';
      } else {
        row.style.display = row.classList.contains(activeFilter) ? '' : 'none';
      }
    });
  }

  function showExportBar() {
    let bar = document.getElementById('bulkExportBar');
    if (bar) bar.remove();
    bar = document.createElement('div');
    bar.id = 'bulkExportBar';
    bar.className = 'bulk-export-bar';
    bar.innerHTML = `
      <span class="export-label"><i class="fas fa-download"></i> export</span>
      <button class="export-btn" id="exportTxt"><i class="fas fa-file-lines"></i> TXT</button>
      <button class="export-btn" id="exportCsv"><i class="fas fa-file-csv"></i> CSV</button>
      <div class="export-scope">
        <label><input type="radio" name="exportScope" value="all" checked> all</label>
        <label><input type="radio" name="exportScope" value="available"> available only</label>
        <label><input type="radio" name="exportScope" value="taken"> taken only</label>
      </div>
    `;
    bulkResults.insertBefore(bar, document.getElementById('bulkSummary').nextSibling);

    document.getElementById('exportTxt').addEventListener('click', () => doExport('txt'));
    document.getElementById('exportCsv').addEventListener('click', () => doExport('csv'));
  }

  function getExportData() {
    const scope = document.querySelector('input[name="exportScope"]:checked')?.value || 'all';
    return bulkResultsData.filter(d =>
      scope === 'all' ? true : d.status === scope
    );
  }

  function doExport(type) {
    const data = getExportData();
    let content, filename, mime;
    if (type === 'csv') {
      content = 'domain,status\n' + data.map(d => `${d.domain},${d.status}`).join('\n');
      filename = 'domains.csv';
      mime = 'text/csv';
    } else {
      content = data.map(d => `${d.domain}\t${d.status}`).join('\n');
      filename = 'domains.txt';
      mime = 'text/plain';
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  async function checkOneDomain(domain, row, counts) {
    try {
      const res = await fetch(getRdapUrl(domain), { headers: { Accept: 'application/json' } });
      counts.pending--;
      if (res.status === 200) {
        counts.taken++;
        updateRow(row, 'taken', 'fas fa-circle-xmark', 'taken');
        bulkResultsData.push({ domain, status: 'taken' });
      } else if (res.status === 404) {
        counts.available++;
        updateRow(row, 'available', 'fas fa-circle-check', 'available');
        bulkResultsData.push({ domain, status: 'available' });
      } else if (res.status === 429) {
        counts.error++;
        updateRow(row, 'error', 'fas fa-clock', 'rate limited');
        bulkResultsData.push({ domain, status: 'error' });
      } else {
        counts.error++;
        updateRow(row, 'error', 'fas fa-bug', `error ${res.status}`);
        bulkResultsData.push({ domain, status: 'error' });
      }
    } catch {
      counts.pending--;
      counts.error++;
      updateRow(row, 'network', 'fas fa-wifi-slash', 'network error');
      bulkResultsData.push({ domain, status: 'error' });
    }
    applyFilter();
    updateSummary(counts);
  }

  async function checkBulk() {
    const raw = bulkInput.value;
    const domains = parseDomains(raw);

    if (domains.length === 0) {
      bulkResults.style.display = 'none';
      return;
    }

    // Reset
    bulkResultsData = [];
    activeFilter = 'all';
    bulkResults.innerHTML = '';
    bulkResults.style.display = '';

    // Summary / filter bar
    const summary = document.createElement('div');
    summary.className = 'bulk-summary';
    summary.id = 'bulkSummary';
    bulkResults.appendChild(summary);

    const counts = { available: 0, taken: 0, error: 0, pending: 0 };

    // Rows container
    const rowsWrap = document.createElement('div');
    rowsWrap.id = 'bulkRowsWrap';
    bulkResults.appendChild(rowsWrap);

    const rows = [];
    for (const domain of domains) {
      const row = createRow(domain);
      if (!isValidDomain(domain)) {
        row.className = 'bulk-row error';
        row.querySelector('.bulk-row-icon').className = 'fas fa-triangle-exclamation bulk-row-icon';
        row.querySelector('.bulk-row-status').textContent = 'invalid';
        counts.error++;
        bulkResultsData.push({ domain, status: 'error' });
      } else {
        counts.pending++;
        rows.push({ domain, row });
      }
      rowsWrap.appendChild(row);
    }

    updateSummary(counts);

    const BATCH = 3;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      await Promise.all(batch.map(({ domain, row }) => checkOneDomain(domain, row, counts)));
      if (i + BATCH < rows.length) await new Promise(r => setTimeout(r, 300));
    }

    // All done — show export bar
    showExportBar();
  }

  bulkCheckBtn.addEventListener('click', checkBulk);

  document.addEventListener('keydown', e => {
    // Ctrl+Enter — switch to bulk from single
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && currentMode === 'single') {
      e.preventDefault();
      modeBulk.click();
    }
    // Enter — run bulk check when in bulk mode
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && currentMode === 'bulk') {
      e.preventDefault();
      checkBulk();
    }
    // Escape — go back to single from bulk
    if (e.key === 'Escape' && currentMode === 'bulk') {
      e.preventDefault();
      modeSingle.click();
    }
  });

})();
