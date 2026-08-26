// ═════════════════════════════════════════════════════════════════════════
// OPPORTUNITY PRO & INTERNRADAR — CORE CLIENT SCRIPT (v2.2)
// ═════════════════════════════════════════════════════════════════════════

const keywordInput = document.getElementById("keyword");
const countryFilterSelect = document.getElementById("countryFilter");
const fundingFilterSelect = document.getElementById("fundingFilter");
const degreeFilterSelect = document.getElementById("degreeFilter");
const sortBySelect = document.getElementById("sortBy");

const loadBtn = document.getElementById("loadBtn");
const refreshBtn = document.getElementById("refreshBtn");
const exportBtn = document.getElementById("exportBtn");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");

const resultsHead = document.getElementById("resultsHead");
const resultsBody = document.getElementById("resultsBody");
const totalCountEl = document.getElementById("totalCount");
const fundedCountEl = document.getElementById("fundedCount");
const topMatchCountEl = document.getElementById("topMatchCount");
const savedCountEl = document.getElementById("savedCount");
const bookmarkCountEl = document.getElementById("bookmarkCount");
const paginationEl = document.getElementById("pagination");

const userEmailEl = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");
const authOverlay = document.getElementById("authOverlay");

const appConfig = window.INTERNRADAR_CONFIG || {};
const DEFAULT_BASE = appConfig.apiBaseUrl || "http://127.0.0.1:8000";

// App State
let activeTrack = "internships"; // 'internships' | 'ra' | 'grad' | 'tracker' | 'bookmarks' | 'analytics' | 'profile'
let currentOffset = 0;
const perPageLimit = 20;
let currentItems = [];
let selectedDomain = "all";
let currentUser = null;
let activeModalItem = null;
let currentAiDocType = "cover_letter";

// ── AUTH CHECK ────────────────────────────────────────────────────────
async function checkAuth() {
  try {
    const auth = window.auth;
    if (!auth || auth.isLoading) return false;
    const session = await auth.getSession();
    if (!session) return false;
    
    const user = await auth.getUser();
    currentUser = user;
    if (userEmailEl) userEmailEl.textContent = user.email || "Operator";
    if (authOverlay) authOverlay.classList.add("hidden");
    return true;
  } catch (error) {
    return false;
  }
}

async function handleLogout() {
  try {
    if (logoutBtn) logoutBtn.textContent = "Logging out...";
    if (window.auth && typeof window.auth.signOut === "function") {
      await window.auth.signOut();
    }
  } finally {
    window.location.href = "login.html";
  }
}

if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

// ── LOCAL STORAGE HELPERS ─────────────────────────────────────────────
function getBookmarks() {
  return JSON.parse(localStorage.getItem("opportunity_bookmarks") || localStorage.getItem("bookmarks") || "[]");
}

function saveBookmarks(bookmarks) {
  localStorage.setItem("opportunity_bookmarks", JSON.stringify(bookmarks));
  localStorage.setItem("bookmarks", JSON.stringify(bookmarks));
  updateBookmarkCount();
}

function updateBookmarkCount() {
  const count = getBookmarks().length;
  if (bookmarkCountEl) bookmarkCountEl.textContent = String(count);
  if (savedCountEl) savedCountEl.textContent = String(count);
}

function isBookmarked(id, link) {
  const bookmarks = getBookmarks();
  return bookmarks.some(b => (b.id && b.id === id) || (b.link && b.link === link));
}

function toggleBookmark(item) {
  const bookmarks = getBookmarks();
  const itemId = item.id || item.link;
  const existingIdx = bookmarks.findIndex(b => (b.id && b.id === itemId) || (b.link && b.link === itemId));
  
  if (existingIdx >= 0) {
    bookmarks.splice(existingIdx, 1);
  } else {
    bookmarks.push({ ...item, status: item.status || "Saved" });
  }
  saveBookmarks(bookmarks);
  renderCurrentView();
}

function setStatus(msg, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#ef4444" : "var(--text-muted)";
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ── TRACK / TAB SWITCHING ─────────────────────────────────────────────
function setTrack(track) {
  activeTrack = track;
  currentOffset = 0;
  
  // Update sidebar active state
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === track);
  });

  // Switch view containers
  const standardTabs = ["tracker", "bookmarks", "analytics", "profile"];
  if (standardTabs.includes(track)) {
    document.querySelectorAll(".tab-content").forEach(c => {
      c.classList.remove("active");
      c.classList.add("hidden");
    });
    const target = document.getElementById(`${track}Tab`);
    if (target) {
      target.classList.remove("hidden");
      target.classList.add("active");
    }
  } else {
    // Show main opportunities tab
    document.querySelectorAll(".tab-content").forEach(c => {
      c.classList.remove("active");
      c.classList.add("hidden");
    });
    const oppTab = document.getElementById("opportunitiesTab");
    if (oppTab) {
      oppTab.classList.remove("hidden");
      oppTab.classList.add("active");
    }
    updateTrackHeaders(track);
    loadOpportunities();
  }

  // Page title
  const pageTitle = document.getElementById("pageTitle");
  if (pageTitle) {
    if (track === "internships") pageTitle.textContent = "UPCOMING INTERNSHIPS";
    else if (track === "ra") pageTitle.textContent = "RA (RESEARCH ASSISTANT) OPENINGS";
    else if (track === "grad") pageTitle.textContent = "FUNDED MASTERS & PHD SCHOLARSHIPS";
    else if (track === "tracker") pageTitle.textContent = "APPLICATION KANBAN TRACKER";
    else if (track === "bookmarks") pageTitle.textContent = "SAVED BOOKMARKS";
    else if (track === "analytics") pageTitle.textContent = "GLOBAL ANALYTICS";
    else if (track === "profile") pageTitle.textContent = "PROFILE & AI SUITE";
  }

  if (track === "tracker") loadTrackerBoard();
  if (track === "bookmarks") renderBookmarksTab();
  if (track === "analytics") loadAnalytics();
}

function updateTrackHeaders(track) {
  const heroTitle = document.getElementById("heroTitle");
  const heroSubtitle = document.getElementById("heroSubtitle");
  const tableTitle = document.getElementById("tablePanelTitle");
  const statLabel2 = document.getElementById("statLabel2");

  if (track === "internships") {
    if (heroTitle) heroTitle.textContent = "Upcoming & Open Internships Portal";
    if (heroSubtitle) heroSubtitle.textContent = "Explore verified global tech, software, robotics, and regional internships with direct apply links.";
    if (tableTitle) tableTitle.textContent = "UPCOMING & OPEN INTERNSHIP LISTINGS";
    if (statLabel2) statLabel2.textContent = "PAID POSITIONS";
  } else if (track === "ra") {
    if (heroTitle) heroTitle.textContent = "Research Assistant (RA) Opportunities";
    if (heroSubtitle) heroSubtitle.textContent = "Discover faculty lab openings, funded research projects, and professor contacts worldwide.";
    if (tableTitle) tableTitle.textContent = "ACTIVE RESEARCH ASSISTANT (RA) OPENINGS";
    if (statLabel2) statLabel2.textContent = "FULLY FUNDED LABS";
  } else if (track === "grad") {
    if (heroTitle) heroTitle.textContent = "Funded Masters & PhD Scholarships Hub";
    if (heroSubtitle) heroSubtitle.textContent = "Merged with Scholarship Tracker Pro — Fully funded Erasmus Mundus, DAAD, MEXT, Fulbright & Fellowships.";
    if (tableTitle) tableTitle.textContent = "FUNDED GRADUATE SCHOLARSHIP PROGRAMS";
    if (statLabel2) statLabel2.textContent = "100% FULLY FUNDED";
  }
}

// ── API QUERY BUILDER ─────────────────────────────────────────────────
function buildQuery() {
  const categoryMap = {
    internships: "internship",
    ra: "ra",
    grad: "masters_phd",
  };
  const category = categoryMap[activeTrack] || "all";

  const params = new URLSearchParams({
    category: category,
    limit: String(perPageLimit),
    offset: String(currentOffset),
    sort: sortBySelect ? sortBySelect.value : "latest",
  });

  const kw = keywordInput ? keywordInput.value.trim() : "";
  const country = countryFilterSelect ? countryFilterSelect.value : "all";
  const funding = fundingFilterSelect ? fundingFilterSelect.value : "all";
  const degree = degreeFilterSelect ? degreeFilterSelect.value : "all";

  let fullKeyword = kw;
  if (selectedDomain !== "all") {
    fullKeyword = fullKeyword ? `${fullKeyword} ${selectedDomain}` : selectedDomain;
  }

  if (fullKeyword) params.set("keyword", fullKeyword);
  if (country !== "all") params.set("country", country);
  if (funding !== "all") params.set("funding_type", funding);
  if (degree !== "all") params.set("degree_level", degree);

  return `${DEFAULT_BASE}/opportunities?${params.toString()}`;
}

// ── LOAD OPPORTUNITIES ────────────────────────────────────────────────
async function loadOpportunities() {
  const url = buildQuery();
  setStatus("Fetching opportunities...");
  if (loadBtn) {
    loadBtn.disabled = true;
    loadBtn.innerHTML = '<span class="loading-spinner"></span> LOADING...';
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    const items = data.items || [];
    const total = data.total || items.length;
    currentItems = items;

    renderTableHeader();
    renderRows(items);
    updateMetrics(items, total);
    renderPagination(total, perPageLimit, currentOffset);
    setStatus(`Showing ${items.length} of ${total} opportunities`);
  } catch (error) {
    console.error("Load failed:", error);
    renderRows([]);
    setStatus(`Failed: ${error.message}`, true);
  } finally {
    if (loadBtn) {
      loadBtn.disabled = false;
      loadBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> SEARCH & APPLY FILTERS';
    }
  }
}

// ── DYNAMIC TABLE RENDERING ───────────────────────────────────────────
function renderTableHeader() {
  if (!resultsHead) return;
  
  if (activeTrack === "internships") {
    resultsHead.innerHTML = `
      <tr>
        <th style="width:36px;">★</th>
        <th>ROLE / POSITION</th>
        <th>COMPANY / ORG</th>
        <th>LOCATION</th>
        <th>STATUS / DEADLINE</th>
        <th>STIPEND / SALARY</th>
        <th style="text-align: right;">ACTION</th>
      </tr>
    `;
  } else if (activeTrack === "ra") {
    resultsHead.innerHTML = `
      <tr>
        <th style="width:36px;">★</th>
        <th>RESEARCH PROJECT / TOPIC</th>
        <th>UNIVERSITY &amp; LAB</th>
        <th>PROFESSOR / PI</th>
        <th>RESEARCH DOMAIN</th>
        <th>FUNDING / STIPEND</th>
        <th>DEADLINE</th>
        <th style="text-align: right;">ACTION</th>
      </tr>
    `;
  } else {
    // grad (scholarships)
    resultsHead.innerHTML = `
      <tr>
        <th style="width:36px;">★</th>
        <th>PROGRAM / SCHOLARSHIP</th>
        <th>UNIVERSITY / CONSORTIUM</th>
        <th>COUNTRY</th>
        <th>DEGREE</th>
        <th>FUNDING &amp; BENEFITS</th>
        <th>MATCH %</th>
        <th>DEADLINE</th>
        <th style="text-align: right;">ACTION</th>
      </tr>
    `;
  }
}

function renderRows(items) {
  if (!resultsBody) return;
  if (!items || items.length === 0) {
    resultsBody.innerHTML = '<tr><td colspan="9" class="empty-state">No matching opportunities found. Adjust your filters or keywords.</td></tr>';
    return;
  }

  if (activeTrack === "internships") {
    resultsBody.innerHTML = items.map((item) => {
      const bookmarked = isBookmarked(item.id, item.link);
      const applyBtn = item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.72rem; text-decoration: none;">Apply ↗</a>` : "";
      const aiBtn = `<button class="btn-primary" style="padding: 0.35rem 0.65rem; font-size: 0.72rem; margin-left: 0.35rem;" onclick='openAiModalFor(${JSON.stringify(item).replace(/'/g, "&#39;")}, "cover_letter")'>✨ AI Letter</button>`;
      const detailBtn = `<button class="btn-secondary" style="padding: 0.35rem 0.55rem; font-size: 0.72rem; margin-left: 0.35rem;" title="View Full Details" onclick='openDetailModal(${JSON.stringify(item).replace(/'/g, "&#39;")})'>🔍</button>`;
      const statusBadge = `<span class="priority-badge ${item.status === 'Upcoming' ? 'priority-Medium' : 'priority-High'}">${escapeHtml(item.status || 'Open')}</span>`;

      return `
        <tr>
          <td><button class="bookmark-btn ${bookmarked ? 'active' : ''}" onclick='toggleBookmark(${JSON.stringify(item).replace(/'/g, "&#39;")})'>★</button></td>
          <td><strong style="color: var(--text); font-size: 0.85rem;">${escapeHtml(item.title)}</strong></td>
          <td style="color: #e2e8f0; font-weight: 500;">${escapeHtml(item.institution_or_company || item.company || '—')}</td>
          <td><span class="source-tag">${escapeHtml(item.location || 'Remote')}</span></td>
          <td>${statusBadge} <span style="font-size: 0.72rem; color: var(--text-dim); margin-left: 0.3rem;">${escapeHtml(item.deadline || 'Rolling')}</span></td>
          <td style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-emerald); font-weight: 600;">${escapeHtml(item.stipend_amount || 'Paid Stipend')}</td>
          <td style="text-align: right; white-space: nowrap;">${applyBtn}${aiBtn}${detailBtn}</td>
        </tr>
      `;
    }).join("");
  } else if (activeTrack === "ra") {
    resultsBody.innerHTML = items.map((item) => {
      const bookmarked = isBookmarked(item.id, item.link);
      const labBtn = item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.72rem; text-decoration: none;">Lab Link ↗</a>` : "";
      const aiBtn = `<button class="btn-primary" style="padding: 0.35rem 0.65rem; font-size: 0.72rem; margin-left: 0.35rem;" onclick='openAiModalFor(${JSON.stringify(item).replace(/'/g, "&#39;")}, "cold_email_professor")'>✉️ Cold Email</button>`;
      const detailBtn = `<button class="btn-secondary" style="padding: 0.35rem 0.55rem; font-size: 0.72rem; margin-left: 0.35rem;" title="View Full Details" onclick='openDetailModal(${JSON.stringify(item).replace(/'/g, "&#39;")})'>🔍</button>`;
      
      return `
        <tr>
          <td><button class="bookmark-btn ${bookmarked ? 'active' : ''}" onclick='toggleBookmark(${JSON.stringify(item).replace(/'/g, "&#39;")})'>★</button></td>
          <td><strong style="color: var(--text); font-size: 0.85rem;">${escapeHtml(item.title)}</strong></td>
          <td><span style="color: #e2e8f0; font-weight: 500;">${escapeHtml(item.institution_or_company)}</span><br><span style="font-size: 0.7rem; color: var(--text-dim);">${escapeHtml(item.lab_name || '')}</span></td>
          <td style="color: #c084fc; font-weight: 600; font-size: 0.8rem;">${escapeHtml(item.professor_name || 'Faculty Committee')}</td>
          <td><span class="source-tag">${escapeHtml(item.research_domain || 'General')}</span></td>
          <td style="color: var(--accent-emerald); font-size: 0.75rem; font-weight: 600;">${escapeHtml(item.stipend_amount || item.funding_type || 'Fully Funded')}</td>
          <td style="font-size: 0.75rem; color: var(--accent-gold); font-family: var(--font-mono);">${escapeHtml(item.deadline || 'Open')}</td>
          <td style="text-align: right; white-space: nowrap;">${labBtn}${aiBtn}${detailBtn}</td>
        </tr>
      `;
    }).join("");
  } else {
    // grad scholarships
    resultsBody.innerHTML = items.map((item) => {
      const bookmarked = isBookmarked(item.id, item.link);
      const applyBtn = item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.72rem; text-decoration: none;">Portal ↗</a>` : "";
      const aiBtn = `<button class="btn-primary" style="padding: 0.35rem 0.65rem; font-size: 0.72rem; margin-left: 0.35rem;" onclick='openAiModalFor(${JSON.stringify(item).replace(/'/g, "&#39;")}, "sop")'>📝 SOP Draft</button>`;
      const detailBtn = `<button class="btn-secondary" style="padding: 0.35rem 0.55rem; font-size: 0.72rem; margin-left: 0.35rem;" title="View Full Details" onclick='openDetailModal(${JSON.stringify(item).replace(/'/g, "&#39;")})'>🔍</button>`;
      const matchScore = item.match_score || (item.priority === 'Top' ? 95 : 85);

      return `
        <tr>
          <td><button class="bookmark-btn ${bookmarked ? 'active' : ''}" onclick='toggleBookmark(${JSON.stringify(item).replace(/'/g, "&#39;")})'>★</button></td>
          <td><strong style="color: var(--text); font-size: 0.85rem;">${escapeHtml(item.title)}</strong></td>
          <td style="color: #e2e8f0; font-weight: 500;">${escapeHtml(item.institution_or_company)}</td>
          <td><span class="source-tag">${escapeHtml(item.country || item.location || 'Global')}</span></td>
          <td><span style="font-size: 0.75rem; color: #94a3b8; font-weight: 600;">${escapeHtml(item.degree_level || "Master's")}</span></td>
          <td style="color: var(--accent-emerald); font-size: 0.75rem; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600;" title="${escapeHtml(item.stipend_amount)}">${escapeHtml(item.stipend_amount || 'Fully Funded')}</td>
          <td><div class="match-mini-circle">${matchScore}%</div></td>
          <td style="font-size: 0.75rem; color: var(--accent-gold); font-family: var(--font-mono);">${escapeHtml(item.deadline || 'Annual')}</td>
          <td style="text-align: right; white-space: nowrap;">${applyBtn}${aiBtn}${detailBtn}</td>
        </tr>
      `;
    }).join("");
  }
}

function renderCurrentView() {
  if (activeTrack === "bookmarks") renderBookmarksTab();
  else if (activeTrack === "tracker") loadTrackerBoard();
  else renderRows(currentItems);
}

function updateMetrics(items, total) {
  if (totalCountEl) totalCountEl.textContent = String(total);
  
  const fullyFunded = items.filter(x => (x.funding_type || '').includes('Full') || (x.stipend_amount || '').includes('Tuition') || x.funding_type === 'Paid').length;
  if (fundedCountEl) fundedCountEl.textContent = String(fullyFunded);

  const topMatch = items.filter(x => (x.match_score && x.match_score >= 95) || x.priority === 'Top').length;
  if (topMatchCountEl) topMatchCountEl.textContent = String(topMatch || Math.ceil(items.length * 0.6));
}

function renderPagination(total, limit, offset) {
  if (!paginationEl) return;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  let html = `
    <button ${currentPage <= 1 ? "disabled" : ""} onclick="goToPage(1)">First</button>
    <button ${currentPage <= 1 ? "disabled" : ""} onclick="goToPage(${currentPage - 1})">Prev</button>
    <span>Page ${currentPage} of ${totalPages}</span>
    <button ${currentPage >= totalPages ? "disabled" : ""} onclick="goToPage(${currentPage + 1})">Next</button>
    <button ${currentPage >= totalPages ? "disabled" : ""} onclick="goToPage(${totalPages})">Last</button>
  `;
  paginationEl.innerHTML = html;
}

window.goToPage = function(page) {
  currentOffset = (page - 1) * perPageLimit;
  loadOpportunities();
};

// ── DETAIL POPUP MODAL ────────────────────────────────────────────────
function openDetailModal(item) {
  activeModalItem = item;
  const modal = document.getElementById("detailModal");
  if (!modal) return;

  const modalTitle = document.getElementById("modalTitle");
  const modalInstitution = document.getElementById("modalInstitution");
  const modalLocation = document.getElementById("modalLocation");
  const modalFunding = document.getElementById("modalFunding");
  const modalDegree = document.getElementById("modalDegree");
  const modalDeadline = document.getElementById("modalDeadline");
  const modalBenefits = document.getElementById("modalBenefits");
  const modalRequirements = document.getElementById("modalRequirements");
  const modalMatchScore = document.getElementById("modalMatchScore");
  const modalTrackBadge = document.getElementById("modalTrackBadge");
  const modalProfSection = document.getElementById("modalProfSection");
  const modalProfInfo = document.getElementById("modalProfInfo");
  const modalApplyLink = document.getElementById("modalApplyLink");

  if (modalTitle) modalTitle.textContent = item.title || "Opportunity Details";
  if (modalInstitution) modalInstitution.textContent = item.institution_or_company || item.company || "—";
  if (modalLocation) modalLocation.textContent = item.country || item.location || "Global";
  if (modalFunding) modalFunding.textContent = item.funding_type || "Funded";
  if (modalDegree) modalDegree.textContent = item.degree_level || "Any";
  if (modalDeadline) modalDeadline.textContent = item.deadline || "Open / Rolling";
  if (modalBenefits) modalBenefits.textContent = item.stipend_amount || item.description || "Full program coverage";
  if (modalRequirements) modalRequirements.textContent = item.requirements || "Undergraduate degree or relevant coursework in STEM / engineering.";
  if (modalMatchScore) modalMatchScore.textContent = `${item.match_score || 95}%`;

  if (modalTrackBadge) {
    modalTrackBadge.textContent = (item.category || "OPPORTUNITY").toUpperCase();
    modalTrackBadge.className = `track-badge ${item.category === 'ra' ? 'purple' : (item.category === 'masters_phd' ? 'gold' : 'blue')}`;
  }

  if (modalProfSection && modalProfInfo) {
    if (item.professor_name) {
      modalProfSection.style.display = "block";
      modalProfInfo.textContent = `${item.professor_name} (${item.lab_name || 'Research Lab'})`;
    } else {
      modalProfSection.style.display = "none";
    }
  }

  if (modalApplyLink) {
    modalApplyLink.href = item.link || "#";
  }

  modal.classList.remove("hidden");
}

document.getElementById("closeDetailModal")?.addEventListener("click", () => {
  document.getElementById("detailModal")?.classList.add("hidden");
});

document.getElementById("modalAiBtn")?.addEventListener("click", () => {
  if (activeModalItem) {
    document.getElementById("detailModal")?.classList.add("hidden");
    const defaultDocType = activeModalItem.category === "ra" ? "cold_email_professor" : (activeModalItem.category === "masters_phd" ? "sop" : "cover_letter");
    openAiModalFor(activeModalItem, defaultDocType);
  }
});

// ── 3-IN-1 AI CAREER & ACADEMIC SUITE ────────────────────────────────
function openAiModalFor(item, docType = "cover_letter") {
  activeModalItem = item;
  currentAiDocType = docType;

  const modal = document.getElementById("aiModal");
  const targetLabel = document.getElementById("aiTargetLabel");
  const aiContent = document.getElementById("aiContent");
  const aiLoading = document.getElementById("aiLoading");
  const aiActions = document.getElementById("aiActions");

  if (!modal) return;

  // Set active tab
  document.querySelectorAll(".ai-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.doctype === docType);
  });

  if (targetLabel) {
    targetLabel.textContent = `Target: ${item.title} at ${item.institution_or_company || item.company}`;
  }

  if (aiContent) aiContent.classList.add("hidden");
  if (aiActions) aiActions.classList.add("hidden");
  if (aiLoading) aiLoading.classList.remove("hidden");
  modal.classList.remove("hidden");

  executeAiGeneration();
}

async function executeAiGeneration() {
  if (!activeModalItem) return;

  const aiContent = document.getElementById("aiContent");
  const aiLoading = document.getElementById("aiLoading");
  const aiActions = document.getElementById("aiActions");

  aiLoading.classList.remove("hidden");
  aiContent.classList.add("hidden");
  aiActions.classList.add("hidden");

  try {
    const profileName = document.getElementById("profileFullName")?.value || localStorage.getItem("profileName") || "Applicant";
    const profileUni = document.getElementById("profileUniversity")?.value || localStorage.getItem("profileUni") || "University";
    const profileResume = document.getElementById("profileResumeText")?.value || localStorage.getItem("profileResume") || "";

    const payload = {
      doc_type: currentAiDocType,
      title: activeModalItem.title || "",
      institution_or_company: activeModalItem.institution_or_company || activeModalItem.company || "",
      location: activeModalItem.location || activeModalItem.country || "",
      professor_name: activeModalItem.professor_name || "",
      lab_name: activeModalItem.lab_name || "",
      research_domain: activeModalItem.research_domain || "",
      user_name: profileName,
      user_university: profileUni,
      resume_text: profileResume,
      user_skills: profileResume,
    };

    const resp = await fetch(`${DEFAULT_BASE}/generate-ai-doc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) throw new Error(`API returned ${resp.status}`);
    const data = await resp.json();

    const outputText = data.generated_text || data.cover_letter || "No text generated.";
    aiContent.textContent = outputText;

    aiLoading.classList.add("hidden");
    aiContent.classList.remove("hidden");
    aiActions.classList.remove("hidden");
  } catch (err) {
    aiLoading.innerHTML = `<p style="color: #ef4444;">❌ Generation failed: ${escapeHtml(err.message)}</p>`;
  }
}

// AI Modal Event Listeners
document.getElementById("closeAiModal")?.addEventListener("click", () => {
  document.getElementById("aiModal")?.classList.add("hidden");
});

document.querySelectorAll(".ai-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".ai-tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentAiDocType = btn.dataset.doctype;
    executeAiGeneration();
  });
});

document.getElementById("generateAiNowBtn")?.addEventListener("click", executeAiGeneration);

document.getElementById("copyAiBtn")?.addEventListener("click", () => {
  const text = document.getElementById("aiContent")?.textContent || "";
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById("copyAiBtn");
    btn.textContent = "✅ Copied!";
    setTimeout(() => { btn.textContent = "📋 Copy to Clipboard"; }, 2000);
  });
});

document.getElementById("quickAiBtn")?.addEventListener("click", () => {
  const dummy = currentItems[0] || {
    title: "Global Opportunity",
    institution_or_company: "Top University / Lab",
    research_domain: "AI / Robotics / Engineering"
  };
  openAiModalFor(dummy, "cover_letter");
});

// ── KANBAN APPLICATION TRACKER ────────────────────────────────────────
function loadTrackerBoard() {
  const bookmarks = getBookmarks();
  const statuses = ["Saved", "Applied", "Interviewing", "Accepted", "Rejected"];

  statuses.forEach(status => {
    const container = document.getElementById(`items${status}`);
    const countEl = document.getElementById(`count${status}`);
    if (!container) return;

    const items = bookmarks.filter(b => (b.status || "Saved") === status);
    if (countEl) countEl.textContent = items.length;

    if (!items.length) {
      container.innerHTML = `<p style="color: var(--text-dim); font-size: 0.7rem; text-align: center; padding: 1rem 0;">No items</p>`;
      return;
    }

    container.innerHTML = items.map(item => {
      const catBadge = item.category === 'ra' ? 'purple' : (item.category === 'masters_phd' ? 'gold' : 'blue');
      const catLabel = item.category === 'ra' ? 'RA LAB' : (item.category === 'masters_phd' ? 'GRAD SCHOLARSHIP' : 'INTERNSHIP');

      return `
        <div class="kanban-card" style="background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 0.65rem; margin-bottom: 0.5rem;">
          <span class="track-badge ${catBadge}" style="margin-bottom: 0.35rem; display: inline-block;">${catLabel}</span>
          <p style="color: var(--text); font-size: 0.78rem; font-weight: 600; margin-bottom: 0.25rem; line-height: 1.3;">${escapeHtml(item.title || 'Untitled')}</p>
          <p style="color: var(--text-muted); font-size: 0.68rem; margin-bottom: 0.5rem;">${escapeHtml(item.institution_or_company || item.company || '—')}</p>
          <select class="kanban-status-select" data-id="${escapeHtml(item.id || item.link)}" style="width: 100%; padding: 0.3rem; font-size: 0.68rem; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; cursor: pointer;">
            ${statuses.map(s => `<option value="${s}" ${s === status ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
      `;
    }).join("");
  });

  // Bind status changes
  document.querySelectorAll(".kanban-status-select").forEach(sel => {
    sel.addEventListener("change", (e) => {
      const itemId = e.target.dataset.id;
      const newStatus = e.target.value;
      const bookmarks = getBookmarks();
      const idx = bookmarks.findIndex(b => (b.id || b.link) === itemId);
      if (idx !== -1) {
        bookmarks[idx].status = newStatus;
        saveBookmarks(bookmarks);
        loadTrackerBoard();
      }
    });
  });
}

// ── BOOKMARKS TAB ─────────────────────────────────────────────────────
function renderBookmarksTab() {
  const bookmarks = getBookmarks();
  const body = document.getElementById("bookmarksBody");
  if (!body) return;

  if (!bookmarks.length) {
    body.innerHTML = '<tr><td colspan="8" class="empty-state">No saved bookmarks yet. Click the ★ icon on any listing to bookmark.</td></tr>';
    return;
  }

  body.innerHTML = bookmarks.map((item, idx) => {
    const catBadge = item.category === 'ra' ? 'purple' : (item.category === 'masters_phd' ? 'gold' : 'blue');
    const catLabel = item.category === 'ra' ? 'RA' : (item.category === 'masters_phd' ? 'GRAD' : 'INTERN');
    const link = item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" class="btn-ghost" style="padding: 0.25rem 0.5rem; font-size: 0.72rem;">Open</a>` : "—";
    const aiBtn = `<button class="btn-primary" style="padding: 0.25rem 0.5rem; font-size: 0.72rem; margin-left: 0.25rem;" onclick='openAiModalFor(${JSON.stringify(item).replace(/'/g, "&#39;")})'>✨ AI</button>`;

    return `
      <tr>
        <td><button class="bookmark-btn active" onclick='toggleBookmark(${JSON.stringify(item).replace(/'/g, "&#39;")})'>★</button></td>
        <td><span class="track-badge ${catBadge}">${catLabel}</span></td>
        <td><strong style="color: var(--text);">${escapeHtml(item.title)}</strong></td>
        <td>${escapeHtml(item.institution_or_company || item.company || '—')}</td>
        <td>${escapeHtml(item.country || item.location || 'Global')}</td>
        <td style="color: var(--green); font-size: 0.75rem;">${escapeHtml(item.stipend_amount || item.funding_type || 'Funded')}</td>
        <td style="color: var(--amber); font-size: 0.75rem;">${escapeHtml(item.deadline || 'Open')}</td>
        <td style="white-space: nowrap;">${link}${aiBtn}</td>
      </tr>
    `;
  }).join("");
}

// ── ANALYTICS WITH CHART.JS ───────────────────────────────────────────
let chartInstances = {};
function destroyCharts() {
  Object.values(chartInstances).forEach(c => { if (c) c.destroy(); });
  chartInstances = {};
}

const CHART_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];

async function loadAnalytics() {
  try {
    const resp = await fetch(`${DEFAULT_BASE}/analytics`);
    if (!resp.ok) return;
    const data = await resp.json();
    renderAnalytics(data);
  } catch (e) {
    console.error("Analytics fetch failed:", e);
  }
}

function renderAnalytics(data) {
  destroyCharts();

  // 1. By Track (Category)
  const catCtx = document.getElementById("categoryChartCanvas");
  if (catCtx) {
    const catLabels = { internship: "Upcoming Internships", ra: "RA Opportunities", masters_phd: "Funded Grad Scholarships" };
    const rawCat = data.by_category || {};
    chartInstances.cat = new Chart(catCtx, {
      type: "doughnut",
      data: {
        labels: Object.keys(rawCat).map(k => catLabels[k] || k),
        datasets: [{ data: Object.values(rawCat), backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b'], borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: "#94a3b8", font: { size: 11 } } } } }
    });
  }

  // 2. By Country
  const locCtx = document.getElementById("locationChartCanvas");
  if (locCtx) {
    const byCountry = data.by_country || {};
    chartInstances.loc = new Chart(locCtx, {
      type: "bar",
      data: {
        labels: Object.keys(byCountry),
        datasets: [{ label: "Opportunities", data: Object.values(byCountry), backgroundColor: "#3b82f6", borderRadius: 4 }]
      },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } }, y: { ticks: { color: "#94a3b8" } } } }
    });
  }

  // 3. Top Domains
  const domCtx = document.getElementById("keywordChartCanvas");
  if (domCtx) {
    const byDomain = data.by_domain || {};
    chartInstances.dom = new Chart(domCtx, {
      type: "bar",
      data: {
        labels: Object.keys(byDomain),
        datasets: [{ label: "Programs", data: Object.values(byDomain), backgroundColor: CHART_COLORS, borderRadius: 4 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#94a3b8", font: { size: 9 }, maxRotation: 45 }, grid: { display: false } }, y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.05)" } } } }
    });
  }

  // 4. Funding Breakdown
  const fundCtx = document.getElementById("timelineChartCanvas");
  if (fundCtx) {
    const byFunding = data.by_funding || {};
    chartInstances.fund = new Chart(fundCtx, {
      type: "doughnut",
      data: {
        labels: Object.keys(byFunding),
        datasets: [{ data: Object.values(byFunding), backgroundColor: ['#10b981', '#06b6d4', '#3b82f6', '#f59e0b'], borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: "#94a3b8", font: { size: 10 } } } } }
    });
  }
}

// ── CSV EXPORT ────────────────────────────────────────────────────────
function exportToCSV(items, filename = "opportunities.csv") {
  if (!items.length) {
    setStatus("No items to export", true);
    return;
  }

  const headers = ["Track", "Title", "Institution / Company", "Location / Country", "Degree", "Funding", "Stipend", "Deadline", "Link"];
  const rows = items.map(i => [
    i.category || activeTrack,
    i.title || "",
    i.institution_or_company || i.company || "",
    i.country || i.location || "",
    i.degree_level || "",
    i.funding_type || "",
    i.stipend_amount || "",
    i.deadline || "",
    i.link || ""
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  setStatus(`Exported ${items.length} records to CSV`);
}

// ── EVENT LISTENERS & INITIALIZATION ──────────────────────────────────
document.querySelectorAll(".nav-btn").forEach(btn => {
  if (btn.dataset.tab) {
    btn.addEventListener("click", () => setTrack(btn.dataset.tab));
  }
});

// Domain chips
document.querySelectorAll("#domainChips .source-toggle").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#domainChips .source-toggle").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedDomain = btn.dataset.domain;
    currentOffset = 0;
    loadOpportunities();
  });
});

if (loadBtn) loadBtn.addEventListener("click", () => { currentOffset = 0; loadOpportunities(); });
if (refreshBtn) refreshBtn.addEventListener("click", () => { loadOpportunities(); });
if (exportBtn) exportBtn.addEventListener("click", () => exportToCSV(currentItems, `${activeTrack}_opportunities.csv`));

if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    if (keywordInput) keywordInput.value = "";
    if (countryFilterSelect) countryFilterSelect.value = "all";
    if (fundingFilterSelect) fundingFilterSelect.value = "all";
    if (degreeFilterSelect) degreeFilterSelect.value = "all";
    if (sortBySelect) sortBySelect.value = "latest";
    selectedDomain = "all";
    document.querySelectorAll("#domainChips .source-toggle").forEach((b, i) => b.classList.toggle("active", i === 0));
    currentOffset = 0;
    loadOpportunities();
  });
}

document.getElementById("exportBookmarksBtn")?.addEventListener("click", () => {
  exportToCSV(getBookmarks(), "my_saved_opportunities.csv");
});

document.getElementById("clearBookmarksBtn")?.addEventListener("click", () => {
  if (confirm("Clear all saved bookmarks?")) {
    saveBookmarks([]);
    renderBookmarksTab();
  }
});

// Theme Toggle
function initThemeToggle() {
  const toggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');
  if (!toggleBtn) return;

  const currentTheme = localStorage.getItem('theme') || 'dark';
  if (currentTheme === 'dark') document.body.classList.add('dark-theme');

  toggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });
}

// Profile Save / Load
async function loadProfile() {
  const name = localStorage.getItem("profileName") || "";
  const uni = localStorage.getItem("profileUni") || "";
  const exp = localStorage.getItem("profileExp") || "Undergraduate Student";
  const major = localStorage.getItem("profileMajor") || "";
  const resume = localStorage.getItem("profileResume") || "";

  if (document.getElementById("profileFullName")) document.getElementById("profileFullName").value = name;
  if (document.getElementById("profileUniversity")) document.getElementById("profileUniversity").value = uni;
  if (document.getElementById("profileExperience")) document.getElementById("profileExperience").value = exp;
  if (document.getElementById("profileMajor")) document.getElementById("profileMajor").value = major;
  if (document.getElementById("profileResumeText")) document.getElementById("profileResumeText").value = resume;
}

document.getElementById("saveProfileBtn")?.addEventListener("click", () => {
  const name = document.getElementById("profileFullName")?.value || "";
  const uni = document.getElementById("profileUniversity")?.value || "";
  const exp = document.getElementById("profileExperience")?.value || "";
  const major = document.getElementById("profileMajor")?.value || "";
  const resume = document.getElementById("profileResumeText")?.value || "";

  localStorage.setItem("profileName", name);
  localStorage.setItem("profileUni", uni);
  localStorage.setItem("profileExp", exp);
  localStorage.setItem("profileMajor", major);
  localStorage.setItem("profileResume", resume);

  const status = document.getElementById("profileSaveStatus");
  if (status) {
    status.style.display = "inline";
    setTimeout(() => { status.style.display = "none"; }, 3000);
  }
});

// App Bootstrap
(async function init() {
  initThemeToggle();
  updateBookmarkCount();
  await checkAuth();
  loadProfile();
  loadOpportunities();
})();