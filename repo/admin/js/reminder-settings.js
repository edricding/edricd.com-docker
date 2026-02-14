;(function (window) {
  "use strict";

  var DEFAULT_COLOR = "bg-primary";
  var DEFAULT_DURATION_MIN = 30;

  var PRESET_LIST_API = "/api/reminder/preset/list";
  var PRESET_SAVE_API = "/api/reminder/preset/save";
  var PRESET_DELETE_API = "/api/reminder/preset/delete";

  var AUDIO_LIST_API = "/api/reminder/audio/list";
  var AUDIO_SAVE_API = "/api/reminder/audio/save";
  var AUDIO_DELETE_API = "/api/reminder/audio/delete";

  function createApiError(message) {
    var err = new Error(message || "Request failed");
    err.isApiError = true;
    return err;
  }

  function requestJson(url, method, body) {
    var options = {
      method: method || "GET",
      credentials: "include",
      cache: "no-store",
      headers: {},
    };

    if (body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    return fetch(url, options).then(function (res) {
      return res
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (res.status === 401) {
            window.location.replace("/login");
            throw createApiError("Unauthorized");
          }
          if (!res.ok) {
            throw createApiError((data && (data.message || data.detail)) || ("HTTP " + String(res.status)));
          }
          return data || {};
        });
    });
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(value) {
    if (value === null || value === undefined) {
      return "";
    }
    return String(value).trim();
  }

  function shortenText(value, maxLength) {
    var text = String(value || "");
    if (text.length <= maxLength) {
      return text;
    }
    return text.slice(0, maxLength - 3) + "...";
  }

  function toPositiveIntOrNull(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    var parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return null;
    }
    return Math.floor(parsed);
  }

  function toNonNegativeIntOrNull(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    var parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
    return Math.floor(parsed);
  }

  function normalizeColorClass(value) {
    if (typeof value !== "string") {
      return DEFAULT_COLOR;
    }
    var trimmed = value.trim();
    if (!trimmed) {
      return DEFAULT_COLOR;
    }
    if (!/^[a-zA-Z0-9_\-\s]+$/.test(trimmed)) {
      return DEFAULT_COLOR;
    }
    return trimmed;
  }

  function ReminderSettings() {
    this.listEl = document.getElementById("event-preset-list");
    this.tableBodyEl = document.getElementById("event-preset-table-body");
    this.btnAddPreset = document.getElementById("btn-add-preset");

    this.modalEl = document.getElementById("preset-modal");
    this.formEl = document.getElementById("preset-form");
    this.modalTitleEl = document.getElementById("preset-modal-title");

    this.presetIdEl = document.getElementById("preset-id");
    this.presetNameEl = document.getElementById("preset-name");
    this.presetDurationEl = document.getElementById("preset-duration");
    this.presetCategoryEl = document.getElementById("preset-category");
    this.presetAudioEl = document.getElementById("preset-audio");
    this.presetSortOrderEl = document.getElementById("preset-sort-order");

    this.btnDeletePreset = document.getElementById("btn-delete-preset");

    this.audioListEl = document.getElementById("audio-list");
    this.audioTableBodyEl = document.getElementById("audio-table-body");
    this.btnAddAudio = document.getElementById("btn-add-audio");

    this.audioModalEl = document.getElementById("audio-modal");
    this.audioFormEl = document.getElementById("audio-form");
    this.audioModalTitleEl = document.getElementById("audio-modal-title");
    this.audioIdEl = document.getElementById("audio-id");
    this.audioNameEl = document.getElementById("audio-name");
    this.audioUrlEl = document.getElementById("audio-url");
    this.btnDeleteAudio = document.getElementById("btn-delete-audio");

    this.modal = null;
    this.audioModal = null;

    this.audios = [];
    this.presets = [];

    this.selectedPresetId = null;
    this.selectedAudioId = null;
  }

  ReminderSettings.prototype.init = function () {
    if (
      !this.listEl ||
      !this.tableBodyEl ||
      !this.formEl ||
      !this.modalEl ||
      !this.audioTableBodyEl ||
      !this.audioFormEl ||
      !this.audioModalEl ||
      !window.bootstrap
    ) {
      return;
    }

    this.modal = new bootstrap.Modal(this.modalEl, { backdrop: "static" });
    this.audioModal = new bootstrap.Modal(this.audioModalEl, { backdrop: "static" });

    this.bindActions();
    this.loadData();
  };

  ReminderSettings.prototype.bindActions = function () {
    var self = this;

    if (this.btnAddPreset) {
      this.btnAddPreset.addEventListener("click", function () {
        self.openCreateModal();
      });
    }

    if (this.listEl) {
      this.listEl.addEventListener("click", function (event) {
        if (event.target.closest(".js-preset-enable")) {
          return;
        }

        var trigger = event.target.closest(".js-preset-edit-btn");
        if (!trigger) {
          return;
        }

        var presetId = Number(trigger.getAttribute("data-preset-id"));
        if (!Number.isFinite(presetId) || presetId < 1) {
          return;
        }

        self.openEditModal(presetId);
      });

      this.listEl.addEventListener("change", function (event) {
        var switchEl = event.target.closest(".js-preset-enable");
        if (!switchEl) {
          return;
        }

        var presetId = Number(switchEl.getAttribute("data-preset-id"));
        if (!Number.isFinite(presetId) || presetId < 1) {
          return;
        }

        self.togglePresetEnabled(presetId, !!switchEl.checked, switchEl);
      });
    }

    if (this.formEl) {
      this.formEl.addEventListener("submit", function (event) {
        event.preventDefault();
        self.savePreset();
      });
    }

    if (this.btnDeletePreset) {
      this.btnDeletePreset.addEventListener("click", function () {
        self.deletePreset();
      });
    }

    if (this.modalEl) {
      this.modalEl.addEventListener("hidden.bs.modal", function () {
        self.resetFormState();
      });
    }

    if (this.btnAddAudio) {
      this.btnAddAudio.addEventListener("click", function () {
        self.openCreateAudioModal();
      });
    }

    if (this.audioListEl) {
      this.audioListEl.addEventListener("click", function (event) {
        var trigger = event.target.closest(".js-audio-edit-btn");
        if (!trigger) {
          return;
        }

        var audioId = Number(trigger.getAttribute("data-audio-id"));
        if (!Number.isFinite(audioId) || audioId < 1) {
          return;
        }

        self.openEditAudioModal(audioId);
      });
    }

    if (this.audioFormEl) {
      this.audioFormEl.addEventListener("submit", function (event) {
        event.preventDefault();
        self.saveAudio();
      });
    }

    if (this.btnDeleteAudio) {
      this.btnDeleteAudio.addEventListener("click", function () {
        self.deleteAudio();
      });
    }

    if (this.audioModalEl) {
      this.audioModalEl.addEventListener("hidden.bs.modal", function () {
        self.resetAudioFormState();
      });
    }
  };

  ReminderSettings.prototype.loadData = function () {
    return Promise.allSettled([this.loadAudios(), this.loadPresets()]).then(function (results) {
      var firstFailure = null;
      for (var i = 0; i < results.length; i += 1) {
        if (results[i] && results[i].status === "rejected") {
          firstFailure = results[i].reason;
          break;
        }
      }

      if (!firstFailure) {
        return;
      }

      console.error("Load reminder settings failed", firstFailure);
      Swal.fire({
        title: "Load Failed",
        text: firstFailure && firstFailure.message ? firstFailure.message : "Failed to load reminder settings",
        icon: "error",
      });
    });
  };

  ReminderSettings.prototype.loadAudios = function () {
    var self = this;
    return requestJson(AUDIO_LIST_API, "GET").then(function (data) {
      if (!data || !data.success) {
        throw createApiError((data && data.message) || "Failed to load audios");
      }

      self.audios = Array.isArray(data.data) ? data.data : [];
      self.renderAudioOptions();
      self.renderAudioList();
    });
  };

  ReminderSettings.prototype.loadPresets = function () {
    var self = this;
    return requestJson(PRESET_LIST_API, "GET").then(function (data) {
      if (!data || !data.success) {
        throw createApiError((data && data.message) || "Failed to load presets");
      }

      self.presets = Array.isArray(data.data) ? data.data : [];
      self.renderPresetList();
    });
  };

  ReminderSettings.prototype.renderAudioOptions = function () {
    if (!this.presetAudioEl) {
      return;
    }

    var previousValue = String(this.presetAudioEl.value || "");
    var html = '<option value="">None</option>';

    for (var i = 0; i < this.audios.length; i += 1) {
      var audio = this.audios[i];
      if (!audio || audio.id === undefined || audio.id === null) {
        continue;
      }
      var audioId = String(audio.id);
      var audioName = this.deriveAudioName(audio);
      html += '<option value="' + escapeHtml(audioId) + '">' + escapeHtml(audioName) + "</option>";
    }

    this.presetAudioEl.innerHTML = html;

    if (previousValue) {
      var matched = false;
      for (var j = 0; j < this.presetAudioEl.options.length; j += 1) {
        if (this.presetAudioEl.options[j].value === previousValue) {
          matched = true;
          break;
        }
      }
      this.presetAudioEl.value = matched ? previousValue : "";
    } else {
      this.presetAudioEl.value = "";
    }
  };

  ReminderSettings.prototype.deriveAudioName = function (audio) {
    var name = normalizeText(audio && audio.name);
    if (name) {
      return name;
    }
    var url = normalizeText(audio && audio.gcs_url);
    if (!url) {
      return "Untitled Audio";
    }
    var parts = url.split("/");
    var last = parts.length ? parts[parts.length - 1] : "";
    return normalizeText(last) || "Untitled Audio";
  };

  ReminderSettings.prototype.renderPresetList = function () {
    if (!this.tableBodyEl) {
      return;
    }

    if (!this.presets.length) {
      this.tableBodyEl.innerHTML =
        '<tr><td colspan="8" class="text-muted">No presets found. Click "Add Preset" to create one.</td></tr>';
      return;
    }

    var html = "";
    for (var i = 0; i < this.presets.length; i += 1) {
      var preset = this.presets[i];
      var presetId = Number(preset && preset.id);
      if (!Number.isFinite(presetId) || presetId < 1) {
        continue;
      }

      var name = String(preset.name || "Untitled");
      var durationMin = Number(preset.duration_min || DEFAULT_DURATION_MIN);
      if (!Number.isFinite(durationMin) || durationMin < 1) {
        durationMin = DEFAULT_DURATION_MIN;
      }
      durationMin = Math.floor(durationMin);

      var colorClass = normalizeColorClass(preset.color || DEFAULT_COLOR);
      var sortOrder = Number(preset.sort_order || 0);
      var audioName =
        preset && preset.audio && preset.audio.name
          ? String(preset.audio.name)
          : (preset.audio_id ? "Audio #" + String(preset.audio_id) : "None");
      var isEnabled = preset.is_enabled !== false;
      var switchId = "preset-enable-" + String(presetId);
      var statusSwitch =
        '<div class="form-check form-switch mb-0 preset-enable-switch">' +
        '<input class="form-check-input js-preset-enable" type="checkbox" role="switch" aria-label="Toggle preset enabled" id="' +
        escapeHtml(switchId) +
        '" data-preset-id="' +
        escapeHtml(String(presetId)) +
        '"' +
        (isEnabled ? " checked" : "") +
        ">" +
        "</div>";

      html +=
        '<tr class="js-preset-row" data-preset-id="' +
        escapeHtml(String(presetId)) +
        '">' +
        "<td>" +
        escapeHtml(String(i + 1)) +
        "</td>" +
        "<td><span class=\"fw-semibold\">" +
        escapeHtml(name) +
        "</span></td>" +
        "<td>" +
        escapeHtml(String(durationMin) + " min") +
        "</td>" +
        "<td>" +
        escapeHtml(audioName) +
        "</td>" +
        "<td>" +
        '<span class="badge preset-color-badge ' +
        escapeHtml(colorClass) +
        '">' +
        escapeHtml(colorClass) +
        "</span>" +
        "</td>" +
        "<td>" +
        escapeHtml(String(Number.isFinite(sortOrder) ? Math.floor(sortOrder) : 0)) +
        "</td>" +
        "<td>" +
        statusSwitch +
        "</td>" +
        '<td class="text-center text-muted">' +
        '<a href="javascript:void(0);" class="link-reset fs-20 p-1 js-preset-edit-btn" data-preset-id="' +
        escapeHtml(String(presetId)) +
        '"><i class="ti ti-edit"></i></a>' +
        "</td>" +
        "</tr>";
    }

    this.tableBodyEl.innerHTML = html || '<tr><td colspan="8" class="text-muted">No presets found.</td></tr>';
  };

  ReminderSettings.prototype.renderAudioList = function () {
    if (!this.audioTableBodyEl) {
      return;
    }

    if (!this.audios.length) {
      this.audioTableBodyEl.innerHTML =
        '<tr><td colspan="5" class="text-muted">No audio records found. Click "Add Audio" to create one.</td></tr>';
      return;
    }

    var html = "";
    for (var i = 0; i < this.audios.length; i += 1) {
      var audio = this.audios[i];
      var audioId = Number(audio && audio.id);
      if (!Number.isFinite(audioId) || audioId < 1) {
        continue;
      }

      var audioName = this.deriveAudioName(audio);
      var audioUrl = normalizeText(audio.gcs_url);
      var audioUrlCell = "-";
      var audioPreviewCell = "-";
      if (audioUrl) {
        audioUrlCell =
          '<a href="javascript:void(0);" ' +
          'class="link-reset fs-20 p-1 text-primary audio-url-tooltip" ' +
          'data-bs-toggle="tooltip" data-bs-trigger="hover focus" data-bs-placement="top" ' +
          'data-bs-title="' +
          escapeHtml(audioUrl) +
          '" title="' +
          escapeHtml(audioUrl) +
          '" aria-label="Show URL tooltip">' +
          '<i class="ti ti-link"></i>' +
          "</a>";

        audioPreviewCell =
          '<audio class="audio-preview-player" controls preload="none" src="' +
          escapeHtml(audioUrl) +
          '"></audio>';
      }

      html +=
        '<tr data-audio-id="' +
        escapeHtml(String(audioId)) +
        '">' +
        "<td>" +
        escapeHtml(String(i + 1)) +
        "</td>" +
        "<td>" +
        escapeHtml(audioName) +
        "</td>" +
        "<td>" +
        audioUrlCell +
        "</td>" +
        "<td>" +
        audioPreviewCell +
        "</td>" +
        '<td class="text-center text-muted">' +
        '<a href="javascript:void(0);" class="link-reset fs-20 p-1 js-audio-edit-btn" data-audio-id="' +
        escapeHtml(String(audioId)) +
        '"><i class="ti ti-edit"></i></a>' +
        "</td>" +
        "</tr>";
    }

    this.audioTableBodyEl.innerHTML = html || '<tr><td colspan="5" class="text-muted">No audio records found.</td></tr>';
    this.initTooltips(this.audioTableBodyEl);
  };

  ReminderSettings.prototype.initTooltips = function (rootEl) {
    if (!window.bootstrap || !window.bootstrap.Tooltip || !rootEl) {
      return;
    }

    var tooltipEls = rootEl.querySelectorAll('[data-bs-toggle="tooltip"]');
    for (var i = 0; i < tooltipEls.length; i += 1) {
      window.bootstrap.Tooltip.getOrCreateInstance(tooltipEls[i]);
    }
  };

  ReminderSettings.prototype.findPresetById = function (presetId) {
    for (var i = 0; i < this.presets.length; i += 1) {
      var item = this.presets[i];
      if (Number(item && item.id) === Number(presetId)) {
        return item;
      }
    }
    return null;
  };

  ReminderSettings.prototype.findAudioById = function (audioId) {
    for (var i = 0; i < this.audios.length; i += 1) {
      var item = this.audios[i];
      if (Number(item && item.id) === Number(audioId)) {
        return item;
      }
    }
    return null;
  };

  ReminderSettings.prototype.buildPayloadFromPreset = function (preset, override) {
    var options = override || {};
    var durationMin = Number(preset && preset.duration_min ? preset.duration_min : DEFAULT_DURATION_MIN);
    if (!Number.isFinite(durationMin) || durationMin < 1 || durationMin > 1439) {
      durationMin = DEFAULT_DURATION_MIN;
    }

    var payload = {
      id: Number(preset.id),
      name: String(preset.name || "Untitled").trim() || "Untitled",
      duration_min: Math.floor(durationMin),
      audio_id: toPositiveIntOrNull(preset.audio_id),
      color: normalizeColorClass(preset.color || DEFAULT_COLOR),
      is_enabled: preset.is_enabled !== false,
      sort_order: toNonNegativeIntOrNull(preset.sort_order),
    };

    if (Object.prototype.hasOwnProperty.call(options, "is_enabled")) {
      payload.is_enabled = !!options.is_enabled;
    }

    return payload;
  };

  ReminderSettings.prototype.togglePresetEnabled = function (presetId, isEnabled, switchEl) {
    var self = this;
    var preset = this.findPresetById(presetId);
    if (!preset) {
      if (switchEl) {
        switchEl.checked = !isEnabled;
      }
      return;
    }

    var previousEnabled = preset.is_enabled !== false;
    var payload = this.buildPayloadFromPreset(preset, { is_enabled: isEnabled });

    if (switchEl) {
      switchEl.disabled = true;
    }

    requestJson(PRESET_SAVE_API, "POST", payload)
      .then(function (data) {
        if (!data || !data.success) {
          throw createApiError((data && data.message) || "Update status failed");
        }

        preset.is_enabled = !!isEnabled;
        self.renderPresetList();
      })
      .catch(function (err) {
        console.error("Toggle preset enabled failed", err);
        if (switchEl) {
          switchEl.checked = previousEnabled;
        }
        Swal.fire({
          title: "Update Failed",
          text: err && err.message ? err.message : "Update status failed",
          icon: "error",
        });
      })
      .finally(function () {
        if (switchEl) {
          switchEl.disabled = false;
        }
      });
  };

  ReminderSettings.prototype.resetFormState = function () {
    this.selectedPresetId = null;
    if (this.presetIdEl) {
      this.presetIdEl.value = "";
    }
    if (this.formEl) {
      this.formEl.classList.remove("was-validated");
    }
  };

  ReminderSettings.prototype.openCreateModal = function () {
    this.selectedPresetId = null;

    if (this.modalTitleEl) {
      this.modalTitleEl.textContent = "Add Preset";
    }
    if (this.presetIdEl) {
      this.presetIdEl.value = "";
    }
    if (this.presetNameEl) {
      this.presetNameEl.value = "";
    }
    if (this.presetDurationEl) {
      this.presetDurationEl.value = String(DEFAULT_DURATION_MIN);
    }
    if (this.presetCategoryEl) {
      this.presetCategoryEl.value = DEFAULT_COLOR;
    }
    if (this.presetAudioEl) {
      this.presetAudioEl.value = "";
    }
    if (this.presetSortOrderEl) {
      this.presetSortOrderEl.value = "";
    }
    if (this.btnDeletePreset) {
      this.btnDeletePreset.style.display = "none";
    }

    if (this.formEl) {
      this.formEl.classList.remove("was-validated");
    }

    this.modal.show();
  };

  ReminderSettings.prototype.openEditModal = function (presetId) {
    var preset = this.findPresetById(presetId);
    if (!preset) {
      Swal.fire({
        title: "Data Missing",
        text: "Selected preset is no longer available. Refreshing list...",
        icon: "warning",
      });
      this.loadPresets();
      return;
    }

    this.selectedPresetId = Number(preset.id);

    if (this.modalTitleEl) {
      this.modalTitleEl.textContent = "Edit Preset";
    }
    if (this.presetIdEl) {
      this.presetIdEl.value = String(preset.id);
    }
    if (this.presetNameEl) {
      this.presetNameEl.value = String(preset.name || "");
    }
    if (this.presetDurationEl) {
      var duration = Number(preset.duration_min || DEFAULT_DURATION_MIN);
      if (!Number.isFinite(duration) || duration < 1) {
        duration = DEFAULT_DURATION_MIN;
      }
      this.presetDurationEl.value = String(Math.floor(duration));
    }
    if (this.presetCategoryEl) {
      this.presetCategoryEl.value = normalizeColorClass(preset.color || DEFAULT_COLOR);
    }
    if (this.presetAudioEl) {
      var audioId = toPositiveIntOrNull(preset.audio_id);
      this.presetAudioEl.value = audioId ? String(audioId) : "";
    }
    if (this.presetSortOrderEl) {
      var sortOrder = Number(preset.sort_order || 0);
      this.presetSortOrderEl.value = Number.isFinite(sortOrder) ? String(Math.floor(sortOrder)) : "0";
    }
    if (this.btnDeletePreset) {
      this.btnDeletePreset.style.display = "inline-block";
    }

    if (this.formEl) {
      this.formEl.classList.remove("was-validated");
    }

    this.modal.show();
  };

  ReminderSettings.prototype.buildSavePayload = function () {
    if (!this.presetNameEl || !this.presetDurationEl || !this.presetCategoryEl) {
      throw createApiError("Form fields are missing");
    }

    var name = String(this.presetNameEl.value || "").trim();
    if (!name) {
      throw createApiError("Preset name is required");
    }

    var durationMin = Number(this.presetDurationEl.value || "");
    if (!Number.isFinite(durationMin) || durationMin < 1 || durationMin > 1439) {
      throw createApiError("Duration must be between 1 and 1439 minutes");
    }

    var currentPreset = this.selectedPresetId ? this.findPresetById(this.selectedPresetId) : null;
    var payload = {
      name: name,
      duration_min: Math.floor(durationMin),
      color: normalizeColorClass(this.presetCategoryEl.value || DEFAULT_COLOR),
      audio_id: toPositiveIntOrNull(this.presetAudioEl ? this.presetAudioEl.value : ""),
      is_enabled: currentPreset ? currentPreset.is_enabled !== false : true,
      sort_order: toNonNegativeIntOrNull(this.presetSortOrderEl ? this.presetSortOrderEl.value : ""),
    };

    if (this.selectedPresetId) {
      payload.id = Number(this.selectedPresetId);
    }

    return payload;
  };

  ReminderSettings.prototype.savePreset = function () {
    var self = this;
    if (!this.formEl) {
      return;
    }

    if (!this.formEl.checkValidity()) {
      this.formEl.classList.add("was-validated");
      return;
    }

    var payload;
    try {
      payload = this.buildSavePayload();
    } catch (err) {
      Swal.fire({
        title: "Invalid Input",
        text: err && err.message ? err.message : "Please check your inputs",
        icon: "warning",
      });
      return;
    }

    requestJson(PRESET_SAVE_API, "POST", payload)
      .then(function (data) {
        if (!data || !data.success) {
          throw createApiError((data && data.message) || "Save failed");
        }

        self.modal.hide();
        return self.loadPresets();
      })
      .then(function () {
        Swal.fire({
          title: "Saved",
          text: "Preset saved successfully",
          icon: "success",
          timer: 1200,
          showConfirmButton: false,
        });
      })
      .catch(function (err) {
        console.error("Save reminder preset failed", err);
        Swal.fire({
          title: "Save Failed",
          text: err && err.message ? err.message : "Save failed",
          icon: "error",
        });
      });
  };

  ReminderSettings.prototype.deletePreset = function () {
    var self = this;
    if (!this.selectedPresetId) {
      return;
    }

    Swal.fire({
      title: "Delete Preset?",
      text: "This preset will be removed permanently.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
    }).then(function (result) {
      if (!result || !result.isConfirmed) {
        return;
      }

      requestJson(PRESET_DELETE_API, "POST", { id: Number(self.selectedPresetId) })
        .then(function (data) {
          if (!data || !data.success) {
            throw createApiError((data && data.message) || "Delete failed");
          }

          self.modal.hide();
          return self.loadPresets();
        })
        .then(function () {
          Swal.fire({
            title: "Deleted",
            text: "Preset deleted",
            icon: "success",
            timer: 1200,
            showConfirmButton: false,
          });
        })
        .catch(function (err) {
          console.error("Delete reminder preset failed", err);
          Swal.fire({
            title: "Delete Failed",
            text: err && err.message ? err.message : "Delete failed",
            icon: "error",
          });
        });
    });
  };

  ReminderSettings.prototype.resetAudioFormState = function () {
    this.selectedAudioId = null;
    if (this.audioIdEl) {
      this.audioIdEl.value = "";
    }
    if (this.audioFormEl) {
      this.audioFormEl.classList.remove("was-validated");
    }
  };

  ReminderSettings.prototype.openCreateAudioModal = function () {
    this.selectedAudioId = null;

    if (this.audioModalTitleEl) {
      this.audioModalTitleEl.textContent = "Add Audio";
    }
    if (this.audioIdEl) {
      this.audioIdEl.value = "";
    }
    if (this.audioNameEl) {
      this.audioNameEl.value = "";
    }
    if (this.audioUrlEl) {
      this.audioUrlEl.value = "";
    }
    if (this.btnDeleteAudio) {
      this.btnDeleteAudio.style.display = "none";
    }
    if (this.audioFormEl) {
      this.audioFormEl.classList.remove("was-validated");
    }

    this.audioModal.show();
  };

  ReminderSettings.prototype.openEditAudioModal = function (audioId) {
    var audio = this.findAudioById(audioId);
    if (!audio) {
      Swal.fire({
        title: "Data Missing",
        text: "Selected audio is no longer available. Refreshing list...",
        icon: "warning",
      });
      this.loadAudios();
      return;
    }

    this.selectedAudioId = Number(audio.id);

    if (this.audioModalTitleEl) {
      this.audioModalTitleEl.textContent = "Edit Audio";
    }
    if (this.audioIdEl) {
      this.audioIdEl.value = String(audio.id);
    }
    if (this.audioNameEl) {
      this.audioNameEl.value = normalizeText(audio.name);
    }
    if (this.audioUrlEl) {
      this.audioUrlEl.value = normalizeText(audio.gcs_url);
    }
    if (this.btnDeleteAudio) {
      this.btnDeleteAudio.style.display = "inline-block";
    }
    if (this.audioFormEl) {
      this.audioFormEl.classList.remove("was-validated");
    }

    this.audioModal.show();
  };

  ReminderSettings.prototype.buildAudioSavePayload = function () {
    var gcsUrl = normalizeText(this.audioUrlEl ? this.audioUrlEl.value : "");
    if (!gcsUrl) {
      throw createApiError("Google Bucket URL is required");
    }

    var payload = {
      gcs_url: gcsUrl,
    };

    var audioName = normalizeText(this.audioNameEl ? this.audioNameEl.value : "");
    if (audioName) {
      payload.name = audioName;
    }

    if (this.selectedAudioId) {
      payload.id = Number(this.selectedAudioId);
      var currentAudio = this.findAudioById(this.selectedAudioId);
      if (currentAudio && Object.prototype.hasOwnProperty.call(currentAudio, "is_active")) {
        payload.is_active = currentAudio.is_active !== false;
      }
    }

    return payload;
  };

  ReminderSettings.prototype.saveAudio = function () {
    var self = this;
    if (!this.audioFormEl) {
      return;
    }

    if (!this.audioFormEl.checkValidity()) {
      this.audioFormEl.classList.add("was-validated");
      return;
    }

    var payload;
    try {
      payload = this.buildAudioSavePayload();
    } catch (err) {
      Swal.fire({
        title: "Invalid Input",
        text: err && err.message ? err.message : "Please check your inputs",
        icon: "warning",
      });
      return;
    }

    requestJson(AUDIO_SAVE_API, "POST", payload)
      .then(function (data) {
        if (!data || !data.success) {
          throw createApiError((data && data.message) || "Save audio failed");
        }

        self.audioModal.hide();
        return Promise.all([self.loadAudios(), self.loadPresets()]);
      })
      .then(function () {
        Swal.fire({
          title: "Saved",
          text: "Audio saved successfully",
          icon: "success",
          timer: 1200,
          showConfirmButton: false,
        });
      })
      .catch(function (err) {
        console.error("Save audio failed", err);
        Swal.fire({
          title: "Save Failed",
          text: err && err.message ? err.message : "Save audio failed",
          icon: "error",
        });
      });
  };

  ReminderSettings.prototype.deleteAudio = function () {
    var self = this;
    if (!this.selectedAudioId) {
      return;
    }

    Swal.fire({
      title: "Delete Audio?",
      text: "This audio record will be removed permanently.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
    }).then(function (result) {
      if (!result || !result.isConfirmed) {
        return;
      }

      requestJson(AUDIO_DELETE_API, "POST", { id: Number(self.selectedAudioId) })
        .then(function (data) {
          if (!data || !data.success) {
            throw createApiError((data && data.message) || "Delete audio failed");
          }

          self.audioModal.hide();
          return Promise.all([self.loadAudios(), self.loadPresets()]);
        })
        .then(function () {
          Swal.fire({
            title: "Deleted",
            text: "Audio deleted",
            icon: "success",
            timer: 1200,
            showConfirmButton: false,
          });
        })
        .catch(function (err) {
          console.error("Delete audio failed", err);
          Swal.fire({
            title: "Delete Failed",
            text: err && err.message ? err.message : "Delete audio failed",
            icon: "error",
          });
        });
    });
  };

  document.addEventListener("DOMContentLoaded", function () {
    new ReminderSettings().init();
  });
})(window);
