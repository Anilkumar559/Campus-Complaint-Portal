/**
 * SRM UNIVERSITY AP - CAMPUS GRIEVANCE & FACILITY PORTAL
 * Client-Side Application Logic with Real-Time C++ Backend Integration,
 * Google Sign-In (Firebase Auth with hd: srmap.edu.in restriction),
 * Dual-Role Access (Student Login & Admin Login),
 * and Strict Student Privacy Isolation.
 */

(() => {
  // Safe Storage Abstraction: handles Private Browsing, disabled cookies, and storage quota limits safely
  const SafeStorage = {
    memory: {},
    isAvailable(type = "local") {
      try {
        const storage = window[type + "Storage"];
        if (!storage) return false;
        const testKey = "__srm_storage_test__";
        storage.setItem(testKey, testKey);
        storage.removeItem(testKey);
        return true;
      } catch (e) {
        return false;
      }
    },
    getItem(key, type = "local") {
      try {
        if (this.isAvailable(type)) {
          return window[type + "Storage"].getItem(key);
        }
      } catch (e) {}
      return this.memory[type + ":" + key] || null;
    },
    setItem(key, value, type = "local") {
      try {
        if (this.isAvailable(type)) {
          window[type + "Storage"].setItem(key, String(value));
          return;
        }
      } catch (e) {}
      this.memory[type + ":" + key] = String(value);
    },
    removeItem(key, type = "local") {
      try {
        if (this.isAvailable(type)) {
          window[type + "Storage"].removeItem(key);
          return;
        }
      } catch (e) {}
      delete this.memory[type + ":" + key];
    }
  };

  // Application State
  const state = {
    user: null, // { role: 'student'|'admin', name: '', rollNumber: '', email: '', department: '', provider: '' }
    complaints: [],
    search: "",
    priority: "ALL",
    status: "ALL",
    category: "ALL",
    campusBlock: "ALL",
    submissionDate: ""
  };

  // Firebase Authentication Instance & Google Provider
  let firebaseAuth = null;
  let googleAuthProvider = null;
  let isFirebaseConfigured = false;
  let isAuthInProgress = false;
  let authListenerUnsubscribe = null;

  // Initialize Firebase with Google Auth Provider
  function initFirebase() {
    const config = window.SRM_FIREBASE_CONFIG;
    if (config && config.apiKey && config.apiKey !== "YOUR_FIREBASE_API_KEY" && typeof firebase !== "undefined") {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(config);
        }
        firebaseAuth = firebase.auth();
        googleAuthProvider = new firebase.auth.GoogleAuthProvider();

        // Restricts the Google account chooser to @srmap.edu.in
        googleAuthProvider.setCustomParameters({
          hd: "srmap.edu.in",
          prompt: "select_account"
        });

        // Set persistence to LOCAL if storage is available
        try {
          firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } catch (pErr) {
          console.warn("Firebase persistence notice:", pErr.message);
        }

        isFirebaseConfigured = true;
        console.log("Firebase Auth initialized with Google Provider");

        // Maintain real-time auth state with single listener (handles page refresh & multi-tab sessions)
        if (!authListenerUnsubscribe) {
          authListenerUnsubscribe = firebaseAuth.onAuthStateChanged(handleAuthStateChanged);
        }

        // Silent redirect result check (only activates if redirect auth was explicitly completed)
        firebaseAuth.getRedirectResult().then(async (result) => {
          if (result && result.user) {
            const pendingRole = SafeStorage.getItem("srm_auth_role", "session") || "student";
            SafeStorage.removeItem("srm_auth_role", "session");
            await processGoogleLogin(result.user, pendingRole);
          }
        }).catch((err) => {
          // Gracefully suppress expected non-redirect direct page load exceptions
          if (err.code === "auth/missing-initial-state" || err.code === "auth/null-user" || err.code === "auth/no-auth-event") {
            console.debug("Standard direct load (no redirect state required).");
            return;
          }
          console.warn("Redirect handler notice:", err.code, err.message);
        });
      } catch (err) {
        console.warn("Firebase could not be initialized:", err.message);
      }
    }
  }

  // DOM Elements
  const els = {
    // Top Views
    loginSection: document.getElementById("loginSection"),
    dashboardSection: document.getElementById("dashboardSection"),

    // Homepage Action Buttons (Google Sign-In)
    googleSignInBtn: document.getElementById("googleSignInBtn"),
    btnWardenLogin: document.getElementById("btnWardenLogin"),
    btnSecurityLogin: document.getElementById("btnSecurityLogin"),
    btnAdminLogin: document.getElementById("btnAdminLogin"),
    btnStudentManualModal: document.getElementById("btnStudentManualModal"),

    // Access Denied Modal (for unauthorized Google accounts attempting Admin Login)
    accessDeniedModal: document.getElementById("accessDeniedModal"),
    deniedEmailText: document.getElementById("deniedEmailText"),
    btnContinueAsStudent: document.getElementById("btnContinueAsStudent"),
    btnCloseAccessDenied: document.getElementById("btnCloseAccessDenied"),

    // User-Friendly Authentication Alert Modal (for domain, popup, network alerts)
    authAlertModal: document.getElementById("authAlertModal"),
    authAlertIcon: document.getElementById("authAlertIcon"),
    authAlertTitle: document.getElementById("authAlertTitle"),
    authAlertMessage: document.getElementById("authAlertMessage"),
    domainHelperBox: document.getElementById("domainHelperBox"),
    currentHostnameCode: document.getElementById("currentHostnameCode"),
    btnCopyHostname: document.getElementById("btnCopyHostname"),
    btnRetryAuth: document.getElementById("btnRetryAuth"),
    btnCloseAuthAlert: document.getElementById("btnCloseAuthAlert"),

    // Separate Modal: Direct Google Account Verification (When Offline)
    googleAccountModal: document.getElementById("googleAccountModal"),
    customGoogleForm: document.getElementById("customGoogleForm"),
    customGoogleName: document.getElementById("customGoogleName"),
    customGoogleEmail: document.getElementById("customGoogleEmail"),
    customGoogleRole: document.getElementById("customGoogleRole"),
    submitCustomGoogleBtn: document.getElementById("submitCustomGoogleBtn"),
    closeGoogleModalBtn: document.getElementById("closeGoogleModalBtn"),

    // Administrator Roster Management
    adminPrivilegesCard: document.getElementById("adminPrivilegesCard"),
    addAdminForm: document.getElementById("addAdminForm"),
    newAdminEmail: document.getElementById("newAdminEmail"),
    btnAddAdmin: document.getElementById("btnAddAdmin"),
    adminRosterUl: document.getElementById("adminRosterUl"),
    adminCountBadge: document.getElementById("adminCountBadge"),

    // Dashboard Header & Session
    serverStatus: document.getElementById("serverStatus"),
    userAvatar: document.getElementById("userAvatar"),
    sessionUserName: document.getElementById("sessionUserName"),
    sessionUserRoleBadge: document.getElementById("sessionUserRoleBadge"),
    sessionUserSubtext: document.getElementById("sessionUserSubtext"),
    logoutBtn: document.getElementById("logoutBtn"),
    refreshBtn: document.getElementById("refreshBtn"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),

    // Administrative CSV Export Elements
    adminExportCard: document.getElementById("adminExportCard"),
    btnExportAll: document.getElementById("btnExportAll"),
    btnExportPending: document.getElementById("btnExportPending"),
    btnExportInProgress: document.getElementById("btnExportInProgress"),
    btnExportResolved: document.getElementById("btnExportResolved"),
    exportCategorySelect: document.getElementById("exportCategorySelect"),
    btnExportCategory: document.getElementById("btnExportCategory"),

    // Complaint Details Modal Elements
    complaintDetailsModal: document.getElementById("complaintDetailsModal"),
    modalTicketId: document.getElementById("modalTicketId"),
    modalDetailStatus: document.getElementById("modalDetailStatus"),
    modalDetailPriority: document.getElementById("modalDetailPriority"),
    modalDetailCategory: document.getElementById("modalDetailCategory"),
    modalStudentName: document.getElementById("modalStudentName"),
    modalRollNumber: document.getElementById("modalRollNumber"),
    modalStudentEmail: document.getElementById("modalStudentEmail"),
    modalLocation: document.getElementById("modalLocation"),
    modalDescription: document.getElementById("modalDescription"),
    modalCreatedAt: document.getElementById("modalCreatedAt"),
    modalUpdatedAt: document.getElementById("modalUpdatedAt"),
    modalAdminControlsSection: document.getElementById("modalAdminControlsSection"),
    modalStatusSelect: document.getElementById("modalStatusSelect"),
    modalTechnicianInput: document.getElementById("modalTechnicianInput"),
    modalRemarksTextarea: document.getElementById("modalRemarksTextarea"),
    btnCloseDetailHeader: document.getElementById("btnCloseDetailHeader"),
    btnCloseDetailModal: document.getElementById("btnCloseDetailModal"),
    btnSaveDetailModal: document.getElementById("btnSaveDetailModal"),
    btnDeleteDetailModal: document.getElementById("btnDeleteDetailModal"),

    // Sub-banner
    roleBannerIcon: document.getElementById("roleBannerIcon"),
    roleBannerTitle: document.getElementById("roleBannerTitle"),
    roleBannerDesc: document.getElementById("roleBannerDesc"),

    // KPI Summary
    statLabelTotal: document.getElementById("statLabelTotal"),
    statSubTotal: document.getElementById("statSubTotal"),
    totalCount: document.getElementById("totalCount"),
    highPriorityCount: document.getElementById("highPriorityCount"),
    pendingCount: document.getElementById("pendingCount"),
    progressCount: document.getElementById("progressCount"),
    resolvedCount: document.getElementById("resolvedCount"),

    // Left Panel Cards
    studentFormCard: document.getElementById("studentFormCard"),
    adminActionCard: document.getElementById("adminActionCard"),
    complaintForm: document.getElementById("complaintForm"),
    submitBtn: document.getElementById("submitBtn"),
    studentName: document.getElementById("studentName"),
    rollNumber: document.getElementById("rollNumber"),
    studentEmail: document.getElementById("studentEmail"),
    campusBlockSelect: document.getElementById("campusBlockSelect"),
    roomNumber: document.getElementById("roomNumber"),
    category: document.getElementById("category"),
    description: document.getElementById("description"),
    charCount: document.getElementById("charCount"),
    detectedPriorityBadge: document.getElementById("detectedPriorityBadge"),

    // Admin Dispatch Shortcuts
    adminCriticalCount: document.getElementById("adminCriticalCount"),
    adminUnassignedCount: document.getElementById("adminUnassignedCount"),
    filterHighUrgentBtn: document.getElementById("filterHighUrgentBtn"),
    filterPendingBtn: document.getElementById("filterPendingBtn"),
    filterGangaHostelBtn: document.getElementById("filterGangaHostelBtn"),
    resetAdminFiltersBtn: document.getElementById("resetAdminFiltersBtn"),

    // Right List & Filters
    queueEyebrow: document.getElementById("queueEyebrow"),
    queueHeaderTitle: document.getElementById("queueHeaderTitle"),
    queueHeaderSub: document.getElementById("queueHeaderSub"),
    searchInput: document.getElementById("searchInput"),
    priorityFilter: document.getElementById("priorityFilter"),
    statusFilter: document.getElementById("statusFilter"),
    categoryFilter: document.getElementById("categoryFilter"),
    campusBlockFilter: document.getElementById("campusBlockFilter"),
    dateFilter: document.getElementById("dateFilter"),
    clearDateBtn: document.getElementById("clearDateBtn"),
    container: document.getElementById("complaintsContainer"),
    toastContainer: document.getElementById("toastContainer")
  };

  // Auto-priority rule engine (matches C++ ComplaintManager::determinePriority)
  function calculateAutoPriority(category, description) {
    const text = `${category || ""} ${description || ""}`.toLowerCase();
    const highKeywords = [
      "fire", "spark", "short circuit", "shock", "hazard", "emergency", "urgent",
      "flood", "burst", "no water", "no electricity", "power outage", "blackout",
      "broken lock", "security", "smoke", "gas", "danger", "medical", "leakage", "overflow",
      "geyser", "snake", "theft", "burning", "elevator", "lift stuck", "ceiling fall"
    ];

    if (highKeywords.some((kw) => text.includes(kw))) {
      return "High";
    }

    const cat = (category || "").toLowerCase();
    if (cat.includes("electrical") || cat.includes("plumbing") || cat.includes("security")) {
      return "High";
    }
    if (cat.includes("wi-fi") || cat.includes("internet") || cat.includes("hostel") ||
        cat.includes("mess") || cat.includes("air conditioning") ||
        cat.includes("classroom") || cat.includes("lab")) {
      return "Medium";
    }
    if (cat.includes("cleanliness") || cat.includes("library") || cat.includes("other")) {
      return "Low";
    }
    return "Medium";
  }

  function resolveEffectivePriority(complaint) {
    if (complaint.priority === "High" || complaint.priority === "Medium" || complaint.priority === "Low") {
      return complaint.priority;
    }
    return calculateAutoPriority(complaint.category, complaint.description);
  }

  function updateAutoPriorityPreview() {
    if (!els.detectedPriorityBadge || !els.category || !els.description) return;
    const prio = calculateAutoPriority(els.category.value, els.description.value);
    els.detectedPriorityBadge.textContent = `${prio} Priority`;
    els.detectedPriorityBadge.className = `prio-badge prio-${prio.toLowerCase()}`;
  }

  function showToast(message, type = "info") {
    if (!els.toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    els.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  function setServerOnline(online) {
    if (!els.serverStatus) return;
    els.serverStatus.style.display = "none";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  function statusBadgeClass(status) {
    if (status === "Resolved") return "badge badge-resolved";
    if (status === "In Progress") return "badge badge-progress";
    return "badge badge-pending";
  }

  function priorityBadgeClass(priority) {
    const p = (priority || "Medium").toLowerCase();
    if (p === "high") return "prio-badge prio-high";
    if (p === "low") return "prio-badge prio-low";
    return "prio-badge prio-medium";
  }

  // Strict University Email Domain Validator:
  // Strictly requires username@srmap.edu.in (case-insensitive, no subdomains, no extra @)
  function isStrictSrmapEmail(email) {
    if (!email || typeof email !== "string") return false;
    const clean = email.trim().toLowerCase();
    const parts = clean.split("@");
    if (parts.length !== 2) return false;
    const username = parts[0];
    const domain = parts[1];
    if (!username || username.length === 0) return false;
    return domain === "srmap.edu.in";
  }

  function validateSrmEmail(email) {
    return isStrictSrmapEmail(email);
  }

  // Extracts full name and registration number from Google Display Name
  // Expected format: "Full Name | Registration Number" (e.g. "Sarath Kumar Kondaveeti | AP25110010838")
  function extractStudentIdentityFromProfile(displayName) {
    if (!displayName || typeof displayName !== "string") {
      return { name: "", rollNumber: "", valid: false };
    }

    const separatorIndex = displayName.indexOf("|");
    if (separatorIndex === -1) {
      return { name: "", rollNumber: "", valid: false };
    }

    const name = displayName.substring(0, separatorIndex).trim();
    const rollNumber = displayName.substring(separatorIndex + 1).trim();

    if (!name || !rollNumber) {
      return { name, rollNumber, valid: false };
    }

    return { name, rollNumber, valid: true };
  }

  // =========================================================
  // AUTHENTICATION & SESSION MANAGEMENT
  // =========================================================
  function initSession() {
    const saved = SafeStorage.getItem("srm_user_session", "local");
    if (saved) {
      try {
        state.user = JSON.parse(saved);
        showDashboard();
        return;
      } catch (e) {
        SafeStorage.removeItem("srm_user_session", "local");
      }
    }
    showLogin();
  }

  function showLogin() {
    state.user = null;
    if (els.dashboardSection) els.dashboardSection.style.display = "none";
    if (els.loginSection) els.loginSection.style.display = "flex";
  }

  function showDashboard() {
    if (els.loginSection) els.loginSection.style.display = "none";
    if (els.dashboardSection) els.dashboardSection.style.display = "block";

    const user = state.user;
    if (!user) return;
    const isStudent = user.role === "student";

    // Update Header Profile Badge
    if (els.userAvatar) els.userAvatar.textContent = (user.name || "U").charAt(0).toUpperCase();
    if (els.sessionUserName) els.sessionUserName.textContent = user.name || (isStudent ? "SRM AP Student" : "Facility Admin");
    if (els.sessionUserSubtext) els.sessionUserSubtext.textContent = isStudent ? (user.rollNumber || user.email) : (user.department || user.email);

    if (els.sessionUserRoleBadge) {
      els.sessionUserRoleBadge.textContent = isStudent ? "Student" : "Admin";
      els.sessionUserRoleBadge.className = isStudent ? "role-badge role-student" : "role-badge role-admin";
    }

    // STRICT STUDENT PRIVACY ISOLATION:
    if (isStudent) {
      if (els.roleBannerIcon) els.roleBannerIcon.textContent = "🎓";
      if (els.roleBannerTitle) els.roleBannerTitle.textContent = "Student Self-Service Portal";
      if (els.roleBannerDesc) {
        els.roleBannerDesc.textContent = `Logged in as ${user.name} (${user.rollNumber || user.email}). Displaying grievances registered by your account. Other students' complaints are strictly private.`;
      }

      if (els.statLabelTotal) els.statLabelTotal.textContent = "My Total Tickets";
      if (els.statSubTotal) els.statSubTotal.textContent = "Registered under your account";

      if (els.studentFormCard) els.studentFormCard.style.display = "block";
      if (els.adminActionCard) els.adminActionCard.style.display = "none";
      if (els.adminPrivilegesCard) els.adminPrivilegesCard.style.display = "none";
      if (els.adminExportCard) els.adminExportCard.style.display = "none";

      // Pre-fill Student Form with authenticated user credentials (strictly read-only)
      if (els.studentName) {
        els.studentName.value = user.name || "";
        els.studentName.readOnly = true;
      }
      if (els.rollNumber) {
        els.rollNumber.value = user.rollNumber || "";
        els.rollNumber.readOnly = true;
      }
      if (els.studentEmail) {
        els.studentEmail.value = user.email || "";
        els.studentEmail.readOnly = true;
      }

      // Check whether Google display name has valid Full Name | Roll format
      const profileNotice = document.getElementById("studentProfileNotice");
      if (profileNotice) {
        if (!user.name || !user.rollNumber) {
          profileNotice.style.display = "block";
          if (els.submitBtn) {
            els.submitBtn.disabled = true;
            els.submitBtn.textContent = "Google Profile Update Required";
          }
        } else {
          profileNotice.style.display = "none";
          if (els.submitBtn) {
            els.submitBtn.disabled = false;
            els.submitBtn.textContent = "Submit Grievance Ticket →";
          }
        }
      }

      if (els.queueEyebrow) els.queueEyebrow.textContent = "Personal Grievances";
      if (els.queueHeaderTitle) els.queueHeaderTitle.textContent = "My Registered Grievances";
      if (els.queueHeaderSub) {
        els.queueHeaderSub.textContent = "Displaying only complaints filed by you. Other students' complaints are kept strictly private.";
      }
    } else {
      if (els.roleBannerIcon) els.roleBannerIcon.textContent = "🏛️";
      if (els.roleBannerTitle) els.roleBannerTitle.textContent = "Facility & Maintenance Command Center";
      if (els.roleBannerDesc) {
        els.roleBannerDesc.textContent = `Logged in as ${user.name} (${user.department || "Directorate of Facilities"}). Administrative clearance to inspect and update all university tickets.`;
      }

      if (els.statLabelTotal) els.statLabelTotal.textContent = "Total Campus Tickets";
      if (els.statSubTotal) els.statSubTotal.textContent = "All student grievances across SRM AP";

      if (els.studentFormCard) els.studentFormCard.style.display = "none";
      if (els.adminActionCard) els.adminActionCard.style.display = "block";
      if (els.adminPrivilegesCard) els.adminPrivilegesCard.style.display = "block";
      if (els.adminExportCard) els.adminExportCard.style.display = "block";
      fetchAdminRoster();

      if (els.queueEyebrow) els.queueEyebrow.textContent = "Master Queue";
      if (els.queueHeaderTitle) els.queueHeaderTitle.textContent = "Campus Complaint Master Directory";
      if (els.queueHeaderSub) {
        els.queueHeaderSub.textContent = "Full administrative access: update statuses, assign maintenance technicians, and record resolution notes.";
      }
    }

    fetchComplaints(true);
  }

  function handleLogout() {
    SafeStorage.removeItem("srm_user_session", "local");
    SafeStorage.removeItem("srm_user_role", "local");
    SafeStorage.removeItem("srm_auth_role", "session");

    if (firebaseAuth) {
      try {
        firebaseAuth.signOut().catch((e) => console.warn("Sign out notice:", e));
      } catch (e) {}
    }

    lastGoogleUser = null;
    state.user = null;
    showToast("Logged out of SRM University-AP Portal.", "info");
    showLogin();
  }

  // =========================================================
  // API CALLS & DATA HANDLING
  // =========================================================
  async function fetchComplaints(silent = false) {
    try {
      const user = state.user;
      let url = "/api/complaints";

      // Strict Privacy: Pass student credentials or admin authorization
      if (user && user.role === "student") {
        const params = new URLSearchParams();
        if (user.email) params.append("email", user.email);
        if (user.rollNumber) params.append("rollNumber", user.rollNumber);
        url += `?${params.toString()}`;
      } else if (user && user.role === "admin") {
        const params = new URLSearchParams();
        if (user.email) params.append("adminEmail", user.email);
        url += `?${params.toString()}`;
      }

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load complaints");
      state.complaints = await res.json();
      setServerOnline(true);

      // Avoid tearing down DOM elements while the user is actively typing or selecting
      const activeEl = document.activeElement;
      const isActivelyEditing = activeEl && (
        (els.container && els.container.contains(activeEl) && (activeEl.tagName === "INPUT" || activeEl.tagName === "SELECT" || activeEl.tagName === "TEXTAREA")) ||
        (els.adminTableBody && els.adminTableBody.contains(activeEl) && (activeEl.tagName === "INPUT" || activeEl.tagName === "SELECT")) ||
        (els.searchInput && els.searchInput === activeEl) ||
        (els.adminSearchInput && els.adminSearchInput === activeEl)
      );

      if (!silent || !isActivelyEditing) {
        render();
      } else {
        updateStats();
      }

      if (!silent) showToast("Records synchronized successfully", "success");
    } catch (err) {
      setServerOnline(false);
      if (els.container) {
        els.container.innerHTML = `<div class="empty-state">Unable to reach grievance services at <strong>http://localhost:8080</strong>.<br/>Please ensure the server is running.</div>`;
      }
    }
  }

  function updateStats() {
    const isStudent = state.user && state.user.role === "student";
    const myRoll = (isStudent ? state.user.rollNumber || "" : "").toLowerCase();
    const myEmail = (isStudent ? state.user.email || "" : "").toLowerCase();

    let total = 0;
    let highPriority = 0;
    let pending = 0;
    let progress = 0;
    let resolved = 0;

    for (const c of state.complaints) {
      if (isStudent) {
        const cRoll = (c.rollNumber || "").toLowerCase();
        const cEmail = (c.studentEmail || "").toLowerCase();
        const isMine = (myRoll && cRoll === myRoll) || (myEmail && cEmail === myEmail);
        if (!isMine) continue;
      }

      total++;
      const prio = resolveEffectivePriority(c);
      if (prio === "High" && c.status !== "Resolved") {
        highPriority++;
      }
      if (c.status === "Resolved") resolved++;
      else if (c.status === "In Progress") progress++;
      else pending++;
    }

    if (els.totalCount) els.totalCount.textContent = total;
    if (els.highPriorityCount) els.highPriorityCount.textContent = highPriority;
    if (els.pendingCount) els.pendingCount.textContent = pending;
    if (els.progressCount) els.progressCount.textContent = progress;
    if (els.resolvedCount) els.resolvedCount.textContent = resolved;

    if (els.adminCriticalCount) els.adminCriticalCount.textContent = highPriority;
    if (els.adminUnassignedCount) els.adminUnassignedCount.textContent = pending;
  }

  function getFilteredComplaints() {
    const q = state.search.trim().toLowerCase();
    const isStudent = state.user && state.user.role === "student";
    const myRoll = (isStudent ? state.user.rollNumber || "" : "").toLowerCase();
    const myEmail = (isStudent ? state.user.email || "" : "").toLowerCase();

    return state.complaints
      .filter((c) => {
        // STRICT STUDENT ISOLATION: A student ONLY ever sees his/her own complaints!
        if (isStudent) {
          const cRoll = (c.rollNumber || "").toLowerCase();
          const cEmail = (c.studentEmail || "").toLowerCase();
          const isMine = (myRoll && cRoll === myRoll) || (myEmail && cEmail === myEmail);
          if (!isMine) return false;
        }

        const prio = resolveEffectivePriority(c);
        if (state.priority !== "ALL" && prio !== state.priority) return false;
        if (state.status !== "ALL" && c.status !== state.status) return false;
        if (state.category !== "ALL" && c.category !== state.category) return false;

        // Campus block filter
        if (state.campusBlock && state.campusBlock !== "ALL") {
          const loc = (c.roomNumber || "").toLowerCase();
          if (!loc.includes(state.campusBlock.toLowerCase())) return false;
        }

        // Submission date filter (exact YYYY-MM-DD match)
        if (state.submissionDate) {
          const createdDate = (c.createdAt || "").slice(0, 10);
          if (createdDate !== state.submissionDate) return false;
        }

        if (!q) return true;
        return (
          String(c.id).includes(q) ||
          (c.studentName || "").toLowerCase().includes(q) ||
          (c.rollNumber || "").toLowerCase().includes(q) ||
          (c.studentEmail || "").toLowerCase().includes(q) ||
          (c.roomNumber || "").toLowerCase().includes(q) ||
          (c.category || "").toLowerCase().includes(q) ||
          prio.toLowerCase().includes(q) ||
          (c.status || "").toLowerCase().includes(q) ||
          (c.description || "").toLowerCase().includes(q) ||
          (c.assignedTechnician || "").toLowerCase().includes(q) ||
          (c.adminRemarks || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.id - a.id);
  }

  function render() {
    updateStats();
    const filtered = getFilteredComplaints();
    const isAdmin = state.user && state.user.role === "admin";
    const isStudent = state.user && state.user.role === "student";

    if (!els.container) return;

    if (filtered.length === 0) {
      const msg = isStudent
        ? `You have not registered any grievances yet, or none match your current filter.<br/>Use the form on the left to submit a campus issue.`
        : `No campus complaints match your current search or filter criteria.`;
      els.container.innerHTML = `<div class="empty-state">${msg}</div>`;
      return;
    }

    if (isAdmin) {
      // Professional Complaint Management Table for Administrators
      const rowsHtml = filtered.map((c) => {
        const prio = resolveEffectivePriority(c);
        const location = c.roomNumber || "Campus Facility";
        const createdDate = c.createdAt ? c.createdAt.slice(0, 16) : "N/A";
        const studentEmail = c.studentEmail ? escapeHtml(c.studentEmail) : "";

        return `
          <tr data-id="${c.id}">
            <td>
              <a class="admin-ticket-id-link" data-action="view-details" data-id="${c.id}" title="Click to view details">
                #${c.id}
              </a>
            </td>
            <td>
              <div class="student-meta-cell">
                <span class="student-name-bold">${escapeHtml(c.studentName)}</span>
                ${studentEmail ? `<span style="font-size: 0.72rem; color: #64748b;">${studentEmail}</span>` : ""}
              </div>
            </td>
            <td>
              <span class="student-roll-code">${escapeHtml(c.rollNumber)}</span>
            </td>
            <td>
              <span class="category-tag" style="font-size: 0.76rem;">${escapeHtml(c.category)}</span>
            </td>
            <td>
              <span class="location-cell" title="${escapeHtml(location)}">📍 ${escapeHtml(location)}</span>
            </td>
            <td>
              <span class="${priorityBadgeClass(prio)}" style="font-size: 0.76rem;">${escapeHtml(prio)}</span>
            </td>
            <td>
              <span class="${statusBadgeClass(c.status)}" style="font-size: 0.76rem;">${escapeHtml(c.status)}</span>
            </td>
            <td>
              <span class="date-cell">${escapeHtml(createdDate)}</span>
            </td>
            <td>
              <div class="table-actions-cell">
                <button type="button" class="btn-table-details" data-action="view-details" data-id="${c.id}" title="Inspect full details &amp; dispatch">
                  View 🔍
                </button>
                <select class="table-status-select" data-action="quick-status" data-id="${c.id}" aria-label="Change Status">
                  <option value="Pending" ${c.status === "Pending" ? "selected" : ""}>Pending</option>
                  <option value="In Progress" ${c.status === "In Progress" ? "selected" : ""}>In Progress</option>
                  <option value="Resolved" ${c.status === "Resolved" ? "selected" : ""}>Resolved</option>
                </select>
                <button type="button" class="btn-table-delete" data-action="delete" data-id="${c.id}" title="Delete complaint">
                  🗑
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join("");

      els.container.innerHTML = `
        <div class="admin-table-container">
          <table class="admin-complaints-table">
            <thead>
              <tr>
                <th style="width: 70px;">ID</th>
                <th>Student Name</th>
                <th>Registration #</th>
                <th>Category</th>
                <th>Campus Location</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Submission Date</th>
                <th style="width: 175px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    } else {
      // Student Portal Card View (Preserved exactly)
      els.container.innerHTML = filtered
        .map((c) => {
          const prio = resolveEffectivePriority(c);
          const location = c.roomNumber || "Campus Facility";
          const created = c.createdAt ? `Logged: ${escapeHtml(c.createdAt)}` : "";
          const updated = (c.updatedAt && c.updatedAt !== c.createdAt)
            ? ` • Updated: ${escapeHtml(c.updatedAt)}`
            : "";

          const remarksHtml = c.adminRemarks
            ? `<div class="complaint-remarks"><strong>Maintenance Note:</strong> ${escapeHtml(c.adminRemarks)}</div>`
            : "";

          return `
            <article class="complaint-item" data-id="${c.id}">
              <div class="complaint-top">
                <div class="complaint-meta-left">
                  <span class="ticket-id">#${c.id}</span>
                  <span class="${priorityBadgeClass(prio)}">${escapeHtml(prio)} Priority</span>
                  <span class="location-tag">📍 ${escapeHtml(location)}</span>
                  <span class="category-tag">${escapeHtml(c.category)}</span>
                  <span class="student-info">
                    ${escapeHtml(c.studentName)}
                    <span class="student-roll">(${escapeHtml(c.rollNumber)})</span>
                    ${c.studentEmail ? ` • <a href="mailto:${escapeHtml(c.studentEmail)}" class="student-email-link">${escapeHtml(c.studentEmail)}</a>` : ""}
                  </span>
                </div>
                <span class="${statusBadgeClass(c.status)}">${escapeHtml(c.status)}</span>
              </div>

              <p class="complaint-desc">${escapeHtml(c.description)}</p>

              ${remarksHtml}

              <div class="complaint-footer">
                <span>${created}${updated}</span>
              </div>
            </article>
          `;
        })
        .join("");
    }
  }

  // =========================================================
  // FORM SUBMISSION & ADMIN ACTIONS
  // =========================================================
  let isSubmittingComplaint = false;

  async function handleComplaintSubmit(e) {
    e.preventDefault();
    if (isSubmittingComplaint) return;
    isSubmittingComplaint = true;

    // Always obtain identity strictly from authenticated Firebase session
    const authenticatedEmail = (state.user && state.user.email) ? state.user.email.trim().toLowerCase() : els.studentEmail.value.trim().toLowerCase();
    const authenticatedName = (state.user && state.user.name) ? state.user.name.trim() : els.studentName.value.trim();
    const authenticatedRoll = (state.user && state.user.rollNumber) ? state.user.rollNumber.trim() : els.rollNumber.value.trim();

    if (!authenticatedName || !authenticatedRoll) {
      showToast("Cannot submit: Your Google profile must contain your full name and roll number.", "error");
      isSubmittingComplaint = false;
      return;
    }

    const block = els.campusBlockSelect.value.trim();
    const room = els.roomNumber.value.trim();
    const category = els.category.value.trim();
    const description = els.description.value.trim();

    if (!room || !category || !description) {
      showToast("Please fill in all mandatory fields marked with *", "error");
      isSubmittingComplaint = false;
      return;
    }

    if (!isStrictSrmapEmail(authenticatedEmail)) {
      showToast("Access denied. Please sign in using your official SRM AP university email address (@srmap.edu.in).", "error");
      isSubmittingComplaint = false;
      return;
    }

    const fullLocation = block ? `${block} - ${room}` : room;
    const autoPrio = calculateAutoPriority(category, description);

    els.submitBtn.disabled = true;
    els.submitBtn.textContent = "Registering Grievance...";

    try {
      const params = new URLSearchParams();
      params.append("studentName", authenticatedName);
      params.append("rollNumber", authenticatedRoll);
      params.append("studentEmail", authenticatedEmail);
      params.append("roomNumber", fullLocation);
      params.append("category", category);
      params.append("description", description);
      params.append("priority", autoPrio);

      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString()
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || "Failed to register grievance ticket");
      }

      showToast(`Grievance #${resData.id} registered successfully!`, "success");

      // Reset specific problem fields while retaining read-only user identity
      els.roomNumber.value = "";
      els.description.value = "";
      els.charCount.textContent = "0";
      updateAutoPriorityPreview();

      await fetchComplaints(true);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      isSubmittingComplaint = false;
      els.submitBtn.disabled = false;
      els.submitBtn.textContent = "Submit Grievance Ticket →";
    }
  }

  async function handleStatusChange(id, newStatus) {
    try {
      const params = new URLSearchParams();
      params.append("id", id);
      params.append("status", newStatus);

      const res = await fetch("/api/complaints/status", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString()
      });

      if (!res.ok) throw new Error("Could not update status");
      showToast(`Ticket #${id} status changed to "${newStatus}"`, "success");
      await fetchComplaints(true);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleRemarksChange(id, remarks) {
    try {
      const params = new URLSearchParams();
      params.append("id", id);
      params.append("adminRemarks", remarks);

      const res = await fetch("/api/complaints/remarks", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString()
      });

      if (!res.ok) throw new Error("Could not save maintenance notes");
      showToast(`Remarks updated for Ticket #${id}`, "success");
      await fetchComplaints(true);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleDelete(id) {
    if (!confirm(`Are you sure you want to permanently delete grievance #${id}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/complaints?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete grievance record");
      showToast(`Complaint #${id} deleted from SRM AP records`, "info");
      await fetchComplaints(true);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // =========================================================
  // GOOGLE SIGN-IN (FIREBASE AUTH - STUDENT & ADMIN ROLES)
  // Both Student and Admin authenticate with Google Sign-In.
  // Access to Admin Dashboard is strictly authorized by the backend.
  // =========================================================
  let lastGoogleUser = null;

  function setAuthButtonsLoading(isLoading, role = "") {
    if (els.googleSignInBtn) {
      els.googleSignInBtn.disabled = isLoading;
      els.googleSignInBtn.style.opacity = isLoading ? "0.65" : "1";
      els.googleSignInBtn.style.cursor = isLoading ? "wait" : "pointer";
    }
    if (els.btnAdminLogin) {
      els.btnAdminLogin.disabled = isLoading;
      els.btnAdminLogin.style.opacity = isLoading ? "0.65" : "1";
      els.btnAdminLogin.style.cursor = isLoading ? "wait" : "pointer";
    }
  }

  function showAuthAlert(title, message, icon = "ℹ️", isDomainError = false, retryAction = null) {
    if (els.authAlertTitle) els.authAlertTitle.textContent = title;
    if (els.authAlertMessage) els.authAlertMessage.innerHTML = message;
    if (els.authAlertIcon) els.authAlertIcon.textContent = icon;

    if (els.domainHelperBox) {
      if (isDomainError) {
        els.domainHelperBox.style.display = "block";
        if (els.currentHostnameCode) {
          els.currentHostnameCode.textContent = window.location.hostname;
        }
      } else {
        els.domainHelperBox.style.display = "none";
      }
    }

    if (els.btnRetryAuth) {
      if (retryAction && typeof retryAction === "function") {
        els.btnRetryAuth.style.display = "inline-flex";
        els.btnRetryAuth.onclick = () => {
          if (els.authAlertModal) els.authAlertModal.style.display = "none";
          retryAction();
        };
      } else {
        els.btnRetryAuth.style.display = "none";
      }
    }

    if (els.authAlertModal) {
      els.authAlertModal.style.display = "flex";
    }
  }

  async function initiateGoogleAuth(requestedRole = "student") {
    // 1. Prevent duplicate concurrent requests
    if (isAuthInProgress) {
      console.warn("Authentication already in progress.");
      return;
    }

    SafeStorage.setItem("srm_auth_role", requestedRole, "session");

    if (isFirebaseConfigured && firebaseAuth && googleAuthProvider) {
      isAuthInProgress = true;
      setAuthButtonsLoading(true, requestedRole);

      try {
        // 2. Primary Standard: signInWithPopup keeps page context intact across desktop & mobile
        // This permanently eliminates "auth/missing-initial-state" caused by cross-domain redirect sessionStorage wiping.
        const result = await firebaseAuth.signInWithPopup(googleAuthProvider);
        if (result && result.user) {
          await processGoogleLogin(result.user, requestedRole);
        }
      } catch (error) {
        console.error("Google Sign-In error:", error);

        if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request") {
          showToast("Google sign-in was closed before completion. Please try again.", "info");
        } else if (error.code === "auth/unauthorized-domain") {
          showAuthAlert(
            "Domain Authorization Required",
            `The current hostname <code>${window.location.hostname}</code> is not yet authorized in your Firebase Authentication settings.`,
            "🔒",
            true
          );
        } else if (error.code === "auth/popup-blocked") {
          showAuthAlert(
            "Sign-In Popup Blocked",
            "Your browser prevented the Google Sign-In window from opening. Please allow popups for this site, or tap the button below to retry directly.",
            "🛡️",
            false,
            () => initiateGoogleAuth(requestedRole)
          );
        } else if (error.code === "auth/network-request-failed") {
          showAuthAlert(
            "Internet Connection Unavailable",
            "Unable to connect to Google Authentication servers. Please verify your internet connection and try again.",
            "📶",
            false
          );
        } else if (error.code === "auth/missing-initial-state") {
          showAuthAlert(
            "Browser Storage Restriction",
            "Your browser or privacy settings restricted access to temporary sign-in state. Please use standard browsing mode or enable site cookies.",
            "⚠️",
            false
          );
        } else {
          showToast("Google Sign-In: " + (error.message || error.code), "error");
        }
      } finally {
        isAuthInProgress = false;
        setAuthButtonsLoading(false);
      }
    } else {
      // Fallback Direct Verification Modal (when testing offline or no API key)
      openGoogleFallbackModal(requestedRole);
    }
  }

  function openGoogleFallbackModal(role = "student") {
    if (els.customGoogleRole) els.customGoogleRole.value = role;
    if (els.googleAccountModal) els.googleAccountModal.style.display = "flex";
  }

  async function processGoogleLogin(fbUser, requestedRole = "student", isBackgroundVerify = false) {
    lastGoogleUser = fbUser;
    const email = (fbUser.email || "").toLowerCase().trim();

    // 1. Strict SRM AP University Email Domain Restriction Check
    if (!isStrictSrmapEmail(email)) {
      if (firebaseAuth) {
        try {
          await firebaseAuth.signOut();
        } catch (e) {}
      }
      lastGoogleUser = null;
      state.user = null;
      SafeStorage.removeItem("srm_user_session", "local");
      SafeStorage.removeItem("srm_user_role", "local");
      SafeStorage.removeItem("srm_auth_role", "session");

      showAuthAlert(
        "University Email Required",
        "Access denied. Please sign in using your official SRM AP university email address (@srmap.edu.in).",
        "🚫",
        false
      );
      showToast("Access denied. Please sign in using your official SRM AP university email address (@srmap.edu.in).", "error");
      return;
    }

    // 2. Extract and Validate Student Identity from Google Profile Name ("Full Name | Registration Number")
    const rawDisplayName = (fbUser.displayName || "").trim();
    let name = "";
    let rollNumber = "";
    let isStudentProfileValid = false;

    if (requestedRole === "student") {
      const parsed = extractStudentIdentityFromProfile(rawDisplayName);
      if (parsed.valid) {
        name = parsed.name;
        rollNumber = parsed.rollNumber;
        isStudentProfileValid = true;
      } else {
        name = "";
        rollNumber = "";
        isStudentProfileValid = false;
        console.warn("Student Google profile name missing 'Name | Roll' format:", rawDisplayName);

        if (!isBackgroundVerify) {
          showAuthAlert(
            "Profile Format Incomplete",
            `Your Google account display name is currently: <strong>${escapeHtml(rawDisplayName || "(Not set)")}</strong>.<br/><br/>The student portal requires the format: <code>Full Name | Registration Number</code> (e.g. <code>Sarath Kumar Kondaveeti | AP25110010838</code>).<br/><br/>Please contact your university administrator to update your official Google profile information.`,
            "⚠️",
            false
          );
        }
      }
    } else {
      // Admin Login
      if (rawDisplayName.includes("|")) {
        name = rawDisplayName.split("|")[0].trim();
      } else {
        name = rawDisplayName || "SRM AP Administrator";
      }
      rollNumber = "FACILITY-ADMIN";
    }

    // 2. Retrieve Firebase ID Token & Inspect Custom Claims
    let idToken = "";
    let customClaims = {};
    if (fbUser.getIdTokenResult && typeof fbUser.getIdTokenResult === "function") {
      try {
        const idResult = await fbUser.getIdTokenResult(true);
        idToken = idResult.token || "";
        customClaims = idResult.claims || {};
      } catch (tErr) {
        console.warn("Could not retrieve fresh ID token result:", tErr);
      }
    } else if (fbUser.getIdToken && typeof fbUser.getIdToken === "function") {
      try {
        idToken = await fbUser.getIdToken(true);
      } catch (tErr) {}
    }

    try {
      const params = new URLSearchParams();
      params.append("role", requestedRole);
      params.append("email", email);
      params.append("name", name);
      params.append("rollNumber", rollNumber);
      params.append("department", requestedRole === "admin" ? "Directorate of Campus Facilities & Estate" : "");
      params.append("provider", "google");
      if (idToken) params.append("idToken", idToken);
      if (customClaims.role === "admin" || customClaims.admin === true) {
        params.append("adminClaim", "true");
      }

      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString()
      });

      const data = await res.json();

      if (res.status === 403) {
        // SERVER-SIDE REJECTION: User is not authorized admin or domain rejected
        const errMsg = data.error || "Admin access denied. Your account is not authorized as an administrator.";
        if (!isBackgroundVerify) {
          showAccessDenied(email, errMsg);
        } else {
          // If a background auth check finds admin was revoked, fall back to student role
          SafeStorage.setItem("srm_user_role", "student", "local");
          await processGoogleLogin(fbUser, "student", false);
        }
        return;
      }

      if (!res.ok || !data.success) {
        if (!isBackgroundVerify) {
          showToast(data.error || "Authentication verification failed", "error");
        }
        return;
      }

      data.user.provider = "google";
      SafeStorage.setItem("srm_user_session", JSON.stringify(data.user), "local");
      SafeStorage.setItem("srm_user_role", data.user.role, "local");

      completeLogin(data.user);
    } catch (err) {
      console.error("Login verification error:", err);
      if (!isBackgroundVerify) {
        showToast("Could not communicate with SRM AP authentication server.", "error");
      }
    }
  }

  function showAccessDenied(email, message) {
    if (els.deniedEmailText) els.deniedEmailText.textContent = email;
    const msgEl = document.getElementById("deniedMessageText");
    if (msgEl && message) {
      msgEl.textContent = message;
    }
    if (els.accessDeniedModal) els.accessDeniedModal.style.display = "flex";
  }

  function completeLogin(userData) {
    state.user = userData;
    SafeStorage.setItem("srm_user_session", JSON.stringify(userData), "local");
    SafeStorage.setItem("srm_user_role", userData.role || "student", "local");
    showToast(`Welcome, ${userData.name}!`, "success");
    if (els.googleAccountModal) els.googleAccountModal.style.display = "none";
    if (els.studentLoginModal) els.studentLoginModal.style.display = "none";
    if (els.accessDeniedModal) els.accessDeniedModal.style.display = "none";
    showDashboard();
  }

  // =========================================================
  // ADMINISTRATOR PRIVILEGE ROSTER MANAGEMENT
  // =========================================================
  async function fetchAdminRoster() {
    if (!state.user || state.user.role !== "admin") return;
    try {
      const res = await fetch(`/api/admin/list?adminEmail=${encodeURIComponent(state.user.email)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.admins)) {
        renderAdminRoster(data.admins);
      }
    } catch (e) {
      console.warn("Failed to fetch admin roster:", e);
    }
  }

  function renderAdminRoster(admins) {
    if (!els.adminRosterUl) return;
    if (els.adminCountBadge) els.adminCountBadge.textContent = String(admins.length);
    els.adminRosterUl.innerHTML = "";

    admins.forEach((adminEmail) => {
      const li = document.createElement("li");
      li.style.cssText = "padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); font-size: 0.82rem;";

      const emailSpan = document.createElement("span");
      emailSpan.textContent = adminEmail;
      emailSpan.style.fontFamily = "monospace";
      if (adminEmail.toLowerCase() === state.user.email.toLowerCase()) {
        emailSpan.innerHTML += " <span style='color: var(--srm-olive); font-weight: bold;'>(You)</span>";
      }

      li.appendChild(emailSpan);

      // Only show Revoke button if it is not the current active administrator
      if (adminEmail.toLowerCase() !== state.user.email.toLowerCase()) {
        const revokeBtn = document.createElement("button");
        revokeBtn.type = "button";
        revokeBtn.className = "btn btn-outline-danger btn-xs";
        revokeBtn.textContent = "Revoke";
        revokeBtn.style.cssText = "padding: 2px 8px; font-size: 0.74rem;";
        revokeBtn.addEventListener("click", async () => {
          if (confirm(`Revoke administrator privileges from ${adminEmail}?`)) {
            await removeAdminPrivilege(adminEmail);
          }
        });
        li.appendChild(revokeBtn);
      }

      els.adminRosterUl.appendChild(li);
    });
  }

  async function addAdminPrivilege(targetEmail) {
    if (!targetEmail || targetEmail.indexOf("@") === -1) {
      showToast("Please enter a valid email address.", "error");
      return;
    }
    try {
      const res = await fetch("/api/admin/add", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          adminEmail: state.user.email,
          targetEmail: targetEmail
        }).toString()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || `Granted administrator privileges to ${targetEmail}`, "success");
        if (els.newAdminEmail) els.newAdminEmail.value = "";
        await fetchAdminRoster();
      } else {
        showToast(data.error || "Failed to grant administrator privileges", "error");
      }
    } catch (e) {
      showToast("Error adding administrator: " + e.message, "error");
    }
  }

  async function removeAdminPrivilege(targetEmail) {
    try {
      const res = await fetch("/api/admin/remove", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          adminEmail: state.user.email,
          targetEmail: targetEmail
        }).toString()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || `Revoked administrator privileges from ${targetEmail}`, "info");
        await fetchAdminRoster();
      } else {
        showToast(data.error || "Failed to revoke privileges", "error");
      }
    } catch (e) {
      showToast("Error removing administrator: " + e.message, "error");
    }
  }

  // =========================================================
  // ADMINISTRATIVE CSV EXPORT ENGINE (ADMIN ONLY)
  // =========================================================
  function sanitizeCsvValue(val) {
    if (val === null || val === undefined) return '""';
    let str = String(val).trim();
    // CSV Formula Injection Prevention:
    // If a text field begins with '=', '+', '-', '@', '\t', '\r', prepend a single quote
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    return `"${str.replace(/"/g, '""')}"`;
  }

  async function exportAdminCsv(filterType, categoryFilterVal) {
    // 1. Strict Security Authorization: Only authenticated administrators can export
    if (!state.user || state.user.role !== "admin") {
      showToast("Access Denied: Only authorized administrators can export complaint records.", "error");
      return;
    }

    // 2. Fetch latest data from C++ server so exports never use stale cache
    await fetchComplaints(true);

    const all = state.complaints || [];
    let dataset = [];
    let filename = "Complaints.csv";
    let label = "";

    if (filterType === "ALL") {
      dataset = all;
      filename = "All_Complaints.csv";
      label = "All Complaints";
    } else if (filterType === "Pending") {
      dataset = all.filter((c) => (c.status || "").toLowerCase() === "pending");
      filename = "Pending_Complaints.csv";
      label = "Pending Complaints";
    } else if (filterType === "In Progress") {
      dataset = all.filter((c) => (c.status || "").toLowerCase() === "in progress");
      filename = "In_Progress_Complaints.csv";
      label = "In-Progress Complaints";
    } else if (filterType === "Resolved") {
      dataset = all.filter((c) => (c.status || "").toLowerCase() === "resolved");
      filename = "Resolved_Complaints.csv";
      label = "Resolved Complaints";
    } else if (filterType === "CATEGORY") {
      const cat = categoryFilterVal || (els.exportCategorySelect ? els.exportCategorySelect.value : "Electrical");
      dataset = all.filter((c) => (c.category || "").toLowerCase() === cat.toLowerCase());
      const safeCatName = cat.replace(/[^a-zA-Z0-9_-]/g, "_");
      filename = `${safeCatName}_Complaints.csv`;
      label = `${cat} Complaints`;
    }

    // 3. Clear message when no complaints match
    if (!dataset || dataset.length === 0) {
      showToast(`No complaints found for "${label}". No CSV file was generated.`, "info");
      return;
    }

    // 4. Exact 14 required columns:
    // Complaint ID, Student Name, Registration Number, Student Email,
    // Campus Block / Area, Room / Specific Spot, Complaint Category,
    // Complaint Description, Priority, Status, Assigned Technician,
    // Created Date, Updated Date, Resolution Details
    const headers = [
      "Complaint ID",
      "Student Name",
      "Registration Number",
      "Student Email",
      "Campus Block / Area",
      "Room / Specific Spot",
      "Complaint Category",
      "Complaint Description",
      "Priority",
      "Status",
      "Assigned Technician",
      "Created Date",
      "Updated Date",
      "Resolution Details"
    ];

    const rows = dataset.map((c) => {
      let block = "Campus Area";
      let spot = c.roomNumber || "N/A";
      if (c.roomNumber && c.roomNumber.includes(" - ")) {
        const parts = c.roomNumber.split(" - ");
        block = parts[0].trim();
        spot = parts.slice(1).join(" - ").trim();
      } else if (c.roomNumber) {
        block = c.roomNumber.trim();
      }

      const prio = resolveEffectivePriority(c);
      const tech = c.assignedTechnician || "Unassigned";
      const resolution = c.adminRemarks || (c.status === "Resolved" ? "Resolved by Facilities Team" : "N/A");

      return [
        c.id,
        sanitizeCsvValue(c.studentName),
        sanitizeCsvValue(c.rollNumber),
        sanitizeCsvValue(c.studentEmail),
        sanitizeCsvValue(block),
        sanitizeCsvValue(spot),
        sanitizeCsvValue(c.category),
        sanitizeCsvValue(c.description),
        sanitizeCsvValue(prio),
        sanitizeCsvValue(c.status),
        sanitizeCsvValue(tech),
        sanitizeCsvValue(c.createdAt),
        sanitizeCsvValue(c.updatedAt),
        sanitizeCsvValue(resolution)
      ].join(",");
    });

    // 5. UTF-8 BOM (\uFEFF) ensures Excel renders characters properly without encoding issues
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${dataset.length} complaint(s) to ${filename}`, "success");
  }

  // =========================================================
  // COMPLAINT DETAILS MODAL MANAGEMENT
  // =========================================================
  let activeDetailComplaintId = null;

  function openComplaintDetailsModal(id) {
    const c = state.complaints.find((item) => item.id === Number(id));
    if (!c) {
      showToast("Complaint record not found", "error");
      return;
    }

    activeDetailComplaintId = c.id;

    if (els.modalTicketId) els.modalTicketId.textContent = `#${c.id}`;
    if (els.modalDetailStatus) {
      els.modalDetailStatus.textContent = c.status;
      els.modalDetailStatus.className = statusBadgeClass(c.status);
    }
    if (els.modalDetailPriority) {
      const prio = resolveEffectivePriority(c);
      els.modalDetailPriority.textContent = `${prio} Priority`;
      els.modalDetailPriority.className = priorityBadgeClass(prio);
    }
    if (els.modalDetailCategory) els.modalDetailCategory.textContent = c.category;

    if (els.modalStudentName) els.modalStudentName.textContent = c.studentName || "N/A";
    if (els.modalRollNumber) els.modalRollNumber.textContent = c.rollNumber || "N/A";
    if (els.modalStudentEmail) {
      els.modalStudentEmail.textContent = c.studentEmail || "N/A";
      els.modalStudentEmail.href = c.studentEmail ? `mailto:${c.studentEmail}` : "#";
    }
    if (els.modalLocation) els.modalLocation.textContent = c.roomNumber || "Campus Facility";
    if (els.modalDescription) els.modalDescription.textContent = c.description || "";

    if (els.modalCreatedAt) els.modalCreatedAt.textContent = c.createdAt || "N/A";
    if (els.modalUpdatedAt) els.modalUpdatedAt.textContent = c.updatedAt || c.createdAt || "N/A";

    const isAdmin = state.user && state.user.role === "admin";
    if (els.modalAdminControlsSection) {
      els.modalAdminControlsSection.style.display = isAdmin ? "block" : "none";
    }

    if (els.modalStatusSelect) els.modalStatusSelect.value = c.status || "Pending";
    if (els.modalTechnicianInput) els.modalTechnicianInput.value = c.assignedTechnician || "";
    if (els.modalRemarksTextarea) els.modalRemarksTextarea.value = c.adminRemarks || "";

    if (els.complaintDetailsModal) {
      els.complaintDetailsModal.style.display = "flex";
    }
  }

  function closeComplaintDetailsModal() {
    activeDetailComplaintId = null;
    if (els.complaintDetailsModal) {
      els.complaintDetailsModal.style.display = "none";
    }
  }

  async function saveModalComplaintDetails() {
    if (!activeDetailComplaintId) return;
    const id = activeDetailComplaintId;

    const newStatus = els.modalStatusSelect ? els.modalStatusSelect.value : "";
    const newTechnician = els.modalTechnicianInput ? els.modalTechnicianInput.value.trim() : "";
    const newRemarks = els.modalRemarksTextarea ? els.modalRemarksTextarea.value.trim() : "";
    const adminEmail = state.user ? state.user.email : "";

    try {
      const params = new URLSearchParams();
      params.append("id", id);
      params.append("status", newStatus);
      params.append("assignedTechnician", newTechnician);
      params.append("adminRemarks", newRemarks);
      if (adminEmail) params.append("adminEmail", adminEmail);

      const res = await fetch("/api/complaints/update", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString()
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update complaint details");
      }

      showToast(`Grievance #${id} details updated successfully!`, "success");
      closeComplaintDetailsModal();
      await fetchComplaints(true);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // =========================================================
  // EVENT LISTENERS INITIALIZATION
  // =========================================================
  function initEventListeners() {
    // 1. Google Sign-In (Student Access)
    if (els.googleSignInBtn) {
      els.googleSignInBtn.addEventListener("click", () => initiateGoogleAuth("student"));
    }

    // 2. Official Authority Logins (Admin, Warden, Security via Google Auth)
    if (els.btnAdminLogin) {
      els.btnAdminLogin.addEventListener("click", () => initiateGoogleAuth("admin"));
    }

    // 3. Access Denied Controls
    if (els.btnContinueAsStudent) {
      els.btnContinueAsStudent.addEventListener("click", async () => {
        if (els.accessDeniedModal) els.accessDeniedModal.style.display = "none";
        if (lastGoogleUser) {
          await processGoogleLogin(lastGoogleUser, "student");
        } else {
          await initiateGoogleAuth("student");
        }
      });
    }
    if (els.btnCloseAccessDenied) {
      els.btnCloseAccessDenied.addEventListener("click", () => {
        if (els.accessDeniedModal) els.accessDeniedModal.style.display = "none";
      });
    }

    // 4. Auth Alert Modal Dismissal and Copy Hostname
    if (els.btnCloseAuthAlert) {
      els.btnCloseAuthAlert.addEventListener("click", () => {
        if (els.authAlertModal) els.authAlertModal.style.display = "none";
      });
    }
    if (els.btnCopyHostname) {
      els.btnCopyHostname.addEventListener("click", async () => {
        const host = window.location.hostname;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(host);
          } else {
            const temp = document.createElement("input");
            temp.value = host;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand("copy");
            document.body.removeChild(temp);
          }
          showToast("Copied hostname: " + host, "success");
        } catch (e) {
          showToast("Could not auto-copy. Hostname: " + host, "info");
        }
      });
    }

    // 5. Administrator Roster Management
    if (els.addAdminForm) {
      els.addAdminForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = els.newAdminEmail ? els.newAdminEmail.value.trim() : "";
        if (email) {
          await addAdminPrivilege(email);
        }
      });
    }

    // 6. Google Account Modal Controls
    if (els.closeGoogleModalBtn) {
      els.closeGoogleModalBtn.addEventListener("click", () => {
        if (els.googleAccountModal) els.googleAccountModal.style.display = "none";
      });
    }

    if (els.customGoogleForm) {
      els.customGoogleForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = els.customGoogleName.value.trim();
        const email = els.customGoogleEmail.value.trim().toLowerCase();
        const role = els.customGoogleRole.value;

        if (!isStrictSrmapEmail(email)) {
          alert("Access denied. Please sign in using your official SRM AP university email address (@srmap.edu.in).");
          return;
        }

        await processGoogleLogin({
          displayName: name,
          email: email
        }, role);
      });
    }

    // 6. Dashboard Header
    if (els.logoutBtn) els.logoutBtn.addEventListener("click", handleLogout);
    if (els.refreshBtn) els.refreshBtn.addEventListener("click", () => fetchComplaints(false));

    // Admin Reports CSV Export (Only accessible by administrators)
    if (els.btnExportAll) {
      els.btnExportAll.addEventListener("click", () => exportAdminCsv("ALL"));
    }
    if (els.btnExportPending) {
      els.btnExportPending.addEventListener("click", () => exportAdminCsv("Pending"));
    }
    if (els.btnExportInProgress) {
      els.btnExportInProgress.addEventListener("click", () => exportAdminCsv("In Progress"));
    }
    if (els.btnExportResolved) {
      els.btnExportResolved.addEventListener("click", () => exportAdminCsv("Resolved"));
    }
    if (els.btnExportCategory) {
      els.btnExportCategory.addEventListener("click", () => {
        const cat = els.exportCategorySelect ? els.exportCategorySelect.value : "Electrical";
        exportAdminCsv("CATEGORY", cat);
      });
    }

    // Complaint Details Modal Controls
    if (els.btnCloseDetailHeader) els.btnCloseDetailHeader.addEventListener("click", closeComplaintDetailsModal);
    if (els.btnCloseDetailModal) els.btnCloseDetailModal.addEventListener("click", closeComplaintDetailsModal);
    if (els.btnSaveDetailModal) els.btnSaveDetailModal.addEventListener("click", saveModalComplaintDetails);
    if (els.btnDeleteDetailModal) {
      els.btnDeleteDetailModal.addEventListener("click", () => {
        if (activeDetailComplaintId) {
          const id = activeDetailComplaintId;
          closeComplaintDetailsModal();
          handleDelete(id);
        }
      });
    }

    // 7. Complaint Form
    if (els.complaintForm) {
      els.complaintForm.addEventListener("submit", handleComplaintSubmit);
    }
    if (els.category) {
      els.category.addEventListener("change", updateAutoPriorityPreview);
    }
    if (els.description && els.charCount) {
      els.description.addEventListener("input", () => {
        els.charCount.textContent = String(els.description.value.length);
        updateAutoPriorityPreview();
      });
    }

    // Make student identity fields strictly non-editable via keyboard or mouse
    [els.studentName, els.rollNumber, els.studentEmail].forEach((inputEl) => {
      if (!inputEl) return;
      inputEl.addEventListener("keydown", (e) => {
        // Allow Tab / Shift+Tab for navigation; block typing or deletion
        if (e.key !== "Tab") {
          e.preventDefault();
        }
      });
      inputEl.addEventListener("paste", (e) => e.preventDefault());
      inputEl.addEventListener("drop", (e) => e.preventDefault());
      inputEl.addEventListener("cut", (e) => e.preventDefault());
    });

    // 8. Admin Dispatch Filter Shortcuts
    if (els.filterHighUrgentBtn) {
      els.filterHighUrgentBtn.addEventListener("click", () => {
        if (els.priorityFilter) els.priorityFilter.value = "High";
        state.priority = "High";
        render();
      });
    }
    if (els.filterPendingBtn) {
      els.filterPendingBtn.addEventListener("click", () => {
        if (els.statusFilter) els.statusFilter.value = "Pending";
        state.status = "Pending";
        render();
      });
    }
    if (els.filterGangaHostelBtn) {
      els.filterGangaHostelBtn.addEventListener("click", () => {
        if (els.searchInput) els.searchInput.value = "Hostel";
        state.search = "Hostel";
        render();
      });
    }
    if (els.resetAdminFiltersBtn) {
      els.resetAdminFiltersBtn.addEventListener("click", () => {
        if (els.searchInput) els.searchInput.value = "";
        if (els.priorityFilter) els.priorityFilter.value = "ALL";
        if (els.statusFilter) els.statusFilter.value = "ALL";
        if (els.categoryFilter) els.categoryFilter.value = "ALL";
        if (els.campusBlockFilter) els.campusBlockFilter.value = "ALL";
        if (els.dateFilter) els.dateFilter.value = "";
        if (els.clearDateBtn) els.clearDateBtn.style.display = "none";
        state.search = "";
        state.priority = "ALL";
        state.status = "ALL";
        state.category = "ALL";
        state.campusBlock = "ALL";
        state.submissionDate = "";
        render();
      });
    }

    // 9. Filters & Search Bar
    if (els.searchInput) {
      els.searchInput.addEventListener("input", (e) => {
        state.search = e.target.value;
        render();
      });
    }
    if (els.priorityFilter) {
      els.priorityFilter.addEventListener("change", (e) => {
        state.priority = e.target.value;
        render();
      });
    }
    if (els.statusFilter) {
      els.statusFilter.addEventListener("change", (e) => {
        state.status = e.target.value;
        render();
      });
    }
    if (els.categoryFilter) {
      els.categoryFilter.addEventListener("change", (e) => {
        state.category = e.target.value;
        render();
      });
    }
    if (els.campusBlockFilter) {
      els.campusBlockFilter.addEventListener("change", (e) => {
        state.campusBlock = e.target.value;
        render();
      });
    }
    if (els.dateFilter) {
      els.dateFilter.addEventListener("change", (e) => {
        state.submissionDate = e.target.value;
        if (els.clearDateBtn) {
          els.clearDateBtn.style.display = e.target.value ? "block" : "none";
        }
        render();
      });
    }
    if (els.clearDateBtn) {
      els.clearDateBtn.addEventListener("click", () => {
        if (els.dateFilter) els.dateFilter.value = "";
        state.submissionDate = "";
        els.clearDateBtn.style.display = "none";
        render();
      });
    }

    // 10. List / Table Delegation for View Details, Status, Remarks, Delete
    if (els.container) {
      els.container.addEventListener("click", (e) => {
        const viewTrigger = e.target.closest("[data-action='view-details']");
        if (viewTrigger) {
          openComplaintDetailsModal(viewTrigger.dataset.id);
          return;
        }

        const delBtn = e.target.closest("[data-action='delete']");
        if (delBtn) {
          handleDelete(delBtn.dataset.id);
          return;
        }
      });

      els.container.addEventListener("change", (e) => {
        const target = e.target;
        if (target.dataset.action === "quick-status" || target.dataset.action === "status") {
          handleStatusChange(target.dataset.id, target.value);
        }
      });

      els.container.addEventListener("blur", (e) => {
        const target = e.target;
        if (target.dataset.action === "remarks-input") {
          handleRemarksChange(target.dataset.id, target.value.trim());
        }
      }, true);

      els.container.addEventListener("keypress", (e) => {
        const target = e.target;
        if (target.dataset.action === "remarks-input" && e.key === "Enter") {
          target.blur();
        }
      });
    }

    // 11. Modal Backdrop Click Dismissal
    [els.googleAccountModal, els.accessDeniedModal, els.authAlertModal, els.complaintDetailsModal].forEach((modal) => {
      if (modal) {
        modal.addEventListener("click", (e) => {
          if (e.target === modal) {
            modal.style.display = "none";
          }
        });
      }
    });

    // 12. Periodic Background Sync (every 10 seconds)
    setInterval(() => {
      if (state.user) {
        fetchComplaints(true);
      }
    }, 10000);
  }

  // =========================================================
  // BOOTSTRAP APPLICATION
  // =========================================================
  initFirebase();
  initEventListeners();
  initSession();
})();
