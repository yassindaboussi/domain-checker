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

  function updateSummary(counts) {
    const summary = document.getElementById('bulkSummary');
    if (!summary) return;
    const done = counts.available + counts.taken + counts.error;
    const total = done + counts.pending;
    summary.innerHTML = `
      <span class="bulk-badge avail"><i class="fas fa-circle-check"></i> ${counts.available} available</span>
      <span class="bulk-badge taken"><i class="fas fa-circle-xmark"></i> ${counts.taken} taken</span>
      ${counts.pending > 0 ? `<span class="bulk-badge pend"><i class="fas fa-spinner"></i> ${counts.pending} checking</span>` : ''}
    `;
  }

  async function checkOneDomain(domain, row, counts) {
    try {
      const res = await fetch(getRdapUrl(domain), { headers: { Accept: 'application/json' } });
      counts.pending--;
      if (res.status === 200) {
        counts.taken++;
        updateRow(row, 'taken', 'fas fa-circle-xmark', 'taken');
      } else if (res.status === 404) {
        counts.available++;
        updateRow(row, 'available', 'fas fa-circle-check', 'available');
      } else if (res.status === 429) {
        counts.error++;
        updateRow(row, 'error', 'fas fa-clock', 'rate limited');
      } else {
        counts.error++;
        updateRow(row, 'error', 'fas fa-bug', `error ${res.status}`);
      }
    } catch {
      counts.pending--;
      counts.error++;
      updateRow(row, 'network', 'fas fa-wifi-slash', 'network error');
    }
    updateSummary(counts);
  }

  async function checkBulk() {
    const raw = bulkInput.value;
    const domains = parseDomains(raw);

    if (domains.length === 0) {
      bulkResults.style.display = 'none';
      return;
    }

    // Build UI
    bulkResults.innerHTML = '';
    bulkResults.style.display = '';

    // Summary bar
    const summary = document.createElement('div');
    summary.className = 'bulk-summary';
    summary.id = 'bulkSummary';
    bulkResults.appendChild(summary);

    const counts = { available: 0, taken: 0, error: 0, pending: 0 };

    // Create all rows first
    const rows = [];
    for (const domain of domains) {
      const row = createRow(domain);
      if (!isValidDomain(domain)) {
        row.className = 'bulk-row error';
        row.querySelector('.bulk-row-icon').className = 'fas fa-triangle-exclamation bulk-row-icon';
        row.querySelector('.bulk-row-status').textContent = 'invalid';
        counts.error++;
      } else {
        counts.pending++;
        rows.push({ domain, row });
      }
      bulkResults.appendChild(row);
    }

    updateSummary(counts);

    // Check in batches of 3 to avoid rate-limiting
    const BATCH = 3;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      await Promise.all(batch.map(({ domain, row }) => checkOneDomain(domain, row, counts)));
      // Small pause between batches
      if (i + BATCH < rows.length) await new Promise(r => setTimeout(r, 300));
    }
  }

  bulkCheckBtn.addEventListener('click', checkBulk);
  bulkInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); checkBulk(); }
  });

})();
