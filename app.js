document.addEventListener("DOMContentLoaded", () => {
  const VERSION = "3.6.12-compact-polish";
  const CONFIG_KEYS = {
    commRate: "rb_commRate",
    baseFull: "rb_baseFull",
    baseHalf: "rb_baseHalf",
    theme: "rbTheme",
  };

  const DEFAULTS = {
    commRate: 30,
    baseFull: 1000,
    baseHalf: 500,
    theme: "dark",
  };

  const CONSTANTS = {
    minTrzbaPerKm: 15,
    iacKmPerRide: 33,
    shkmKmPerRide: 7,
  };

  const formatCurrency = new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const formatInt = new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const el = {
    form: document.getElementById("calcForm"),
    output: document.getElementById("output"),
    actions: document.getElementById("actions"),
    resetBtn: document.getElementById("resetBtn"),
    pdfBtn: document.getElementById("pdfExport"),
    shareImgBtn: document.getElementById("shareImgBtn"),
    newShiftBtn: document.getElementById("newShiftBtn"),
    themeToggle: document.getElementById("themeToggle"),
    settingsBtn: document.getElementById("settingsBtn"),
    settingsModal: document.getElementById("settingsModal"),
    pwaBanner: document.getElementById("pwaBanner"),
    installPwaBtn: document.getElementById("installPwaBtn"),
    appNotice: document.getElementById("appNotice"),
    appVersion: document.getElementById("appVersion"),
    kmReal: document.getElementById("kmReal"),
    headerStatus: document.getElementById("headerStatus"),
    headerStatusText: document.getElementById("headerStatusText"),
    liveUctovane: document.getElementById("liveUctovane"),
    liveSmluvni: document.getElementById("liveSmluvni"),
    liveNetto: document.getElementById("liveNetto"),
    kpiStrip: document.getElementById("kpiStrip"),
    liveDeltaCard: document.getElementById("liveDeltaCard"),
    liveDelta: document.getElementById("liveDelta"),
    liveStatus: document.getElementById("liveStatus"),
    heroComm: document.getElementById("heroComm"),
    heroFull: document.getElementById("heroFull"),
    heroHalf: document.getElementById("heroHalf"),
    heroStatusText: document.getElementById("heroStatusText"),
    commandStatusCard: document.getElementById("commandStatusCard"),
    liveShiftBadge: document.getElementById("liveShiftBadge"),
    livePayoutMode: document.getElementById("livePayoutMode"),
    liveGross: document.getElementById("liveGross"),
    liveNonCash: document.getElementById("liveNonCash"),
    liveCosts: document.getElementById("liveCosts"),
    liveDesk: document.getElementById("liveDesk"),
    liveSettlement: document.getElementById("liveCelkem"),
    setComm: document.getElementById("setComm"),
    setFull: document.getElementById("setFull"),
    setHalf: document.getElementById("setHalf"),
    saveSettingsBtn: document.getElementById("saveSettingsBtn"),
    closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  };

  const FIELD_IDS = [
    "driverName", "shiftType", "rz", "kmStart", "kmEnd", "trzba", "pristavne",
    "palivo", "myti", "kartou", "fakturou", "jine", "iacCount", "shkmCount",
  ];

  const FRIENDLY_NAMES = {
    pristavne: "Přístavné",
    palivo: "Palivo",
    myti: "Mytí",
    kartou: "Kartou",
    fakturou: "Fakturou",
    jine: "Jiné",
    iacCount: "IAC",
    shkmCount: "SHKM",
  };

  let deferredPrompt = null;
  let lastRenderedData = null;
  let isCalculated = false;
  let lastFocusedBeforeSettings = null;

  function getText(id) {
    return document.getElementById(id)?.value?.trim() || "";
  }

  function getNumber(id) {
    const value = Number.parseFloat(getText(id).replace(",", "."));
    return Number.isFinite(value) ? value : 0;
  }

  function formatMoney(value) {
    return formatCurrency.format(Number(value) || 0);
  }

  function formatNumber(value) {
    return formatInt.format(Number(value) || 0);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function roundMoney(value) {
    return Math.round(Number(value) || 0);
  }

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function canvasToBlob(canvas, type = "image/png", quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("Nepodařilo se vytvořit obrázek výčetky."));
      }, type, quality);
    });
  }

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      anchor.remove();
    }, 1000);
  }

  function showNotice(message, tone = "neutral") {
    if (!el.appNotice) return;
    el.appNotice.textContent = message;
    el.appNotice.classList.remove("hidden", "is-good", "is-bad");
    if (tone === "good") el.appNotice.classList.add("is-good");
    if (tone === "bad") el.appNotice.classList.add("is-bad");
  }

  function clearNotice() {
    el.appNotice?.classList.add("hidden");
  }

  async function captureElementCanvas(node, scale = Math.max(2, Math.floor(window.devicePixelRatio || 2)), backgroundColor = null) {
    if (typeof window.html2canvas !== "function") {
      throw new Error("Knihovna pro vytvoření obrázku není načtená.");
    }

    await nextFrame();

    return window.html2canvas(node, {
      scale: Math.min(3, scale),
      backgroundColor,
      useCORS: true,
      logging: false,
      removeContainer: true,
      imageTimeout: 0,
    });
  }

  function readNumberByRule(key, fallback, isValid) {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && isValid(value) ? value : fallback;
  }

  function getConfig() {
    return {
      commRate: readNumberByRule(CONFIG_KEYS.commRate, DEFAULTS.commRate, (value) => value > 0 && value <= 100),
      baseFull: readNumberByRule(CONFIG_KEYS.baseFull, DEFAULTS.baseFull, (value) => value >= 0),
      baseHalf: readNumberByRule(CONFIG_KEYS.baseHalf, DEFAULTS.baseHalf, (value) => value >= 0),
    };
  }

  function getShiftLabel(value) {
    const labels = {
      den: "Denní",
      noc: "Noční",
      odpo: "Odpolední",
      pul: "1/2 směna",
    };
    return labels[value] || value || "—";
  }

  function readFormValues() {
    return {
      driver: getText("driverName"),
      shift: getText("shiftType"),
      rz: getText("rz"),
      kmStart: getNumber("kmStart"),
      kmEnd: getNumber("kmEnd"),
      trzba: getNumber("trzba"),
      pristavne: getNumber("pristavne"),
      palivo: getNumber("palivo"),
      myti: getNumber("myti"),
      kartou: getNumber("kartou"),
      fakturou: getNumber("fakturou"),
      jine: getNumber("jine"),
      iacCount: getNumber("iacCount"),
      shkmCount: getNumber("shkmCount"),
    };
  }

  function computeMetrics(values, config = getConfig()) {
    const kmReal = Math.max(0, values.kmEnd - values.kmStart);
    const iacKm = values.iacCount * CONSTANTS.iacKmPerRide;
    const shkmKm = values.shkmCount * CONSTANTS.shkmKmPerRide;
    const invoiceKm = iacKm + shkmKm;
    const chargedKm = Math.max(0, kmReal - invoiceKm);
    const minTrzba = chargedKm * CONSTANTS.minTrzbaPerKm;
    const netto = values.trzba - values.pristavne;
    const nonCash = values.kartou + values.fakturou;
    const costs = values.palivo + values.myti + values.jine;
    const isHalf = values.shift === "pul";
    const commissionRate = config.commRate / 100;
    const fixedPayout = isHalf ? config.baseHalf : config.baseFull;
    const threshold = commissionRate > 0 ? fixedPayout / commissionRate : Number.POSITIVE_INFINITY;
    const usesPercentage = netto > threshold;
    const vyplata = netto > 0 ? roundMoney(usesPercentage ? netto * commissionRate : fixedPayout) : 0;
    const doplatek = Math.max(0, minTrzba - values.trzba);
    const delta = values.trzba - minTrzba;
    const kOdevzdani = values.trzba - values.palivo - values.myti - values.kartou - values.fakturou - values.jine - vyplata;
    const settlement = kOdevzdani + doplatek;

    return {
      ...values,
      config,
      datum: new Date().toLocaleString("cs-CZ"),
      shiftLabel: getShiftLabel(values.shift),
      kmReal,
      chargedKm,
      invoiceKm,
      iacKm,
      shkmKm,
      minTrzba,
      netto,
      nonCash,
      costs,
      usesPercentage,
      payoutMode: usesPercentage ? `Provize ${config.commRate} %` : `Fix ${formatMoney(fixedPayout)}`,
      vyplata,
      doplatek,
      delta,
      kOdevzdani,
      settlement,
      nedoplatek: doplatek > 0,
    };
  }

  function clearErrors() {
    document.querySelectorAll(".input-error").forEach((field) => field.classList.remove("input-error"));
  }

  function setFieldError(id) {
    document.getElementById(id)?.classList.add("input-error");
  }

  function validate(values) {
    clearErrors();

    if (!values.driver) {
      setFieldError("driverName");
      return "Vyplň jméno řidiče.";
    }

    if (values.kmStart < 0) {
      setFieldError("kmStart");
      return "Počáteční km nemohou být záporné.";
    }

    if (values.kmEnd < 0) {
      setFieldError("kmEnd");
      return "Konečné km nemohou být záporné.";
    }

    if (values.kmEnd < values.kmStart) {
      setFieldError("kmEnd");
      return "Konečný stav tachometru je menší než počáteční.";
    }

    if (values.trzba <= 0) {
      setFieldError("trzba");
      return "Tržba musí být větší než 0.";
    }

    for (const id of ["pristavne", "palivo", "myti", "kartou", "fakturou", "jine", "iacCount", "shkmCount"]) {
      if (values[id] < 0) {
        setFieldError(id);
        return `${FRIENDLY_NAMES[id]} nesmí být záporné.`;
      }
    }

    for (const id of ["iacCount", "shkmCount"]) {
      if (!Number.isInteger(values[id])) {
        setFieldError(id);
        return `${FRIENDLY_NAMES[id]} musí být celé číslo.`;
      }
    }

    const metrics = computeMetrics(values);
    if (metrics.invoiceKm > metrics.kmReal) {
      setFieldError("iacCount");
      setFieldError("shkmCount");
      return `Smluvní km (${formatNumber(metrics.invoiceKm)}) jsou vyšší než najeté km (${formatNumber(metrics.kmReal)}).`;
    }

    return "";
  }

  function syncKm() {
    const values = readFormValues();
    const kmReal = Math.max(0, values.kmEnd - values.kmStart);
    if (el.kmReal) {
      el.kmReal.value = kmReal ? String(kmReal) : "";
    }
  }


  function setDeltaVisibility(visible) {
    el.liveDeltaCard?.classList.toggle("hidden", !visible);
    el.kpiStrip?.classList.toggle("is-single", !visible);
  }

  function clearRenderedReport() {
    lastRenderedData = null;
    if (el.output) {
      el.output.innerHTML = "";
      el.output.classList.add("hidden");
    }
    el.actions?.classList.add("hidden");
  }

  function markReportDirty() {
    isCalculated = false;
    setDeltaVisibility(false);
    clearRenderedReport();
  }

  function setHeaderStatus(state, text) {
    if (!el.headerStatus || !el.headerStatusText) return;
    el.headerStatus.classList.remove("is-good", "is-bad", "is-neutral");
    el.headerStatus.classList.add(state);
    el.headerStatusText.textContent = text;
  }

  function setCommandCardTone(state) {
    if (!el.commandStatusCard) return;
    el.commandStatusCard.classList.remove("status-good", "status-bad", "status-neutral");
    el.commandStatusCard.classList.add(state);
  }

  function updateHeroConfig() {
    const config = getConfig();
    if (el.heroComm) el.heroComm.textContent = `${config.commRate} %`;
    if (el.heroFull) el.heroFull.textContent = formatMoney(config.baseFull);
    if (el.heroHalf) el.heroHalf.textContent = formatMoney(config.baseHalf);
  }

  function updateStatus(metrics) {
    const hasData = metrics.kmReal > 0 || metrics.trzba > 0 || metrics.invoiceKm > 0;
    el.liveStatus?.classList.remove("is-good", "is-bad");

    if (!hasData) {
      if (el.liveStatus) el.liveStatus.textContent = "Vyplň údaje směny a přehled se dopočítá automaticky.";
      if (el.heroStatusText) el.heroStatusText.textContent = "Čeká na data směny";
      if (el.liveShiftBadge) el.liveShiftBadge.textContent = "Připraveno";
      if (el.livePayoutMode) el.livePayoutMode.textContent = "Čeká na data";
      setHeaderStatus("is-neutral", "Připraveno k výpočtu");
      setCommandCardTone("status-neutral");
      return;
    }

    if (el.liveShiftBadge) el.liveShiftBadge.textContent = `${metrics.shiftLabel} směna`;
    if (el.livePayoutMode) el.livePayoutMode.textContent = metrics.payoutMode;

    if (!isCalculated) {
      if (el.liveStatus) el.liveStatus.textContent = "Rozdíl vůči minimu se zobrazí až po kliknutí na Vypočítat výčetku.";
      if (el.heroStatusText) el.heroStatusText.textContent = "Čeká na výpočet";
      setHeaderStatus("is-neutral", "Čeká na výpočet");
      setCommandCardTone("status-neutral");
      return;
    }

    if (metrics.delta >= 0) {
      if (el.liveStatus) {
        el.liveStatus.classList.add("is-good");
        el.liveStatus.textContent = `Směna je nad minimem o ${formatMoney(metrics.delta)}.`;
      }
      if (el.heroStatusText) el.heroStatusText.textContent = `Nad minimem o ${formatMoney(metrics.delta)}`;
      setHeaderStatus("is-good", "Směna je nad minimem");
      setCommandCardTone("status-good");
      return;
    }

    if (el.liveStatus) {
      el.liveStatus.classList.add("is-bad");
      el.liveStatus.textContent = `Směna je pod minimem o ${formatMoney(Math.abs(metrics.delta))}.`;
    }
    if (el.heroStatusText) el.heroStatusText.textContent = `Pod minimem o ${formatMoney(Math.abs(metrics.delta))}`;
    setHeaderStatus("is-bad", "Směna je pod minimem");
    setCommandCardTone("status-bad");
  }

  function updateLivePreview() {
    syncKm();
    const metrics = computeMetrics(readFormValues());

    if (el.liveUctovane) el.liveUctovane.textContent = formatNumber(metrics.chargedKm);
    if (el.liveSmluvni) el.liveSmluvni.textContent = formatNumber(metrics.invoiceKm);
    if (el.liveNetto) el.liveNetto.textContent = formatMoney(metrics.netto);
    if (el.liveDelta) el.liveDelta.textContent = isCalculated ? formatMoney(metrics.delta) : "—";
    setDeltaVisibility(isCalculated);
    if (el.liveGross) el.liveGross.textContent = formatMoney(metrics.trzba);
    if (el.liveNonCash) el.liveNonCash.textContent = formatMoney(metrics.nonCash);
    if (el.liveCosts) el.liveCosts.textContent = formatMoney(metrics.costs);
    if (el.liveDesk) el.liveDesk.textContent = formatMoney(metrics.kOdevzdani);
    if (el.liveSettlement) el.liveSettlement.textContent = formatMoney(metrics.settlement);

    updateStatus(metrics);
  }

  function buildReportHtml(metrics) {
    const statusText = metrics.nedoplatek
      ? `Směna je pod minimem. Nutný doplatek ${formatMoney(metrics.doplatek)}.`
      : `Směna je nad minimem o ${formatMoney(metrics.delta)}.`;

    const row = (label, value, options = {}) => {
      const { icon = "icon-doc", className = "", show = true } = options;
      if (!show) return "";
      const iconHtml = icon ? `<svg class="icon"><use href="#${icon}"></use></svg>` : "";
      return `
        <div class="row ${className}">
          <div class="key">${iconHtml}${label}</div>
          <div class="val">${value}</div>
        </div>
      `;
    };

    const contractItems = [];
    if (metrics.iacCount > 0) contractItems.push(`IAC ${formatNumber(metrics.iacCount)}× (${formatNumber(metrics.iacKm)} km)`);
    if (metrics.shkmCount > 0) contractItems.push(`SHKM ${formatNumber(metrics.shkmCount)}× (${formatNumber(metrics.shkmKm)} km)`);

    const safeDriver = escapeHtml(metrics.driver);
    const safeShiftLabel = escapeHtml(metrics.shiftLabel);
    const safeRz = escapeHtml(metrics.rz || "—");
    const safeDatum = escapeHtml(metrics.datum);
    const safePayoutMode = escapeHtml(metrics.payoutMode);
    const safeContracts = escapeHtml(contractItems.join(", "));

    const financeRows = [
      row("Tržba", formatMoney(metrics.trzba), { icon: "icon-cash" }),
      row("Přístavné", formatMoney(metrics.pristavne), { icon: "icon-flag", show: metrics.pristavne > 0 }),
      row("Netto po přístavném", formatMoney(metrics.netto), { icon: "icon-cash" }),
      row("Palivo", formatMoney(metrics.palivo), { icon: "icon-fuel", show: metrics.palivo > 0 }),
      row("Mytí", formatMoney(metrics.myti), { icon: "icon-wash", show: metrics.myti > 0 }),
      row("Kartou", formatMoney(metrics.kartou), { icon: "icon-card", show: metrics.kartou > 0 }),
      row("Fakturou", formatMoney(metrics.fakturou), { icon: "icon-doc", show: metrics.fakturou > 0 }),
      row("Jiné", formatMoney(metrics.jine), { icon: "icon-doc", show: metrics.jine > 0 }),
      row("Nehotovost celkem", formatMoney(metrics.nonCash), { icon: "icon-card", show: metrics.nonCash > 0 }),
      row("K odevzdání (hotovost)", formatMoney(metrics.kOdevzdani), { className: "accent-odev", icon: null }),
      row("Výplata řidiče", formatMoney(metrics.vyplata), { className: "accent-pay", icon: null }),
      row("Doplatek řidiče na minimum", formatMoney(metrics.doplatek), { className: "accent-doplatek", icon: null, show: metrics.nedoplatek }),
      row("K odevzdání celkem", formatMoney(metrics.settlement), { className: "accent-grand", icon: null }),
    ].join("");

    return `
      <div class="report-head">
        <div class="report-brand">
          <img src="icon-192.png" alt="RB TAXI" class="report-mark" />
          <div>
            <div class="title">Výčetka řidiče</div>
            <div class="subtitle">RB TAXI Hodonín • ${safeDatum}</div>
          </div>
        </div>
        <div class="report-meta">
          <div class="report-badge">Souhrn směny</div>
          <div class="report-status ${metrics.nedoplatek ? "bad" : "good"}">${statusText}</div>
        </div>
      </div>

      <div class="report-total-card ${metrics.nedoplatek ? "is-bad" : "is-good"}">
        <div>
          <div class="report-total-label">K odevzdání celkem</div>
          <div class="report-total-note">hotovost po odečtení výplaty${metrics.nedoplatek ? " a doplatku na minimum" : ""}</div>
        </div>
        <div class="report-total-value">${formatMoney(metrics.settlement)}</div>
      </div>

      <div class="summary-grid">
        <div class="summary-card cash">
          <div class="small">Tržba</div>
          <div class="big">${formatMoney(metrics.trzba)}</div>
        </div>
        <div class="summary-card pay">
          <div class="small">Výplata</div>
          <div class="big">${formatMoney(metrics.vyplata)}</div>
        </div>
        <div class="summary-card delta">
          <div class="small">Náklady</div>
          <div class="big">${formatMoney(metrics.costs)}</div>
        </div>
        <div class="summary-card ${metrics.nedoplatek ? "doplatek" : "cash"}">
          <div class="small">${metrics.nedoplatek ? "Doplatek" : "K odevzdání"}</div>
          <div class="big">${formatMoney(metrics.nedoplatek ? metrics.doplatek : metrics.kOdevzdani)}</div>
        </div>
      </div>

      <div class="detail-grid">
        <section class="detail-card">
          <div class="detail-title">Směna</div>
          ${row("Řidič", safeDriver, { icon: "icon-user" })}
          ${row("Typ směny", safeShiftLabel, { icon: "icon-clock" })}
          ${row("RZ vozidla", safeRz, { icon: "icon-car" })}
          ${row("Režim výplaty", safePayoutMode, { icon: "icon-cash" })}
        </section>

        <section class="detail-card">
          <div class="detail-title">Kilometry</div>
          ${row("Počáteční km", formatNumber(metrics.kmStart), { icon: "icon-flag" })}
          ${row("Konečné km", formatNumber(metrics.kmEnd), { icon: "icon-flag" })}
          ${row("Najeté km (auto)", formatNumber(metrics.kmReal), { icon: "icon-road" })}
          ${row("Účtované km", formatNumber(metrics.chargedKm), { icon: "icon-road" })}
          ${row("Smluvní jízdy", safeContracts, { icon: "icon-doc", show: contractItems.length > 0 })}
          ${row("KM smluvní", formatNumber(metrics.invoiceKm), { icon: "icon-doc", show: metrics.invoiceKm > 0 })}
          ${row("Minimum podle km", formatMoney(metrics.minTrzba), { icon: "icon-cash", show: metrics.minTrzba > 0 })}
        </section>

        <section class="detail-card detail-card-wide">
          <div class="detail-title">Finance</div>
          ${financeRows}
        </section>
      </div>
    `;
  }

  function buildCompactExportHtml(metrics) {
    const statusText = metrics.nedoplatek
      ? `Směna je pod minimem. Doplatek ${formatMoney(metrics.doplatek)}.`
      : `Směna je nad minimem o ${formatMoney(metrics.delta)}.`;

    const safeDriver = escapeHtml(metrics.driver);
    const safeShiftLabel = escapeHtml(metrics.shiftLabel);
    const safeRz = escapeHtml(metrics.rz || "—");
    const safeDatum = escapeHtml(metrics.datum);
    const safePayoutMode = escapeHtml(metrics.payoutMode);

    const metaItem = (label, value) => `
      <div class="share-meta-item">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
    `;

    const kpiItem = (label, value, className = "") => `
      <div class="share-kpi ${className}">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
    `;

    return `
      <div class="share-card">
        <div class="share-head">
          <div class="share-brand">
            <img src="icon-192.png" alt="RB TAXI" class="share-mark" />
            <div>
              <div class="share-title">Výčetka řidiče</div>
              <div class="share-subtitle">RB TAXI Hodonín • ${safeDatum}</div>
            </div>
          </div>
          <div class="share-status ${metrics.nedoplatek ? "bad" : "good"}">${statusText}</div>
        </div>

        <div class="share-total ${metrics.nedoplatek ? "is-bad" : ""}">
          <div class="share-total-label">K odevzdání celkem</div>
          <div class="share-total-value">${formatMoney(metrics.settlement)}</div>
          <div class="share-total-note">hotovost po odečtení výplaty${metrics.nedoplatek ? " a doplatku na minimum" : ""}</div>
        </div>

        <div class="share-grid">
          ${kpiItem("Tržba", formatMoney(metrics.trzba), "cash")}
          ${kpiItem("Výplata", formatMoney(metrics.vyplata), "pay")}
          ${kpiItem("Náklady", formatMoney(metrics.costs), "costs")}
          ${kpiItem(metrics.nedoplatek ? "Doplatek" : "Hotovost", formatMoney(metrics.nedoplatek ? metrics.doplatek : metrics.kOdevzdani), metrics.nedoplatek ? "danger" : "cash")}
        </div>

        <div class="share-meta">
          ${metaItem("Řidič", safeDriver)}
          ${metaItem("Směna", safeShiftLabel)}
          ${metaItem("RZ", safeRz)}
          ${metaItem("Najeté km", formatNumber(metrics.kmReal))}
          ${metaItem("Režim výplaty", safePayoutMode)}
          ${metaItem("Nehotovost", formatMoney(metrics.nonCash))}
        </div>

        <div class="share-note">
          Netto po přístavném: <strong>${formatMoney(metrics.netto)}</strong>${metrics.invoiceKm > 0 ? ` • KM smluvní: <strong>${formatNumber(metrics.invoiceKm)}</strong>` : ""}
        </div>
      </div>
    `;
  }

  function renderReport(metrics) {
    isCalculated = true;
    lastRenderedData = metrics;
    setDeltaVisibility(true);
    if (el.liveDelta) el.liveDelta.textContent = formatMoney(metrics.delta);
    updateStatus(metrics);
    el.output.innerHTML = buildReportHtml(metrics);
    el.output.classList.remove("hidden");
    el.actions?.classList.remove("hidden");
  }

  function resetForm(options = {}) {
    const { keepName = false, keepRz = false, keepKmStart = false } = options;
    const remembered = {
      driver: keepName ? getText("driverName") : "",
      rz: keepRz ? getText("rz") : "",
      kmStart: keepKmStart ? getText("kmEnd") : "",
    };

    el.form?.reset();

    if (remembered.driver) document.getElementById("driverName").value = remembered.driver;
    if (remembered.rz) document.getElementById("rz").value = remembered.rz;
    if (remembered.kmStart) document.getElementById("kmStart").value = remembered.kmStart;

    clearErrors();
    markReportDirty();
    updateLivePreview();
  }

  function buildExportClone(mode = "share") {
    if (!lastRenderedData || el.output?.classList.contains("hidden")) {
      throw new Error("Nejdřív vytvoř výčetku.");
    }

    const host = document.createElement("div");
    host.className = "export-capture-host";

    const clone = document.createElement("section");
    clone.id = "exportOutput";
    clone.className = "export-mode";

    if (mode === "share") {
      const exportWidth = Math.max(320, Math.min(430, Math.floor((window.innerWidth || 390) - 24)));
      host.style.width = `${exportWidth}px`;
      clone.style.width = `${exportWidth}px`;
      clone.classList.add("export-share-mode");
      clone.innerHTML = buildCompactExportHtml(lastRenderedData);
      host.appendChild(clone);
      document.body.appendChild(host);
      return { host, clone };
    }

    const exportWidth = 900;
    host.style.width = `${exportWidth}px`;
    clone.style.width = `${exportWidth}px`;
    clone.innerHTML = buildReportHtml(lastRenderedData);
    host.appendChild(clone);
    document.body.appendChild(host);
    return { host, clone };
  }

  async function buildReportImageFile(mode = "share") {
    const { host, clone } = buildExportClone(mode);
    try {
      const scaleBase = mode === "share"
        ? Math.max(2, Math.min(3, Number(window.devicePixelRatio || 2)))
        : Math.max(2, Math.floor(window.devicePixelRatio || 2));
      const canvas = await captureElementCanvas(clone, scaleBase, "#ffffff");
      const blob = await canvasToBlob(canvas, "image/png");
      const filename = `RB-TAXI-vycetka-${VERSION}${mode === "share" ? "-mobile" : ""}.png`;
      const file = typeof File === "function" ? new File([blob], filename, { type: "image/png" }) : null;
      return { blob, file, filename, canvas };
    } finally {
      host.remove();
    }
  }

  async function shareReportImage() {
    const { blob, file, filename } = await buildReportImageFile("share");

    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Výčetka",
        text: "RB TAXI – Výčetka řidiče",
      });
      return;
    }

    triggerBlobDownload(blob, filename);
  }

  async function exportPdf() {
    if (!window.jspdf?.jsPDF) {
      throw new Error("Knihovna pro PDF není načtená.");
    }

    const { canvas } = await buildReportImageFile("share");
    const img = canvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const margin = 28;
    const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2;
    const pageHeight = pdf.internal.pageSize.getHeight() - margin * 2;
    const renderHeight = canvas.height * (pageWidth / canvas.width);
    const fittedHeight = Math.min(renderHeight, pageHeight);
    const y = margin + Math.max(0, (pageHeight - fittedHeight) / 2);
    pdf.addImage(img, "PNG", margin, y, pageWidth, fittedHeight);
    pdf.save(`RB-TAXI-vycetka-${VERSION}.pdf`);
  }

  function updateThemeButton() {
    if (!el.themeToggle) return;
    const isLight = document.body.classList.contains("light-mode");
    el.themeToggle.innerHTML = isLight
      ? '<svg class="icon"><use href="#icon-moon"></use></svg>'
      : '<svg class="icon"><use href="#icon-sun"></use></svg>';
    el.themeToggle.title = isLight ? "Přepnout na tmavý režim" : "Přepnout na světlý režim";
  }

  function initTheme() {
    const savedTheme = localStorage.getItem(CONFIG_KEYS.theme) || DEFAULTS.theme;
    document.body.classList.toggle("light-mode", savedTheme === "light");
    updateThemeButton();

    el.themeToggle?.addEventListener("click", () => {
      const isLight = document.body.classList.toggle("light-mode");
      localStorage.setItem(CONFIG_KEYS.theme, isLight ? "light" : "dark");
      updateThemeButton();
    });
  }

  function initSettings() {
    const closeSettings = () => {
      el.settingsModal?.classList.add("hidden");
      lastFocusedBeforeSettings?.focus?.();
      lastFocusedBeforeSettings = null;
    };

    el.settingsBtn?.addEventListener("click", () => {
      const config = getConfig();
      lastFocusedBeforeSettings = document.activeElement;
      if (el.setComm) el.setComm.value = String(config.commRate);
      if (el.setFull) el.setFull.value = String(config.baseFull);
      if (el.setHalf) el.setHalf.value = String(config.baseHalf);
      el.settingsModal?.classList.remove("hidden");
      el.setComm?.focus();
    });

    el.closeSettingsBtn?.addEventListener("click", () => {
      closeSettings();
    });

    el.saveSettingsBtn?.addEventListener("click", () => {
      const commRate = getNumber("setComm");
      const baseFull = getNumber("setFull");
      const baseHalf = getNumber("setHalf");

      if (commRate <= 0 || commRate > 100 || baseFull < 0 || baseHalf < 0) {
        showNotice("Zkontroluj nastavení. Provize musí být 1–100 % a fixy nesmí být záporné.", "bad");
        return;
      }

      localStorage.setItem(CONFIG_KEYS.commRate, String(commRate));
      localStorage.setItem(CONFIG_KEYS.baseFull, String(baseFull));
      localStorage.setItem(CONFIG_KEYS.baseHalf, String(baseHalf));
      el.settingsModal?.classList.add("hidden");
      lastFocusedBeforeSettings?.focus?.();
      lastFocusedBeforeSettings = null;
      markReportDirty();
      updateHeroConfig();
      updateLivePreview();
      showNotice("Nastavení výpočtu je uložené.", "good");
    });

    el.settingsModal?.addEventListener("click", (event) => {
      if (event.target === el.settingsModal) {
        closeSettings();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !el.settingsModal?.classList.contains("hidden")) {
        closeSettings();
      }
    });
  }

  function initPwaPrompt() {
    if (window.location.protocol === "file:") return;

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredPrompt = event;
      el.pwaBanner?.classList.remove("hidden");
    });

    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      el.pwaBanner?.classList.add("hidden");
    });

    el.installPwaBtn?.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      el.pwaBanner?.classList.add("hidden");
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    const allowedProtocol = window.location.protocol === "https:" || (window.location.protocol === "http:" && isLocalhost);
    if (!allowedProtocol) return;

    window.addEventListener("load", async () => {
      try {
        await navigator.serviceWorker.register("./service-worker.js");
      } catch (error) {
        console.error("Service worker registration failed:", error);
      }
    });
  }

  function bindEvents() {
    el.form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = readFormValues();
      const validationError = validate(values);

      if (validationError) {
        showNotice(validationError, "bad");
        return;
      }

      clearNotice();
      renderReport(computeMetrics(values));
      showNotice("Výčetka je vypočítaná a připravená k exportu.", "good");
    });

    FIELD_IDS.forEach((id) => {
      const field = document.getElementById(id);
      field?.addEventListener("input", () => {
        markReportDirty();
        clearNotice();
        updateLivePreview();
      });
      field?.addEventListener("change", () => {
        markReportDirty();
        clearNotice();
        updateLivePreview();
      });
    });

    el.resetBtn?.addEventListener("click", () => {
      resetForm({ keepName: true });
    });

    el.newShiftBtn?.addEventListener("click", () => {
      resetForm({ keepName: true, keepRz: true, keepKmStart: true });
    });

    el.shareImgBtn?.addEventListener("click", async () => {
      try {
        el.shareImgBtn.disabled = true;
        showNotice("Připravuji obrázek výčetky...", "neutral");
        await shareReportImage();
        showNotice("Obrázek výčetky je připravený.", "good");
      } catch (error) {
        if (error?.name === "AbortError") return;
        showNotice(`Sdílení obrázku selhalo: ${error.message || error}`, "bad");
      } finally {
        el.shareImgBtn.disabled = false;
      }
    });

    el.pdfBtn?.addEventListener("click", async () => {
      try {
        el.pdfBtn.disabled = true;
        showNotice("Připravuji PDF výčetky...", "neutral");
        await exportPdf();
        showNotice("PDF výčetky je připravené.", "good");
      } catch (error) {
        showNotice(`Export do PDF selhal: ${error.message || error}`, "bad");
      } finally {
        el.pdfBtn.disabled = false;
      }
    });
  }

  initTheme();
  initSettings();
  initPwaPrompt();
  registerServiceWorker();
  if (el.appVersion) el.appVersion.textContent = `Verze ${VERSION}`;
  updateHeroConfig();
  bindEvents();
  updateLivePreview();
});
