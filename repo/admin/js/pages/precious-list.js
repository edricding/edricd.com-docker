window.preciousListData = [];
let preciousInfoQuill = null;
let preciousListRequestSeq = 0;
let preciousGridInstance = null;
let preciousTableRenderTimer = null;
let preciousTableRenderSeq = 0;

const PRECIOUS_INDEX = {
  ID: 0,
  ITEM_ID: 1,
  TITLE: 2,
  TYPE: 3,
  TAG: 4,
  PRICE: 5,
  DISCOUNT: 6,
  RATING: 7,
  STATUS: 8,
  URL: 9,
  PIC_URL: 10,
  ACTION_ID: 11,
};

window.addEventListener("DOMContentLoaded", function () {
  Promise.all([initializePreciousMetaOptions(), fetchAndRenderPreciousList()]).finally(function () {
    initializePreciousInfoEditor();
    addEventListenerAfterDOMLoaded();
  });
});

function initializePreciousInfoEditor() {
  if (preciousInfoQuill || typeof Quill !== "function") {
    return;
  }

  const editorContainer = document.getElementById("precious-info-desc");
  if (!editorContainer) {
    return;
  }

  preciousInfoQuill = new Quill("#precious-info-desc", {
    theme: "snow",
    modules: {
      toolbar: [
        [{ font: [] }, { size: [] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        ["blockquote", "code-block"],
        [
          { list: "ordered" },
          { list: "bullet" },
        ],
        [{ align: [] }],
        ["clean"],
      ],
    },
  });
}

function getPreciousPictureListContainer() {
  return document.getElementById("precious-info-picture-list");
}

function createPreciousPictureRow(value = "", canRemove = false) {
  const row = document.createElement("div");
  row.className = "d-flex align-items-center gap-2 mb-2 precious-info-picture-row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "form-control precious-info-picture-url";
  input.value = value;
  row.appendChild(input);

  if (canRemove) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-soft-primary btn-icon precious-info-remove-picture-btn";
    button.innerHTML = '<i class="ti ti-minus fs-20"></i>';
    row.appendChild(button);
  }

  return row;
}

function renderPreciousPictureRows(urls) {
  const container = getPreciousPictureListContainer();
  if (!container) {
    return;
  }

  const list = Array.isArray(urls) ? urls.filter((url) => String(url || "").trim() !== "") : [];
  const normalized = list.length > 0 ? list : [""];

  container.innerHTML = "";
  normalized.forEach((url, index) => {
    container.appendChild(createPreciousPictureRow(url, index > 0));
  });
}

function addPreciousPictureRow(value = "") {
  const container = getPreciousPictureListContainer();
  if (!container) {
    return;
  }

  container.appendChild(createPreciousPictureRow(value, true));
}

function collectPreciousPictureUrls() {
  const container = getPreciousPictureListContainer();
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll(".precious-info-picture-url"))
    .map((input) => input.value.trim())
    .filter((url) => url !== "");
}

function setPreciousInfoDescValue(desc) {
  initializePreciousInfoEditor();
  if (!preciousInfoQuill) {
    return;
  }

  if (desc == null) {
    preciousInfoQuill.setText("");
    return;
  }

  if (typeof desc === "string") {
    preciousInfoQuill.clipboard.dangerouslyPasteHTML(desc);
    return;
  }

  if (typeof desc === "object" && Array.isArray(desc.ops)) {
    preciousInfoQuill.setContents(desc);
    return;
  }

  preciousInfoQuill.setText(JSON.stringify(desc, null, 2));
}

function fillPreciousInfoModalFromList(result) {
  if (!result || result.length < 11) {
    return;
  }

  document.getElementById("precious-info-id").value = result[PRECIOUS_INDEX.ID] ?? "";
  document.getElementById("precious-info-code").value = result[PRECIOUS_INDEX.ITEM_ID] ?? "";
  document.getElementById("precious-info-name").value = result[PRECIOUS_INDEX.TITLE] ?? "";
  document.getElementById("precious-info-price").value = result[PRECIOUS_INDEX.PRICE] ?? "";
  document.getElementById("precious-info-type").value = result[PRECIOUS_INDEX.TYPE] ?? "";
  document.getElementById("precious-info-tag").value = result[PRECIOUS_INDEX.TAG] ?? "";
  document.getElementById("precious-info-materials").value = "";
  renderPreciousPictureRows([result[PRECIOUS_INDEX.PIC_URL] ?? ""]);
  setPreciousInfoDescValue(null);
}

function fillPreciousInfoModal(info) {
  if (!info) {
    return;
  }

  document.getElementById("precious-info-id").value = info.precious_id ?? "";
  document.getElementById("precious-info-code").value = info.precious_code ?? "";
  document.getElementById("precious-info-name").value = info.precious_name ?? "";
  document.getElementById("precious-info-type").value = info.precious_type ?? "";
  document.getElementById("precious-info-tag").value = info.precious_tag ?? "";
  document.getElementById("precious-info-materials").value = info.precious_materials ?? "";

  const officialPrice =
    typeof info.precious_official_price === "number" ? info.precious_official_price : "";
  document.getElementById("precious-info-price").value = officialPrice;

  const pictures = Array.isArray(info.precious_pictures) ? info.precious_pictures : [];
  renderPreciousPictureRows(pictures);

  setPreciousInfoDescValue(info.precious_desc);
}

function fetchPreciousInfoByPreciousID(preciousID) {
  return fetch(`/api/precious/info?precious_id=${encodeURIComponent(preciousID)}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  })
    .then((res) => res.json())
    .then((data) => {
      if (!data || !data.success) {
        throw new Error((data && data.message) || "Failed to load precious info");
      }
      return data.data;
    });
}

function updatePreciousInfo(payload) {
  return fetch("/api/precious/info/update", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).then((response) => parseApiJSON(response, "Update precious info failed"));
}

function initializePreciousMetaOptions() {
  return fetch("/api/precious/meta", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  })
    .then((res) => res.json())
    .then((data) => {
      if (!data || !data.success || !data.data) {
        return;
      }

      const types = Array.isArray(data.data.types) ? data.data.types : [];
      const tags = Array.isArray(data.data.tags) ? data.data.tags : [];

      populateSelect("add-precious-type", types);
      populateSelect("edit-precious-type", types);
      populateSelect("add-precious-tag", tags);
      populateSelect("edit-precious-tag", tags);
    })
    .catch((err) => {
      console.error("Failed to load precious meta options", err);
    });
}

function populateSelect(selectId, values) {
  const select = document.getElementById(selectId);
  if (!select) {
    return;
  }

  const selectedValue = select.value;
  const options = Array.isArray(values) ? values : [];

  select.innerHTML = "";
  options.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  if (selectedValue && options.includes(selectedValue)) {
    select.value = selectedValue;
  }
}

function ensureSelectHasValue(selectId, value) {
  const select = document.getElementById(selectId);
  if (!select || !value) {
    return;
  }

  const exists = Array.from(select.options).some((option) => option.value === value);
  if (!exists) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }

  select.value = value;
}

function fillEditForm(result) {
  if (!result || result.length < 11) {
    return;
  }

  document.getElementById("edit-precious-id").value = result[PRECIOUS_INDEX.ID];
  document.getElementById("edit-precious-itemid").value = result[PRECIOUS_INDEX.ITEM_ID];
  document.getElementById("edit-precious-title").value = result[PRECIOUS_INDEX.TITLE];
  document.getElementById("edit-precious-price").value = result[PRECIOUS_INDEX.PRICE];

  const statusRadioId = `edit-statusRadio${result[PRECIOUS_INDEX.STATUS]}`;
  const radio = document.getElementById(statusRadioId);
  if (radio) {
    radio.checked = true;
    radio.setAttribute("checked", "checked");
  }

  const discountInput = document.getElementById("edit-precious-discount");
  if (result[PRECIOUS_INDEX.STATUS] === 2) {
    discountInput.disabled = false;
    discountInput.value = result[PRECIOUS_INDEX.DISCOUNT] !== "-" ? result[PRECIOUS_INDEX.DISCOUNT] : "";
  } else {
    discountInput.disabled = true;
    discountInput.value = "";
  }

  ensureSelectHasValue("edit-precious-type", result[PRECIOUS_INDEX.TYPE]);
  ensureSelectHasValue("edit-precious-tag", result[PRECIOUS_INDEX.TAG]);

  const ratingSelect = document.getElementById("edit-rating-select");
  const selectedRating = Number(result[PRECIOUS_INDEX.RATING]);
  for (let i = 0; i < ratingSelect.options.length; i += 1) {
    const optionRating = Number.parseFloat(ratingSelect.options[i].value);
    if (Math.abs(optionRating - selectedRating) < 0.001) {
      ratingSelect.selectedIndex = i;
      break;
    }
  }

  document.getElementById("edit-precious-url").value = result[PRECIOUS_INDEX.URL];
  document.getElementById("edit-precious-picture-url").value = result[PRECIOUS_INDEX.PIC_URL];
}

function clearPreciousForm() {
  document.getElementById("edit-precious-id").value = "";
  document.getElementById("edit-precious-itemid").value = "";
  document.getElementById("edit-precious-title").value = "";
  document.getElementById("edit-precious-price").value = "";
  document.getElementById("edit-precious-discount").value = "";
  document.getElementById("edit-precious-url").value = "";
  document.getElementById("edit-precious-picture-url").value = "";
  document.getElementById("edit-precious-discount").disabled = true;

  document.querySelectorAll('input[name="edit-statusRadio"]').forEach((radio) => {
    radio.checked = false;
    radio.removeAttribute("checked");
  });

  document.getElementById("edit-precious-type").selectedIndex = 0;
  document.getElementById("edit-precious-tag").selectedIndex = 0;
  document.getElementById("edit-rating-select").selectedIndex = 0;
}

function clearAddPreciousForm() {
  document.getElementById("add-precious-id").value = "";
  document.getElementById("add-precious-title").value = "";
  document.getElementById("add-precious-price").value = "";
  document.getElementById("add-precious-discount").value = "";
  document.getElementById("add-precious-url").value = "";
  document.getElementById("add-precious-picture-url").value = "";

  document.querySelectorAll('input[name="add-statusRadio"]').forEach((radio) => {
    radio.checked = false;
    radio.removeAttribute("checked");
  });

  const defaultStatusRadio = document.getElementById("add-statusRadio1");
  if (defaultStatusRadio) {
    defaultStatusRadio.checked = true;
    defaultStatusRadio.setAttribute("checked", "checked");
  }

  const discountInput = document.getElementById("add-precious-discount");
  if (discountInput) {
    discountInput.disabled = true;
  }

  document.getElementById("add-rating-select").value = "5.0";

  const addTypeSelect = document.getElementById("add-precious-type");
  if (addTypeSelect) {
    addTypeSelect.selectedIndex = 0;
  }

  const addTagSelect = document.getElementById("add-precious-tag");
  if (addTagSelect) {
    addTagSelect.selectedIndex = 0;
  }
}

function hideModalById(modalId) {
  const modalElement = document.getElementById(modalId);
  if (!modalElement || !window.bootstrap || !window.bootstrap.Modal) {
    return;
  }

  const modalInstance =
    bootstrap.Modal.getInstance(modalElement) ||
    bootstrap.Modal.getOrCreateInstance(modalElement);
  if (modalInstance) {
    modalInstance.hide();
  }
}

function parseApiJSON(response, fallbackMessage) {
  const message = fallbackMessage || "Request failed";
  if (!response || !response.ok) {
    const status = response && typeof response.status === "number" ? response.status : "unknown";
    throw new Error(message + " (HTTP " + status + ")");
  }

  return response
    .json()
    .then((data) => data)
    .catch(() => {
      throw new Error(message + " (Invalid JSON response)");
    });
}

function applyPreciousListData(items) {
  const formatted = formatPreciousListData(Array.isArray(items) ? items : []);
  preciousListData = formatted;
  reRenderPreciousList(formatted);
  return formatted;
}

function updatePreciousInfoFilledFlag(preciousID, filled) {
  const normalizedID = Number.parseInt(preciousID, 10);
  if (!Number.isInteger(normalizedID) || normalizedID <= 0) {
    return;
  }

  const normalizedFilled = Number(filled) === 1 ? 1 : 0;
  let changed = false;

  const nextRows = preciousListData.map((row) => {
    if (!Array.isArray(row) || Number(row[PRECIOUS_INDEX.ID]) !== normalizedID) {
      return row;
    }

    const nextRow = row.slice();
    const actionData = nextRow[PRECIOUS_INDEX.ACTION_ID];
    const nextAction =
      actionData && typeof actionData === "object"
        ? Object.assign({}, actionData)
        : { id: normalizedID, precious_info_filled: 0 };

    if (Number(nextAction.id) !== normalizedID) {
      nextAction.id = normalizedID;
      changed = true;
    }

    if (Number(nextAction.precious_info_filled) !== normalizedFilled) {
      nextAction.precious_info_filled = normalizedFilled;
      changed = true;
    }

    nextRow[PRECIOUS_INDEX.ACTION_ID] = nextAction;
    return nextRow;
  });

  if (!changed) {
    return;
  }

  preciousListData = nextRows;
  reRenderPreciousList(nextRows);
}

function applyPreciousListResult(result, fallbackMessage) {
  if (!result || !result.success) {
    throw new Error((result && result.message) || fallbackMessage || "Operation failed");
  }

  if (!Array.isArray(result.data)) {
    throw new Error((fallbackMessage || "Operation failed") + " (missing list data)");
  }

  // Invalidate older in-flight list requests so stale responses cannot overwrite new data.
  preciousListRequestSeq += 1;

  applyPreciousListData(result.data);
  return Promise.resolve(result.data);
}

function fetchAndRenderPreciousList(options) {
  const config = options || {};
  const strict = !!config.strict;
  const requestSeq = ++preciousListRequestSeq;
  return fetch("/api/preciouslist", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  })
    .then((res) => parseApiJSON(res, "Failed to fetch precious list"))
    .then((data) => {
      if (!data || !data.success) {
        const message = (data && data.message) || "Failed to fetch precious list";
        console.error("Failed to fetch precious list", message);
        if (strict) {
          throw new Error(message);
        }
        return null;
      }

      // Ignore stale responses; a newer request or mutation has already been applied.
      if (requestSeq !== preciousListRequestSeq) {
        return null;
      }

      applyPreciousListData(data.data || []);
      return data.data || [];
    })
    .catch((err) => {
      console.error("Failed to fetch precious list", err);
      if (strict) {
        throw err;
      }
      return null;
    });
}

function renderPreciousList(data) {
  const container = document.getElementById("table-gridjs");
  if (!container) {
    return;
  }

  if (preciousGridInstance && typeof preciousGridInstance.destroy === "function") {
    preciousGridInstance.destroy();
    preciousGridInstance = null;
  }

  container.innerHTML = "";

  const escapeHtmlAttr = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const renderTooltipLink = (value) => {
    const tooltipValue = String(value ?? "").trim() || "-";
    const safeTooltipValue = escapeHtmlAttr(tooltipValue);
    return gridjs.html(
      `<a
          href="javascript:void(0);"
          class="link-reset fs-20 p-1 text-infjew"
          data-bs-toggle="tooltip"
          data-bs-trigger="hover"
          data-bs-title="${safeTooltipValue}"
          title="${safeTooltipValue}"
        >
          <i class="ti ti-link"></i>
        </a>`
    );
  };

  preciousGridInstance = new gridjs.Grid({
    columns: [
      { name: "ID", width: "50px" },
      { name: "ItemID", width: "200px" },
      { name: "Title", width: "250px" },
      { name: "Type", width: "120px" },
      {
        name: "Tag",
        width: "120px",
        formatter: (e) =>
          gridjs.html(`<span class="badge bg-infjew fs-12 p-1">${e}</span>`),
      },
      { name: "Price", width: "80px" },
      { name: "Discount", width: "80px" },
      { name: "Rating", width: "80px" },
      {
        name: "Status",
        width: "100px",
        formatter: (e) =>
          gridjs.html(
            e === 1
              ? '<span class="badge bg-success fs-12 p-1">Active</span>'
              : e === 0
                ? '<span class="badge bg-primary fs-12 p-1">Sold</span>'
                : e === 2
                  ? '<span class="badge bg-warning fs-12 p-1">Sale</span>'
                  : e === 3
                    ? '<span class="badge bg-danger fs-12 p-1">Unavailable</span>'
                    : '<span class="badge bg-secondary-subtle text-secondary fs-12 p-1">Unknown</span>'
          ),
      },
      {
        name: "Url",
        width: "50px",
        formatter: (e) => renderTooltipLink(e),
      },
      {
        name: "PicUrl",
        width: "50px",
        formatter: (e) => renderTooltipLink(e),
      },
      {
        name: "Action",
        width: "150px",
        formatter: (e) => {
          const actionData = e && typeof e === "object" ? e : { id: e, precious_info_filled: 0 };
          const infoFilled = Number(actionData.precious_info_filled) === 1;
          const infoButtonClass = infoFilled ? "btn-soft-success" : "btn-soft-warning";
          const safeID = escapeHtmlAttr(actionData.id);

          return gridjs.html(
            `<div class="hstack gap-2">
              <a data-bs-toggle="modal" data-bs-target="#EditPreciousModal"
                 data-id="${safeID}"
                 class="btn btn-soft-primary btn-icon btn-sm rounded-circle table-edit-precious-btn">
                <i class="ti ti-edit fs-16"></i>
              </a>
              <a data-bs-toggle="modal" data-bs-target="#EditPreciousInfoModal"
                 data-id="${safeID}"
                 class="btn ${infoButtonClass} btn-icon btn-sm rounded-circle table-edit-precious-info-btn">
                <i class="ti ti-id fs-16"></i>
              </a>
              <a href="javascript:void(0);"
                 class="btn btn-soft-danger btn-icon btn-sm rounded-circle sweet-delete-btn"
                 data-id="${safeID}">
                <i class="ti ti-trash"></i>
              </a>
            </div>`
          );
        },
      },
    ],
    pagination: { limit: 10 },
    sort: true,
    search: true,
    data: data,
  });

  const initTooltips = (scopeEl = container) => {
    if (!window.bootstrap || !window.bootstrap.Tooltip) {
      return;
    }

    scopeEl.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
      bootstrap.Tooltip.getOrCreateInstance(el);
    });
  };

  preciousGridInstance.on("ready", () => {
    initTooltips(container);
  });

  preciousGridInstance.render(container);
  setTimeout(() => {
    initTooltips(container);
  }, 0);

  if (!container.dataset.tooltipDelegated) {
    container.addEventListener(
      "mouseenter",
      (event) => {
        const trigger = event.target.closest('[data-bs-toggle="tooltip"]');
        if (!trigger || !window.bootstrap || !window.bootstrap.Tooltip) {
          return;
        }
        bootstrap.Tooltip.getOrCreateInstance(trigger);
      },
      true
    );
    container.dataset.tooltipDelegated = "1";
  }
}

function reRenderPreciousList(data) {
  const container = document.getElementById("table-gridjs");
  if (!container) {
    return;
  }

  const renderSeq = ++preciousTableRenderSeq;
  if (preciousTableRenderTimer) {
    clearTimeout(preciousTableRenderTimer);
    preciousTableRenderTimer = null;
  }

  container.classList.remove("fade-in");
  container.classList.add("fade-out");

  preciousTableRenderTimer = setTimeout(() => {
    if (renderSeq !== preciousTableRenderSeq) {
      preciousTableRenderTimer = null;
      return;
    }
    renderPreciousList(data);
    container.classList.remove("fade-out");
    container.classList.add("fade-in");
    preciousTableRenderTimer = null;
  }, 300);
}

function addEventListenerAfterDOMLoaded() {
  Array.from(document.getElementsByClassName("form-check-input-add")).forEach((radio) => {
    radio.addEventListener("click", () => {
      if (document.getElementById("add-statusRadio2").checked) {
        document.getElementById("add-precious-discount").removeAttribute("disabled");
      } else {
        document.getElementById("add-precious-discount").setAttribute("disabled", "disabled");
      }
    });
  });

  Array.from(document.getElementsByClassName("form-check-input-edit")).forEach((radio) => {
    radio.addEventListener("click", () => {
      if (document.getElementById("edit-statusRadio2").checked) {
        document.getElementById("edit-precious-discount").removeAttribute("disabled");
      } else {
        document.getElementById("edit-precious-discount").setAttribute("disabled", "disabled");
      }
    });
  });

  document.getElementById("add-precious-btn").addEventListener("click", () => {
    const preciousData = {
      id: document.getElementById("add-precious-id").value.trim(),
      title: document.getElementById("add-precious-title").value.trim(),
      price: document.getElementById("add-precious-price").value.trim(),
      status:
        document.querySelector('input[name="add-statusRadio"]:checked')?.nextElementSibling.innerText.trim() || "",
      discount: parseFloat(document.getElementById("add-precious-discount").value) || 0,
      type: document.getElementById("add-precious-type").value.trim(),
      tag: document.getElementById("add-precious-tag").value.trim(),
      rating: parseFloat(document.getElementById("add-rating-select").value),
      url: document.getElementById("add-precious-url").value.trim(),
      picurl: document.getElementById("add-precious-picture-url").value.trim(),
    };

    const statusMapping = {
      Sold: 0,
      Active: 1,
      Sale: 2,
      Unavailable: 3,
    };

    const parsedPrice = Number.parseInt(preciousData.price, 10) || 0;
    const parsedDiscount = Number.parseInt(preciousData.discount, 10) || 0;
    const statusCode = statusMapping[preciousData.status];

    const dataToSend = {
      itemid: preciousData.id,
      title: preciousData.title,
      type: preciousData.type,
      tag: preciousData.tag,
      price: parsedPrice,
      status: statusCode,
      discount: statusCode === 2 ? parsedDiscount : parsedPrice,
      rating: preciousData.rating,
      url: preciousData.url,
      picurl: preciousData.picurl,
    };

    AddPreciousList(dataToSend)
      .then(() => {
        hideModalById("AddPreciousModal");
        clearAddPreciousForm();
        Swal.fire({
          title: "Added",
          text: "Precious has been added.",
          icon: "success",
          timer: 1200,
          showConfirmButton: false,
        });
      })
      .catch((error) => {
        console.error("Create precious failed", error);
        Swal.fire({
          title: "Add Failed",
          text: error && error.message ? error.message : "Please try again.",
          icon: "error",
        });
      });
  });

  document.getElementById("close-save-precious-btn").addEventListener("click", () => {
    clearPreciousForm();
  });

  document.getElementById("table-gridjs").addEventListener("click", (e) => {
    const editBtn = e.target.closest(".table-edit-precious-btn");
    if (!editBtn) {
      return;
    }

    const id = parseInt(editBtn.getAttribute("data-id"), 10);
    const result = preciousListData.find((row) => row[PRECIOUS_INDEX.ID] === id);
    fillEditForm(result);
  });

  document.getElementById("table-gridjs").addEventListener("click", (e) => {
    const infoBtn = e.target.closest(".table-edit-precious-info-btn");
    if (!infoBtn) {
      return;
    }

    const id = parseInt(infoBtn.getAttribute("data-id"), 10);
    if (!Number.isInteger(id) || id <= 0) {
      return;
    }

    const result = preciousListData.find((row) => row[PRECIOUS_INDEX.ID] === id);
    fillPreciousInfoModalFromList(result);

    fetchPreciousInfoByPreciousID(id)
      .then((info) => {
        fillPreciousInfoModal(info);
      })
      .catch((err) => {
        console.error("Failed to fetch precious info", err);
      });
  });

  const addPictureBtn = document.getElementById("precious-info-add-picture-btn");
  if (addPictureBtn) {
    addPictureBtn.addEventListener("click", () => {
      addPreciousPictureRow("");
    });
  }

  const pictureListContainer = getPreciousPictureListContainer();
  if (pictureListContainer) {
    pictureListContainer.addEventListener("click", (e) => {
      const removeBtn = e.target.closest(".precious-info-remove-picture-btn");
      if (!removeBtn) {
        return;
      }

      const row = removeBtn.closest(".precious-info-picture-row");
      if (!row) {
        return;
      }

      row.remove();

      const currentUrls = collectPreciousPictureUrls();
      if (currentUrls.length === 0) {
        renderPreciousPictureRows([""]);
      }
    });
  }

  const savePreciousInfoBtn = document.getElementById("save-precious-info-btn");
  if (savePreciousInfoBtn) {
    savePreciousInfoBtn.addEventListener("click", () => {
      const preciousID = Number.parseInt(document.getElementById("precious-info-id").value, 10);
      if (!Number.isInteger(preciousID) || preciousID <= 0) {
        return;
      }

      const pictureUrls = collectPreciousPictureUrls();
      if (pictureUrls.length === 0) {
        Swal.fire({
          title: "Picture Required",
          text: "Please add at least one picture URL.",
          icon: "warning",
        });
        return;
      }

      const descValue = preciousInfoQuill ? preciousInfoQuill.getContents() : null;
      const materialsValue = document.getElementById("precious-info-materials").value.trim();
      const payload = {
        precious_id: preciousID,
        precious_materials: materialsValue,
        precious_pictures: pictureUrls,
        precious_desc: descValue,
      };

      updatePreciousInfo(payload)
        .then((result) => {
          if (!result || !result.success) {
            throw new Error((result && result.message) || "Update failed");
          }

          fillPreciousInfoModal(result.data);

          // Optimistically reflect the backend-computed filled flag immediately.
          if (result.data && Object.prototype.hasOwnProperty.call(result.data, "precious_info_filled")) {
            updatePreciousInfoFilledFlag(preciousID, result.data.precious_info_filled);
          }
        })
        .then(() => {
          hideModalById("EditPreciousInfoModal");

          Swal.fire({
            title: "Updated",
            text: "Precious info has been saved.",
            icon: "success",
            timer: 1200,
            showConfirmButton: false,
          });
        })
        .catch((error) => {
          console.error("Update precious info failed", error);
          Swal.fire({
            title: "Update Failed",
            text: "Please try again.",
            icon: "error",
          });
        });
    });
  }

  document.getElementById("save-precious-btn").addEventListener("click", () => {
    const editPreciousData = {
      id: document.getElementById("edit-precious-id").value.trim(),
      itemid: document.getElementById("edit-precious-itemid").value.trim(),
      title: document.getElementById("edit-precious-title").value.trim(),
      price: document.getElementById("edit-precious-price").value.trim(),
      status:
        document.querySelector('input[name="edit-statusRadio"]:checked')?.nextElementSibling.innerText.trim() || "",
      discount: parseFloat(document.getElementById("edit-precious-discount").value) || 0,
      type: document.getElementById("edit-precious-type").value.trim(),
      tag: document.getElementById("edit-precious-tag").value.trim(),
      rating: parseFloat(document.getElementById("edit-rating-select").value),
      url: document.getElementById("edit-precious-url").value.trim(),
      picurl: document.getElementById("edit-precious-picture-url").value.trim(),
    };

    const statusMapping = {
      Sold: 0,
      Active: 1,
      Sale: 2,
      Unavailable: 3,
    };

    const parsedPrice = Number.parseInt(editPreciousData.price, 10) || 0;
    const parsedDiscount = Number.parseInt(editPreciousData.discount, 10) || 0;
    const statusCode = statusMapping[editPreciousData.status];

    const dataToSend = {
      id: parseInt(editPreciousData.id, 10),
      itemid: editPreciousData.itemid,
      title: editPreciousData.title,
      type: editPreciousData.type,
      tag: editPreciousData.tag,
      price: parsedPrice,
      status: statusCode,
      discount: statusCode === 2 ? parsedDiscount : parsedPrice,
      rating: editPreciousData.rating,
      url: editPreciousData.url,
      picurl: editPreciousData.picurl,
    };

    UpdatePreciousList(dataToSend)
      .then(() => {
        hideModalById("EditPreciousModal");
        clearPreciousForm();
        Swal.fire({
          title: "Saved",
          text: "Precious has been updated.",
          icon: "success",
          timer: 1200,
          showConfirmButton: false,
        });
      })
      .catch((error) => {
        console.error("Update precious failed", error);
        Swal.fire({
          title: "Save Failed",
          text: error && error.message ? error.message : "Please try again.",
          icon: "error",
        });
      });
  });

  document.addEventListener("click", (e) => {
    const deleteBtn = e.target.closest(".sweet-delete-btn");
    if (!deleteBtn) {
      return;
    }

    const id = parseInt(deleteBtn.dataset.id, 10);

    Swal.fire({
      title: "Are you sure?",
      text: "The data will be deleted",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      customClass: {
        confirmButton: "swal2-confirm btn btn-primary",
        cancelButton: "btn btn-warning ms-2",
      },
      buttonsStyling: false,
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      fetch("/api/preciouslist/delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id }),
      })
        .then((res) => parseApiJSON(res, "Delete precious failed", "Delete /api/preciouslist/delete"))
        .then((data) => {
          if (!data || !data.success) {
            Swal.fire({
              title: "Delete Failed",
              text: (data && data.message) || "",
              icon: "error",
            });
            return;
          }

          applyPreciousListResult(data, "Delete precious failed")
            .then(() => {
              Swal.fire({
                title: "Deleted",
                text: "Precious has been deleted.",
                icon: "success",
                timer: 1200,
                showConfirmButton: false,
              });
            })
            .catch((err) => {
              console.error("Failed to refresh precious list after delete", err);
            });
        })
        .catch((err) => {
          console.error("Delete precious failed", err);
          Swal.fire({
            title: "Delete Failed",
            text: "Please try again.",
            icon: "error",
          });
        });
    });
  });
}

function formatPreciousListData(data) {
  return data.map((item) => [
    item.id,
    item.itemid,
    item.title,
    item.type,
    item.tag,
    item.price,
    item.discount,
    item.rating,
    item.status,
    item.url,
    item.picurl,
    {
      id: item.id,
      precious_info_filled: item.precious_info_filled,
    },
  ]);
}

function AddPreciousList(payload) {
  return fetch("/api/preciouslist/create", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
    .then((response) => parseApiJSON(response, "Create precious failed", "Create /api/preciouslist/create"))
    .then((result) => {
      return applyPreciousListResult(result, "Create precious failed");
    });
}

function UpdatePreciousList(payload) {
  return fetch("/api/preciouslist/update", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
    .then((response) => parseApiJSON(response, "Update precious failed", "Update /api/preciouslist/update"))
    .then((result) => {
      return applyPreciousListResult(result, "Update precious failed");
    });
}
