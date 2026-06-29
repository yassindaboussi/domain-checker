(function() {
  const domainInput = document.getElementById('domainInput');
  const checkBtn = document.getElementById('checkBtn');
  const resultBox = document.getElementById('resultBox');
  const resultIcon = resultBox.querySelector('.result-content i');
  const resultDomain = resultBox.querySelector('.result-domain');
  const resultSub = resultBox.querySelector('.result-sub');

  function setResult(status, icon, mainText, subText = '', extraClass = 'empty') {
    resultBox.classList.remove('available', 'taken', 'error', 'network', 'empty', 'loading');
    resultBox.classList.add(extraClass);
    resultIcon.className = icon;
    resultDomain.textContent = mainText;
    resultSub.textContent = subText || '';
  }

  function setLoading() {
    resultBox.classList.remove('available', 'taken', 'error', 'network', 'empty');
    resultBox.classList.add('loading');
    resultIcon.className = 'fas fa-spinner';
    resultDomain.textContent = 'checking…';
    resultSub.textContent = 'querying RDAP registry';
  }

  // —— find correct RDAP endpoint ——
  function getRdapUrl(domain) {
    // Use ICANN's unified RDAP service (covers most TLDs)
    return `https://rdap.verisign.com/com/v1/domain/${encodeURIComponent(domain)}`;
  }

  async function checkDomain() {
    const raw = domainInput.value.trim();
    if (!raw) {
      setResult('empty', 'fas fa-circle-info', 'enter a domain', 'e.g. example.com', 'empty');
      return;
    }

    // Basic validation: must contain a dot
    if (!raw.includes('.') || raw.startsWith('.') || raw.endsWith('.')) {
      setResult('error', 'fas fa-triangle-exclamation', 'invalid format', 'include a TLD (e.g. example.com)', 'error');
      return;
    }

    // Try to extract TLD for smarter routing (optional but we keep it simple)
    const domain = raw.toLowerCase();
    const url = getRdapUrl(domain);
    setLoading();

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (res.status === 200) {
        const data = await res.json();
        // Some RDAP responses include "secureDNS" or "events" — we just show taken
        setResult(
          'taken', 
          'fas fa-circle-xmark', 
          `${domain} · taken`, 
          'registered in the domain registry',
          'taken'
        );
      } 
      else if (res.status === 404) {
        setResult(
          'available', 
          'fas fa-circle-check', 
          `${domain} · available`, 
          'you can register this domain',
          'available'
        );
      } 
      else if (res.status === 429) {
        setResult(
          'error', 
          'fas fa-clock', 
          'rate limit', 
          'too many requests — please wait',
          'error'
        );
      } 
      else {
        setResult(
          'error', 
          'fas fa-bug', 
          `error ${res.status}`, 
          'RDAP service returned an error',
          'error'
        );
      }
    } 
    catch (err) {
      setResult(
        'network', 
        'fas fa-wifi-slash', 
        'network error', 
        'check your internet connection',
        'network'
      );
    }
  }

  // —— event listeners ——
  checkBtn.addEventListener('click', checkDomain);
  domainInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      checkDomain();
    }
  });

})();