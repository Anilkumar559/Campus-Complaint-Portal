(() => {
  const state = {
    complaints: [],
    search: "",
    priority: "ALL",
    status: "ALL",
    category: "ALL"
  };

  const els = {
    serverStatus: document.getElementById("serverStatus"),
    backendWarningBanner: document.getElementById("backendWarningBanner"),
    refreshBtn: document.getElementById("refreshBtn"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),
    totalCount: document.getElementById("totalCount"),
    highPriorityCount: document.getElementById("highPriorityCount"),
    pendingCount: document.getElementById("pendingCount"),
    progressCount: document.getElementById("progressCount"),
    resolvedCount: document.getElementById("resolvedCount"),
    form: document.getElementById("complaintForm"),
    submitBtn: document.getElementById("submitBtn"),
    studentName: document.getElementById("studentName"),
    rollNumber: document.getElementById("rollNumber"),
    roomNumber: document.getElementById("roomNumber"),
    category: document.getElementById("category"),
    description: document.getElementById("description"),
    charCount: document.getElementById("charCount"),
    detectedPriorityBadge: document.getElementById("detectedPriorityBadge"),
    searchInput: document.getElementById("searchInput"),
    priorityFilter: document.getElementById("priorityFilter"),
    statusFilter: document.getElementById("statusFilter"),
    categoryFilter: document.getElementById("categoryFilter"),
    container: document.getElementById("complaintsContainer"),
    toastContainer: document.getElementById("toastContainer")
  };

  // Auto-priority rule engine (matches C++ ComplaintManager::determinePriority)
  function calculateAutoPriority(category, description) {
    const text = `${category || ""} ${description || ""}`.toLowerCase();
    const highKeywords = [
      "fire", "spark", "short circuit", "shock", "hazard", "emergency", "urgent",
      "flood", "burst", "no water", "no electricity", "power outage", "blackout",
      "broken lock", "security", "smoke", "gas", "danger", "medical", "leakage", "overflow"
    ];

    if (highKeywords.some((kw) => text.includes(kw))) {
      return "High";
    }

    const cat = (category || "").toLowerCase();
    if (cat.includes("electrical") || cat.includes("plumbing")) {
      return "High";
    }
    if (cat.includes("wi-fi") || cat.includes("internet") || cat.includes("hostel") ||
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
    const prio = calculateAutoPriority(els.category.value, els.description.value);
    els.detectedPriorityBadge.textContent = `${prio} Priority`;
    els.detectedPriorityBadge.className = `prio-badge prio-${prio.toLowerCase()}`;
  }

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    els.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3500);
  }

  function setServerOnline(online) {
    if (online) {
      els.serverStatus.textContent = "Server Online";
      els.serverStatus.className = "status-pill status-online";
    } else {
      els.serverStatus.textContent = "Server Offline";
      els.serverStatus.className = "status-pill status-offline";
    }
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

  function updateStats() {
    const total = state.complaints.length;
    let highPriority = 0;
    let pending = 0;
    let progress = 0;
    let resolved = 0;

    for (const c of state.complaints) {
      const prio = resolveEffectivePriority(c);
      if (prio === "High" && c.status !== "Resolved") {
        highPriority++;
      }
      if (c.status === "Resolved") resolved++;
      else if (c.status === "In Progress") progress++;
      else pending++;
    }

    els.totalCount.textContent = total;
    els.highPriorityCount.textContent = highPriority;
    els.pendingCount.textContent = pending;
    els.progressCount.textContent = progress;
    els.resolvedCount.textContent = resolved;
  }

  function getFilteredComplaints() {
    const q = state.search.trim().toLowerCase();
    return state.complaints
      .filter((c) => {
        const prio = resolveEffectivePriority(c);
        if (state.priority !== "ALL" && prio !== state.priority) return false;
        if (state.status !== "ALL" && c.status !== state.status) return false;
        if (state.category !== "ALL" && c.category !== state.category) return false;
        if (!q) return true;
        return (
          String(c.id).includes(q) ||
          (c.roomNumber || "").toLowerCase().includes(q) ||
          (c.studentName || "").toLowerCase().includes(q) ||
          (c.rollNumber || "").toLowerCase().includes(q) ||
          (c.category || "").toLowerCase().includes(q) ||
          prio.toLowerCase().includes(q) ||
          (c.description || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.id - a.id);
  }

  function render() {
    updateStats();
    const filtered = getFilteredComplaints();

    if (filtered.length === 0) {
      els.container.innerHTML = `<div class="empty-state">No complaints match your current filters.</div>`;
      return;
    }

    els.container.innerHTML = filtered
      .map((c) => {
        const prio = resolveEffectivePriority(c);
        const room = c.roomNumber || "N/A";
        const created = c.createdAt ? `Logged: ${escapeHtml(c.createdAt)}` : "";
        const updated =
          c.updatedAt && c.updatedAt !== c.createdAt
            ? ` • Updated: ${escapeHtml(c.updatedAt)}`
            : "";
        return `
          <article class="complaint-item" data-id="${c.id}">
            <div class="complaint-top">
              <div class="complaint-meta-left">
                <span class="ticket-id">#${c.id}</span>
                <span class="${priorityBadgeClass(prio)}">${escapeHtml(prio)} Priority</span>
                <span class="room-tag">Room: ${escapeHtml(room)}</span>
                <span class="category-tag">${escapeHtml(c.category)}</span>
                <span class="student-info">${escapeHtml(c.studentName)} <span class="student-roll">(${escapeHtml(c.rollNumber)})</span></span>
              </div>
              <span class="${statusBadgeClass(c.status)}">${escapeHtml(c.status)}</span>
            </div>
            <p class="complaint-desc">${escapeHtml(c.description)}</p>
            <div class="complaint-footer">
              <span>${created}${updated}</span>
              <div class="admin-controls">
                <select id="status-${c.id}" class="status-select" data-action="status" data-id="${c.id}" aria-label="Change Status">
                  <option value="Pending" ${c.status === "Pending" ? "selected" : ""}>Pending</option>
                  <option value="In Progress" ${c.status === "In Progress" ? "selected" : ""}>In Progress</option>
                  <option value="Resolved" ${c.status === "Resolved" ? "selected" : ""}>Resolved</option>
                </select>
                <button type="button" class="btn btn-danger-ghost" data-action="delete" data-id="${c.id}" title="Delete complaint">
                  Delete
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  async function fetchComplaints(silent = false) {
    try {
      const res = await fetch("/api/complaints", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load complaints");
      state.complaints = await res.json();
      setServerOnline(true);

      // Show warning banner if old server binary is still running without priority/roomNumber fields
      const hasLegacyPayload =
        state.complaints.length > 0 &&
        state.complaints.some((c) => c.priority === undefined || c.roomNumber === undefined);
      els.backendWarningBanner.style.display = hasLegacyPayload ? "block" : "none";

      render();
      if (!silent) showToast("Complaints synced with server", "success");
    } catch (err) {
      setServerOnline(false);
      els.container.innerHTML = `<div class="empty-state">Unable to reach C++ backend server at <strong>http://localhost:8080</strong>. Make sure <code>complaint_server</code> is running.</div>`;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const studentName = els.studentName.value.trim();
    const rollNumber = els.rollNumber.value.trim();
    const roomNumber = els.roomNumber.value.trim();
    const category = els.category.value.trim();
    const description = els.description.value.trim();

    if (!studentName || !rollNumber || !roomNumber || !category || !description) {
      showToast("Please fill in all fields including Room No.", "error");
      return;
    }

    if ([studentName, rollNumber, roomNumber, category, description].some((v) => v.includes("|"))) {
      showToast("The '|' character is not allowed in input fields.", "error");
      return;
    }

    els.submitBtn.disabled = true;
    els.submitBtn.textContent = "Submitting...";

    try {
      const params = new URLSearchParams();
      params.append("studentName", studentName);
      params.append("rollNumber", rollNumber);
      params.append("roomNumber", roomNumber);
      params.append("category", category);
      params.append("description", description);

      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString()
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Submission failed");
      }

      const assignedPriority = data.priority || calculateAutoPriority(category, description);
      els.form.reset();
      els.charCount.textContent = "0";
      updateAutoPriorityPreview();
      showToast(`Complaint #${data.id} submitted (${assignedPriority} Priority)!`, "success");
      await fetchComplaints(true);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      els.submitBtn.disabled = false;
      els.submitBtn.textContent = "Submit Complaint";
    }
  }

  async function handleStatusChange(id, newStatus) {
    try {
      const params = new URLSearchParams();
      params.append("id", String(id));
      params.append("status", newStatus);

      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString()
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      showToast(`Ticket #${id} marked as ${newStatus}`, "success");
      await fetchComplaints(true);
    } catch (err) {
      showToast(err.message, "error");
      await fetchComplaints(true);
    }
  }

  async function handleDelete(id) {
    if (!confirm(`Are you sure you want to delete complaint #${id}?`)) return;
    try {
      const params = new URLSearchParams();
      params.append("id", String(id));

      const res = await fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString()
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete complaint");

      showToast(`Ticket #${id} deleted`, "success");
      await fetchComplaints(true);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function exportCsv() {
    const filtered = getFilteredComplaints();
    if (filtered.length === 0) {
      showToast("No complaints available to export.", "error");
      return;
    }

    const headers = ["ID", "Student Name", "Roll Number", "Room No.", "Category", "Auto Priority", "Status", "Description", "Created At", "Updated At"];
    const rows = filtered.map((c) => [
      c.id,
      `"${(c.studentName || "").replace(/"/g, '""')}"`,
      `"${(c.rollNumber || "").replace(/"/g, '""')}"`,
      `"${(c.roomNumber || "N/A").replace(/"/g, '""')}"`,
      `"${(c.category || "").replace(/"/g, '""')}"`,
      `"${resolveEffectivePriority(c).replace(/"/g, '""')}"`,
      `"${(c.status || "").replace(/"/g, '""')}"`,
      `"${(c.description || "").replace(/"/g, '""')}"`,
      `"${(c.createdAt || "").replace(/"/g, '""')}"`,
      `"${(c.updatedAt || "").replace(/"/g, '""')}"`
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campus_complaints_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported!", "success");
  }

  // Event Listeners
  els.form.addEventListener("submit", handleSubmit);
  els.refreshBtn.addEventListener("click", () => fetchComplaints(false));
  els.exportCsvBtn.addEventListener("click", exportCsv);

  els.category.addEventListener("change", updateAutoPriorityPreview);
  els.description.addEventListener("input", () => {
    els.charCount.textContent = String(els.description.value.length);
    updateAutoPriorityPreview();
  });

  els.searchInput.addEventListener("input", (e) => {
    state.search = e.target.value;
    render();
  });

  els.priorityFilter.addEventListener("change", (e) => {
    state.priority = e.target.value;
    render();
  });

  els.statusFilter.addEventListener("change", (e) => {
    state.status = e.target.value;
    render();
  });

  els.categoryFilter.addEventListener("change", (e) => {
    state.category = e.target.value;
    render();
  });

  els.container.addEventListener("change", (e) => {
    const target = e.target;
    if (target.matches("[data-action='status']")) {
      handleStatusChange(Number(target.dataset.id), target.value);
    }
  });

  els.container.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action='delete']");
    if (target) {
      handleDelete(Number(target.dataset.id));
    }
  });

  // Initial state
  updateAutoPriorityPreview();
  fetchComplaints(true);
})();
