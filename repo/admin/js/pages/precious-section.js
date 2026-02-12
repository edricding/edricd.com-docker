window.bannerList = [];
window.countingDown = [];
const BANNER_TBODY_ID = "index-banner-list-tbody";
let bannerSortDrake = null;
let isPersistingBannerOrder = false;
let bannerRequestSeq = 0;
let countingDownRequestSeq = 0;
let isCreatingBanner = false;
let isUpdatingBanner = false;
let isSavingCountingDown = false;

window.addEventListener("DOMContentLoaded", function () {
  fetchAndRenderBanners();
  fetchAndRenderCountingDown();
  bindBannerActions();
  bindCountingDownActions();
});

function applyBannerList(items, options) {
  const config = options || {};
  if (config.invalidatePending !== false) {
    bannerRequestSeq += 1;
  }

  bannerList = Array.isArray(items) ? items : [];
  renderBannerTable(bannerList);
  toggleAddBannerButton(bannerList);
  return bannerList;
}

function applyCountingDownData(item, options) {
  const config = options || {};
  if (config.invalidatePending !== false) {
    countingDownRequestSeq += 1;
  }

  countingDown = item && typeof item === "object" ? item : {};
  renderCountingDownTable(countingDown);
  return countingDown;
}

function bindBannerActions() {
  document.addEventListener("click", function (e) {
    const editTrigger = e.target.closest(".banner-edit-btn");
    if (editTrigger) {
      const bannerID = Number.parseInt(editTrigger.getAttribute("data-banner-id") || "", 10);
      if (!Number.isInteger(bannerID) || bannerID <= 0) {
        return;
      }

      const banner = bannerList.find((item) => Number(item.id) === bannerID);
      if (!banner) {
        return;
      }

      fillEditBannerForm(banner);
      return;
    }

    const deleteTrigger = e.target.closest(".banner-delete-trash");
    if (!deleteTrigger) {
      return;
    }

    const bannerId = deleteTrigger.getAttribute("data-banner-id");
    const idContainer = document.getElementById("delete-banner-id");
    if (idContainer) {
      idContainer.innerHTML = bannerId;
    }
  });

  const confirmDeleteBtn = document.getElementById("confirm-delete-banner-btn");
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", function () {
      const idNode = document.getElementById("delete-banner-id");
      const id = Number.parseInt(idNode ? idNode.innerHTML.trim() : "", 10);
      deleteBanner(id);
    });
  }

  const addBannerBtn = document.getElementById("add-banner-btn");
  if (addBannerBtn) {
    addBannerBtn.addEventListener("click", function () {
      if (isCreatingBanner) {
        return;
      }

      isCreatingBanner = true;
      addBannerBtn.disabled = true;

      fetch("/api/banner/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(getAddBannerForm()),
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data || !data.success) {
            throw new Error((data && data.message) || "Create banner failed");
          }

          applyBannerList(data.data || []);

          const modal = bootstrap.Modal.getInstance(document.getElementById("AddBannerModal"));
          if (modal) {
            modal.hide();
          }
          clearAddBannerForm();
        })
        .catch((err) => {
          console.error("Create banner failed:", err);
        })
        .finally(() => {
          isCreatingBanner = false;
          addBannerBtn.disabled = false;
        });
    });
  }

  const saveBannerBtn = document.getElementById("save-banner-btn");
  if (saveBannerBtn && !saveBannerBtn.dataset.bannerEditBound) {
    saveBannerBtn.addEventListener("click", function () {
      if (isUpdatingBanner) {
        return;
      }

      const editPayload = getEditBannerForm();
      if (!Number.isInteger(editPayload.id) || editPayload.id <= 0) {
        return;
      }

      isUpdatingBanner = true;
      saveBannerBtn.disabled = true;

      fetch("/api/banner/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(editPayload),
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data || !data.success) {
            throw new Error((data && data.message) || "Update banner failed");
          }

          applyBannerList(data.data || []);
          const modal = bootstrap.Modal.getInstance(document.getElementById("EditBannerModal"));
          if (modal) {
            modal.hide();
          }
        })
        .catch((err) => {
          console.error("Update banner failed:", err);
        })
        .finally(() => {
          isUpdatingBanner = false;
          saveBannerBtn.disabled = false;
        });
    });
    saveBannerBtn.dataset.bannerEditBound = "1";
  }
}

function bindCountingDownActions() {
  const tbody = document.getElementById("index-counting-down-tbody");
  if (tbody && !tbody.dataset.countingdownBound) {
    tbody.addEventListener("click", function (e) {
      const editBtn = e.target.closest("#countingdown-precious-edit-btn");
      if (!editBtn) {
        return;
      }

      fillCountingDownModal(countingDown || {});
    });
    tbody.dataset.countingdownBound = "1";
  }

  const saveBtn = document.getElementById("save-countingdown-precious-btn");
  if (saveBtn && !saveBtn.dataset.countingdownBound) {
    saveBtn.addEventListener("click", function () {
      if (isSavingCountingDown) {
        return;
      }

      const updatedData = getCountingDownPreciousForm();
      isSavingCountingDown = true;
      saveBtn.disabled = true;

      fetch("/api/countingdown/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(updatedData),
      })
        .then((response) => response.json())
        .then((res) => {
          if (!res || !res.success) {
            throw new Error((res && res.message) || "Update counting down failed");
          }
          return fetchAndRenderCountingDown({ strict: true });
        })
        .then(() => {
          const modal = bootstrap.Modal.getInstance(
            document.getElementById("EditCountingDownModal")
          );
          if (modal) {
            modal.hide();
          }
        })
        .catch((err) => {
          console.error("Update counting down failed:", err);
        })
        .finally(() => {
          isSavingCountingDown = false;
          saveBtn.disabled = false;
        });
    });
    saveBtn.dataset.countingdownBound = "1";
  }
}

function fetchAndRenderBanners(options) {
  const config = options || {};
  const strict = !!config.strict;
  const requestSeq = ++bannerRequestSeq;

  return fetch("/api/banners", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    cache: "no-store",
  })
    .then((response) => response.json())
    .then((data) => {
      if (!data || !data.success) {
        const message = (data && data.message) || "Failed to fetch banners";
        console.error("Failed to fetch banners:", message);
        if (strict) {
          throw new Error(message);
        }
        return null;
      }

      if (requestSeq !== bannerRequestSeq) {
        return null;
      }

      return applyBannerList(data.data || [], { invalidatePending: false });
    })
    .catch((error) => {
      console.error("Failed to fetch banners:", error);
      if (strict) {
        throw error;
      }
      return null;
    });
}

function fetchAndRenderCountingDown(options) {
  const config = options || {};
  const strict = !!config.strict;
  const requestSeq = ++countingDownRequestSeq;

  return fetch("/api/countingdown", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    cache: "no-store",
  })
    .then((response) => response.json())
    .then((data) => {
      if (!data || !data.success) {
        const message = (data && data.message) || "Failed to fetch counting down";
        console.error("Failed to fetch counting down:", message);
        if (strict) {
          throw new Error(message);
        }
        return null;
      }

      if (requestSeq !== countingDownRequestSeq) {
        return null;
      }

      const firstItem = Array.isArray(data.data) && data.data.length > 0 ? data.data[0] : {};
      return applyCountingDownData(firstItem, { invalidatePending: false });
    })
    .catch((error) => {
      console.error("Failed to fetch counting down:", error);
      if (strict) {
        throw error;
      }
      return null;
    });
}

function getAddBannerForm() {
  return {
    title1: document.getElementById("add-banner-title-1").value.trim(),
    title2: document.getElementById("add-banner-title-2").value.trim(),
    subtitle: document.getElementById("add-banner-subtitle").value.trim(),
    url: document.getElementById("add-banner-url").value.trim(),
    picurl: document.getElementById("add-banner-picture-url").value.trim(),
  };
}

function clearAddBannerForm() {
  const fieldIds = [
    "add-banner-title-1",
    "add-banner-title-2",
    "add-banner-subtitle",
    "add-banner-url",
    "add-banner-picture-url",
  ];

  fieldIds.forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.value = "";
    }
  });
}

function getEditBannerForm() {
  return {
    id: Number.parseInt(document.getElementById("edit-banner-id").value || "", 10),
    title1: document.getElementById("edit-banner-title-1").value.trim(),
    title2: document.getElementById("edit-banner-title-2").value.trim(),
    subtitle: document.getElementById("edit-banner-subtitle").value.trim(),
    url: document.getElementById("edit-banner-url").value.trim(),
    picurl: document.getElementById("edit-banner-picture-url").value.trim(),
  };
}

function fillEditBannerForm(item) {
  const banner = item || {};
  document.getElementById("edit-banner-id").value = banner.id || "";
  document.getElementById("edit-banner-title-1").value = banner.title1 || "";
  document.getElementById("edit-banner-title-2").value = banner.title2 || "";
  document.getElementById("edit-banner-subtitle").value = banner.subtitle || "";
  document.getElementById("edit-banner-url").value = banner.url || "";
  document.getElementById("edit-banner-picture-url").value = banner.picurl || "";
}

function toDisplayText(value, fallback = "-") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : fallback;
}

function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function initTooltipsIn(scopeEl) {
  if (!scopeEl || !window.bootstrap || !window.bootstrap.Tooltip) {
    return;
  }

  scopeEl.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
    const rawTitle = el.getAttribute("data-bs-title") || el.getAttribute("title");
    const safeTitle = toDisplayText(rawTitle);
    el.setAttribute("data-bs-title", safeTitle);
    el.setAttribute("title", safeTitle);
    bootstrap.Tooltip.getOrCreateInstance(el);
  });
}

function createBannerEmptyRow() {
  const row = document.createElement("tr");
  row.className = "banner-empty-row";
  row.innerHTML = '<td colspan="8" class="text-center text-muted py-3">No banners</td>';
  return row;
}

function syncBannerEmptyRow() {
  const zone = document.getElementById(BANNER_TBODY_ID);
  if (!zone) {
    return;
  }

  const dataRows = zone.querySelectorAll("tr.banner-row");
  const emptyRow = zone.querySelector("tr.banner-empty-row");

  if (dataRows.length === 0) {
    if (!emptyRow) {
      zone.appendChild(createBannerEmptyRow());
    }
  } else if (emptyRow) {
    emptyRow.remove();
  }
}

function collectBannerOrderIds() {
  const tbody = document.getElementById(BANNER_TBODY_ID);
  if (!tbody) {
    return [];
  }

  return Array.from(tbody.querySelectorAll("tr.banner-row"))
    .map((row) => Number.parseInt(row.dataset.bannerId || "", 10))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function saveBannerOrder() {
  if (isPersistingBannerOrder) {
    return;
  }

  const ids = collectBannerOrderIds();
  if (!ids.length) {
    return;
  }

  isPersistingBannerOrder = true;
  fetch("/api/banner/reorder", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ ids: ids }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (!data || !data.success) {
        console.error("Save banner order failed", data && data.message);
        fetchAndRenderBanners();
        return;
      }

      if (Array.isArray(data.data)) {
        applyBannerList(data.data || []);
      }
    })
    .catch((error) => {
      console.error("Save banner order failed", error);
      fetchAndRenderBanners();
    })
    .finally(() => {
      isPersistingBannerOrder = false;
    });
}

function initBannerDragAndDrop() {
  const tbody = document.getElementById(BANNER_TBODY_ID);
  if (!tbody || typeof dragula !== "function") {
    return;
  }

  if (bannerSortDrake) {
    bannerSortDrake.destroy();
    bannerSortDrake = null;
  }

  bannerSortDrake = dragula([tbody], {
    moves: function (_el, _container, handle) {
      return !!(handle && handle.closest(".dragula-handle"));
    },
  });

  bannerSortDrake.on("drag", function (el) {
    el.classList.add("banner-row-dragging");
  });

  bannerSortDrake.on("dragend", function (el) {
    el.classList.remove("banner-row-dragging");
  });

  bannerSortDrake.on("drop", function () {
    syncBannerEmptyRow();
    saveBannerOrder();
  });

  bannerSortDrake.on("cancel", function () {
    syncBannerEmptyRow();
  });
}

function getCountingDownPreciousForm() {
  const priceValue = parseFloat(document.getElementById("edit-countingdown-price").value.trim());
  const discountValue = parseFloat(
    document.getElementById("edit-countingdown-discount").value.trim()
  );

  let percentageValue = 0;
  if (priceValue && discountValue) {
    percentageValue = -Math.round(((priceValue - discountValue) / priceValue) * 100);
  }

  return {
    title: document.getElementById("edit-countingdown-title").value.trim(),
    price: parseInt(document.getElementById("edit-countingdown-price").value.trim(), 10),
    discount: parseInt(document.getElementById("edit-countingdown-discount").value.trim(), 10),
    percentage: `${percentageValue}%`,
    rating: parseFloat(document.getElementById("edit-countingdown-rating-select").value),
    ddl: document.getElementById("edit-countingdown-ddl").value.trim(),
    url: document.getElementById("edit-countingdown-precious-url").value.trim(),
    picurl: document.getElementById("edit-countingdown-precious-picture-url").value.trim(),
  };
}

function renderCountingDownTable(data) {
  const tbody = document.getElementById("index-counting-down-tbody");
  if (!tbody) {
    return;
  }

  const item = data || {};
  tbody.innerHTML = "";

  const pictureUrl = toDisplayText(item.picurl, "");
  const linkUrl = toDisplayText(item.url);
  const imageCellHtml = pictureUrl
    ? `<img
        src="${escapeHtmlAttr(pictureUrl)}"
        alt="table-user"
        class="me-2 avatar-xl"
      />`
    : "-";
  const linkCellHtml = `<a
      href="javascript:void(0);"
      class="link-reset fs-20 p-1 text-infjew"
      data-bs-toggle="tooltip"
      data-bs-trigger="hover"
      data-bs-title="${escapeHtmlAttr(linkUrl)}"
      title="${escapeHtmlAttr(linkUrl)}"
    >
      <i class="ti ti-link"></i>
    </a>`;

  const row = document.createElement("tr");
  row.innerHTML = `
    <td>
      ${imageCellHtml}
    </td>
    <td>${toDisplayText(item.title)}</td>
    <td>$${toDisplayText(item.price)}</td>
    <td>$${toDisplayText(item.discount)}</td>
    <td>
      <span class="badge bg-infjew fs-12 p-1">${toDisplayText(item.percentage)}</span>
    </td>
    <td>${toDisplayText(item.rating)}</td>
    <td>${toDisplayText(item.ddl)}</td>
    <td class="text-muted">
      ${linkCellHtml}
    </td>
    <td class="text-muted">
      <a
        href="javascript:void(0);"
        class="link-reset fs-20 p-1"
        data-bs-toggle="modal"
        data-bs-target="#EditCountingDownModal"
        id="countingdown-precious-edit-btn"
      >
        <i class="ti ti-pencil"></i>
      </a>
    </td>
  `;

  tbody.appendChild(row);
  initTooltipsIn(tbody);
}

function fillCountingDownModal(data) {
  document.getElementById("edit-countingdown-title").value = data.title || "";
  document.getElementById("edit-countingdown-price").value = data.price || "";
  document.getElementById("edit-countingdown-discount").value = data.discount || "";

  const parsedRating = Number(data.rating);
  document.getElementById("edit-countingdown-rating-select").value = Number.isFinite(parsedRating)
    ? parsedRating.toFixed(1)
    : "1.0";

  document.getElementById("edit-countingdown-ddl").value = data.ddl || "";
  document.getElementById("edit-countingdown-precious-url").value = data.url || "";
  document.getElementById("edit-countingdown-precious-picture-url").value = data.picurl || "";
}

function renderBannerTable(data) {
  const tableBody = document.getElementById(BANNER_TBODY_ID);
  if (!tableBody) {
    return;
  }

  const rows = Array.isArray(data) ? data : [];
  tableBody.innerHTML = "";

  rows.forEach((item) => {
    const pictureUrl = toDisplayText(item.picurl, "");
    const linkUrl = toDisplayText(item.url);
    const imageCellHtml = pictureUrl
      ? `<img
          src="${escapeHtmlAttr(pictureUrl)}"
          alt="table-user"
          class="me-2 avatar-xl"
        />`
      : "-";
    const linkCellHtml = `<a
        href="javascript:void(0);"
        class="link-reset fs-20 p-1 text-infjew"
        data-bs-toggle="tooltip"
        data-bs-trigger="hover"
        data-bs-title="${escapeHtmlAttr(linkUrl)}"
        title="${escapeHtmlAttr(linkUrl)}"
        >
          <i class="ti ti-link"></i>
        </a>`;

    const row = document.createElement("tr");
    row.classList.add("banner-row");
    row.dataset.bannerId = toDisplayText(item.id, "");

    row.innerHTML = `
      <td class="text-muted align-middle">
        <span
          class="dragula-handle d-inline-flex align-items-center justify-content-center fs-18 p-1"
          data-bs-toggle="tooltip"
          data-bs-trigger="hover"
          data-bs-title="Drag by handle"
          title="Drag by handle"
        >
          <i class="ti ti-grip-vertical"></i>
        </span>
      </td>
      <td>
        ${imageCellHtml}
      </td>
      <td>${toDisplayText(item.id)}</td>
      <td>${toDisplayText(item.title1)}</td>
      <td>${toDisplayText(item.title2)}</td>
      <td>${toDisplayText(item.subtitle)}</td>
      <td class="text-muted">
        ${linkCellHtml}
      </td>
      <td class="text-muted">
        <a
          href="javascript:void(0);"
          class="link-reset fs-20 p-1 banner-edit-btn"
          data-banner-id="${toDisplayText(item.id, "")}"
          data-bs-toggle="modal"
          data-bs-target="#EditBannerModal"
        >
          <i class="ti ti-pencil"></i>
        </a>
        <a
          href="javascript:void(0);"
          class="link-reset fs-20 p-1 banner-delete-trash"
          data-banner-id="${toDisplayText(item.id, "")}"
          data-bs-toggle="modal"
          data-bs-target="#banner-delete-warning-modal"
        >
          <i class="ti ti-trash"></i>
        </a>
      </td>
    `;

    tableBody.appendChild(row);
  });

  syncBannerEmptyRow();
  initTooltipsIn(tableBody);
  initBannerDragAndDrop();
}

function toggleAddBannerButton(data) {
  const addButton = document.getElementById("add-banner-modal-btn");
  if (!addButton) {
    return;
  }

  const list = Array.isArray(data) ? data : [];
  const maxBannerCount = 3;

  if (list.length >= maxBannerCount) {
    addButton.classList.add("disabled");
    addButton.setAttribute("disabled", "disabled");
  } else {
    addButton.classList.remove("disabled");
    addButton.removeAttribute("disabled");
  }
}

function deleteBanner(bannerId) {
  if (!Number.isInteger(bannerId) || bannerId <= 0) {
    return;
  }

  fetch("/api/banner/delete", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      id: bannerId,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (!data || !data.success) {
        console.error("Delete banner failed:", data && data.message);
        return;
      }

      applyBannerList(data.data || []);
    })
    .catch((error) => {
      console.error("Delete banner failed:", error);
    });
}
