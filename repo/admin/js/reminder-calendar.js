;(function (window) {
  "use strict";

  var DEFAULT_COLOR = "bg-primary";
  var DEFAULT_PRESET_DURATION_MIN = 30;
  var SAVE_API = "/api/reminder/slot/save";
  var DELETE_API = "/api/reminder/slot/delete";
  var SCHEDULE_API = "/api/reminder/schedule";
  var CALENDAR_MIN_TIME = "05:30:00";
  var CALENDAR_MAX_TIME = "24:00:00";
  var MIN_VISIBLE_MINUTE = 5 * 60 + 30;

  function jsDayToWeekday(jsDay) {
    return jsDay === 0 ? 7 : jsDay;
  }

  function minuteOfDay(date) {
    return date.getHours() * 60 + date.getMinutes();
  }

  function withDayMinutes(date, minutes) {
    var result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    result.setMinutes(minutes);
    return result;
  }

  function localDateKey(date) {
    var yyyy = String(date.getFullYear());
    var mm = String(date.getMonth() + 1).padStart(2, "0");
    var dd = String(date.getDate()).padStart(2, "0");
    return yyyy + "-" + mm + "-" + dd;
  }

  function cloneDate(date) {
    return new Date(date.getTime());
  }

  function buildOccurrenceId(slotId, dayDate) {
    return "slot-" + String(slotId) + "-" + localDateKey(dayDate);
  }

  function getRoundedNowRange() {
    var now = new Date();
    now.setSeconds(0, 0);
    var roundedMinutes = Math.floor(now.getMinutes() / 30) * 30;
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), roundedMinutes, 0, 0);
    if (minuteOfDay(start) < MIN_VISIBLE_MINUTE) {
      start = withDayMinutes(start, MIN_VISIBLE_MINUTE);
    }
    var end = new Date(start.getTime());
    end.setMinutes(end.getMinutes() + 30);
    return { start: start, end: end };
  }

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

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function ReminderCalendar() {
    this.calendarEl = document.getElementById("calendar");
    this.modalEl = document.getElementById("event-modal");
    this.formEl = document.getElementById("forms-event");
    this.titleEl = document.getElementById("event-title");
    this.categoryEl = document.getElementById("event-category");
    this.audioEl = document.getElementById("event-audio");
    this.modalTitleEl = document.getElementById("modal-title");
    this.btnNewEvent = document.getElementById("btn-new-event");
    this.btnDeleteEvent = document.getElementById("btn-delete-event");
    this.externalEventsEl = document.getElementById("external-events");

    this.modal = null;
    this.calendar = null;
    this.externalDraggable = null;
    this.slots = [];
    this.slotMap = new Map();
    this.audios = [];
    this.presets = [];
    this.presetMap = new Map();
    this.selectedSlotId = null;
    this.selectedRange = null;
    this.timezoneName = "Asia/Shanghai";
  }

  ReminderCalendar.prototype.init = function () {
    if (!this.calendarEl || !this.modalEl || !this.formEl || !window.FullCalendar) {
      return;
    }

    this.modal = new bootstrap.Modal(this.modalEl, { backdrop: "static" });
    this.renderCalendar();
    this.bindActions();
    this.renderAudioOptions();
    this.loadSchedule();
  };

  ReminderCalendar.prototype.renderCalendar = function () {
    var self = this;
    this.calendar = new FullCalendar.Calendar(this.calendarEl, {
      themeSystem: "bootstrap",
      initialView: "timeGridWeek",
      firstDay: 1,
      allDaySlot: false,
      selectable: true,
      editable: true,
      droppable: true,
      eventStartEditable: true,
      eventDurationEditable: true,
      slotDuration: "00:15:00",
      slotMinTime: CALENDAR_MIN_TIME,
      slotMaxTime: CALENDAR_MAX_TIME,
      scrollTime: CALENDAR_MIN_TIME,
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "timeGridWeek,timeGridDay",
      },
      buttonText: {
        today: "Today",
        week: "Week",
        day: "Day",
        prev: "Prev",
        next: "Next",
      },
      height: window.innerHeight - 200,
      events: function (fetchInfo, successCallback) {
        successCallback(self.buildEvents(fetchInfo.start, fetchInfo.end));
      },
      select: function (info) {
        self.openCreateModal(info.start, info.end);
        self.calendar.unselect();
      },
      eventClick: function (info) {
        self.openEditModal(info.event);
      },
      eventDrop: function (info) {
        self.saveMovedEvent(info);
      },
      eventResize: function (info) {
        self.saveMovedEvent(info);
      },
      eventReceive: function (info) {
        self.saveDroppedPreset(info);
      },
    });

    this.calendar.render();
  };

  ReminderCalendar.prototype.buildEvents = function (rangeStart, rangeEnd) {
    var events = [];
    var dayCursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate(), 0, 0, 0, 0);
    var dayLimit = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 0, 0, 0, 0);
    var slots = this.slots;

    while (dayCursor < dayLimit) {
      var weekday = jsDayToWeekday(dayCursor.getDay());
      for (var i = 0; i < slots.length; i += 1) {
        var slot = slots[i];
        if (!slot || !slot.is_enabled || slot.weekday !== weekday) {
          continue;
        }
        var start = withDayMinutes(dayCursor, slot.start_min);
        var end = withDayMinutes(dayCursor, slot.end_min);
        events.push({
          id: buildOccurrenceId(slot.id, dayCursor),
          title: slot.title,
          start: start,
          end: end,
          classNames: [normalizeColorClass(slot.color || DEFAULT_COLOR)],
          extendedProps: {
            slotId: slot.id,
          },
        });
      }
      dayCursor.setDate(dayCursor.getDate() + 1);
    }

    return events;
  };

  ReminderCalendar.prototype.buildFallbackPresetsFromSlots = function (slots) {
    var presets = [];
    for (var i = 0; i < slots.length; i += 1) {
      var slot = slots[i];
      if (!slot || !slot.is_enabled) {
        continue;
      }
      var startMin = Number(slot.start_min || 0);
      var endMin = Number(slot.end_min || 0);
      var durationMin = endMin - startMin;
      if (!Number.isFinite(durationMin) || durationMin < 1) {
        continue;
      }

      presets.push({
        id: "slot-" + String(slot.id),
        name: String(slot.title || "Untitled"),
        duration_min: durationMin,
        audio_id: toPositiveIntOrNull(slot.audio_id),
        color: normalizeColorClass(slot.color || DEFAULT_COLOR),
        is_enabled: true,
        sort_order: Number(slot.sort_order || startMin),
        is_fallback: true,
        source_slot_id: Number(slot.id),
      });
    }
    return presets;
  };

  ReminderCalendar.prototype.loadSchedule = function () {
    var self = this;
    return requestJson(SCHEDULE_API, "GET")
      .then(function (data) {
        var payload = data && data.data ? data.data : {};
        var slots = Array.isArray(payload.slots) ? payload.slots : [];
        var audios = Array.isArray(payload.audios) ? payload.audios : [];
        var presets = Array.isArray(payload.presets) ? payload.presets : [];

        self.timezoneName = payload.timezone || "Asia/Shanghai";
        self.slots = slots;
        self.slotMap = new Map();
        for (var i = 0; i < slots.length; i += 1) {
          var slot = slots[i];
          self.slotMap.set(Number(slot.id), slot);
        }

        self.audios = audios;
        self.renderAudioOptions();

        if (!presets.length) {
          presets = self.buildFallbackPresetsFromSlots(slots);
        }
        self.presets = presets;
        self.presetMap = new Map();
        for (var j = 0; j < presets.length; j += 1) {
          var preset = presets[j];
          if (!preset || preset.id === undefined || preset.id === null) {
            continue;
          }
          self.presetMap.set(String(preset.id), preset);
        }

        self.renderExternalPanel();
        if (self.calendar) {
          self.calendar.refetchEvents();
        }
      })
      .catch(function (err) {
        console.error("Load reminder schedule failed", err);
        Swal.fire({
          title: "Load Failed",
          text: err && err.message ? err.message : "Failed to load reminder schedule",
          icon: "error",
        });
      });
  };

  ReminderCalendar.prototype.renderAudioOptions = function () {
    if (!this.audioEl) {
      return;
    }

    var previousValue = String(this.audioEl.value || "");
    var html = '<option value="">None</option>';
    for (var i = 0; i < this.audios.length; i += 1) {
      var audio = this.audios[i];
      if (!audio || audio.id === undefined || audio.id === null) {
        continue;
      }
      var audioId = String(audio.id);
      var audioName = String(audio.name || ("Audio #" + audioId));
      html += '<option value="' + escapeHtml(audioId) + '">' + escapeHtml(audioName) + "</option>";
    }

    this.audioEl.innerHTML = html;

    if (previousValue) {
      var matched = false;
      for (var idx = 0; idx < this.audioEl.options.length; idx += 1) {
        if (this.audioEl.options[idx].value === previousValue) {
          matched = true;
          break;
        }
      }
      this.audioEl.value = matched ? previousValue : "";
    } else {
      this.audioEl.value = "";
    }
  };

  ReminderCalendar.prototype.initExternalDraggable = function () {
    if (!this.externalEventsEl || !window.FullCalendar || !FullCalendar.Draggable) {
      return;
    }

    if (this.externalDraggable && typeof this.externalDraggable.destroy === "function") {
      this.externalDraggable.destroy();
    }

    var self = this;
    this.externalDraggable = new FullCalendar.Draggable(this.externalEventsEl, {
      itemSelector: ".external-event-item",
      eventData: function (el) {
        var presetId = String(el.getAttribute("data-preset-id") || "");
        var preset = self.presetMap.get(presetId);
        if (!preset) {
          return {
            title: String(el.innerText || "Reminder"),
            classNames: [DEFAULT_COLOR],
            extendedProps: { presetId: presetId },
            duration: { minutes: DEFAULT_PRESET_DURATION_MIN },
          };
        }

        var durationMin = Number(preset.duration_min || DEFAULT_PRESET_DURATION_MIN);
        if (!Number.isFinite(durationMin) || durationMin < 1) {
          durationMin = DEFAULT_PRESET_DURATION_MIN;
        }

        return {
          title: String(preset.name || "Reminder"),
          classNames: [normalizeColorClass(preset.color || DEFAULT_COLOR)],
          extendedProps: {
            presetId: presetId,
          },
          duration: { minutes: Math.floor(durationMin) },
        };
      },
    });
  };

  ReminderCalendar.prototype.renderExternalPanel = function () {
    if (!this.externalEventsEl) {
      return;
    }

    var html =
      '<p class="text-muted mb-1">Timezone: ' +
      escapeHtml(String(this.timezoneName || "Asia/Shanghai")) +
      "</p>" +
      '<p class="text-muted mb-2">Click or drag on the calendar to create reminder slots. Drag/resize to save.</p>';

    var activePresets = [];
    for (var i = 0; i < this.presets.length; i += 1) {
      var preset = this.presets[i];
      if (!preset || preset.is_enabled === false) {
        continue;
      }
      activePresets.push(preset);
    }

    if (!activePresets.length) {
      html += '<p class="text-muted mb-0">No presets available.</p>';
      this.externalEventsEl.innerHTML = html;
      this.initExternalDraggable();
      return;
    }

    html += '<div class="d-grid gap-2">';
    for (var j = 0; j < activePresets.length; j += 1) {
      var item = activePresets[j];
      var itemId = String(item.id);
      var itemName = String(item.name || "Untitled");
      var colorClass = normalizeColorClass(item.color || DEFAULT_COLOR);
      html +=
        '<div class="external-event external-event-item fc-event ' +
        escapeHtml(colorClass) +
        '" data-preset-id="' +
        escapeHtml(itemId) +
        '" style="cursor: move;">' +
        '<i class="ti ti-grip-vertical me-2"></i>' +
        escapeHtml(itemName) +
        "</div>";
    }
    html += "</div>";

    this.externalEventsEl.innerHTML = html;
    this.initExternalDraggable();
  };

  ReminderCalendar.prototype.bindActions = function () {
    var self = this;

    if (this.btnNewEvent) {
      this.btnNewEvent.addEventListener("click", function () {
        var range = getRoundedNowRange();
        self.openCreateModal(range.start, range.end);
      });
    }

    if (this.formEl) {
      this.formEl.addEventListener("submit", function (e) {
        e.preventDefault();
        self.saveFromModal();
      });
    }

    if (this.btnDeleteEvent) {
      this.btnDeleteEvent.addEventListener("click", function () {
        self.deleteSelectedSlot();
      });
    }

    if (this.modalEl) {
      this.modalEl.addEventListener("hidden.bs.modal", function () {
        self.clearModalState();
      });
    }
  };

  ReminderCalendar.prototype.clearModalState = function () {
    this.selectedSlotId = null;
    this.selectedRange = null;
    if (this.formEl) {
      this.formEl.classList.remove("was-validated");
    }
  };

  ReminderCalendar.prototype.openCreateModal = function (start, end) {
    this.selectedSlotId = null;
    this.selectedRange = {
      start: cloneDate(start),
      end: cloneDate(end),
    };
    if (this.formEl) {
      this.formEl.classList.remove("was-validated");
    }
    if (this.modalTitleEl) {
      this.modalTitleEl.textContent = "Create Event";
    }
    if (this.titleEl) {
      this.titleEl.value = "";
    }
    if (this.categoryEl) {
      this.categoryEl.value = DEFAULT_COLOR;
    }
    if (this.audioEl) {
      this.audioEl.value = "";
    }
    if (this.btnDeleteEvent) {
      this.btnDeleteEvent.style.display = "none";
    }
    this.modal.show();
  };

  ReminderCalendar.prototype.openEditModal = function (event) {
    var slotId = Number(event && event.extendedProps ? event.extendedProps.slotId : 0);
    var slot = this.slotMap.get(slotId);
    if (!slot) {
      Swal.fire({
        title: "Data Missing",
        text: "Selected slot is no longer available. Refreshing...",
        icon: "warning",
      });
      this.loadSchedule();
      return;
    }

    this.selectedSlotId = slotId;
    this.selectedRange = {
      start: cloneDate(event.start),
      end: cloneDate(event.end || new Date(event.start.getTime() + 30 * 60 * 1000)),
    };
    if (this.formEl) {
      this.formEl.classList.remove("was-validated");
    }
    if (this.modalTitleEl) {
      this.modalTitleEl.textContent = "Edit Event";
    }
    if (this.titleEl) {
      this.titleEl.value = slot.title || "";
    }
    if (this.categoryEl) {
      this.categoryEl.value = normalizeColorClass(slot.color || DEFAULT_COLOR);
    }
    if (this.audioEl) {
      var editAudioId = toPositiveIntOrNull(slot.audio_id);
      this.audioEl.value = editAudioId ? String(editAudioId) : "";
    }
    if (this.btnDeleteEvent) {
      this.btnDeleteEvent.style.display = "inline-block";
    }
    this.modal.show();
  };

  ReminderCalendar.prototype.buildSavePayload = function (slotId, start, end, title, color, audioId) {
    if (!(start instanceof Date) || !(end instanceof Date)) {
      throw createApiError("Invalid time range");
    }
    var startMin = minuteOfDay(start);
    var startDay = localDateKey(start);
    var endDay = localDateKey(end);
    var endMin = 0;

    if (endDay === startDay) {
      endMin = minuteOfDay(end);
    } else {
      var nextDayMidnight = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + 1,
        0,
        0,
        0,
        0,
      );
      if (end.getTime() === nextDayMidnight.getTime()) {
        endMin = 1440;
      } else {
        throw createApiError("Time range cannot cross day");
      }
    }

    if (endMin <= startMin) {
      throw createApiError("Time range cannot cross day or be empty");
    }

    var existing = slotId ? this.slotMap.get(Number(slotId)) : null;
    var resolvedAudioId;
    if (audioId === undefined) {
      resolvedAudioId = existing ? existing.audio_id : null;
    } else {
      resolvedAudioId = audioId;
    }

    var payload = {
      weekday: jsDayToWeekday(start.getDay()),
      start_min: startMin,
      end_min: endMin,
      title: title,
      color: normalizeColorClass(color || DEFAULT_COLOR),
      note: existing ? existing.note : null,
      audio_id: toPositiveIntOrNull(resolvedAudioId),
      is_enabled: existing ? !!existing.is_enabled : true,
      sort_order: existing ? Number(existing.sort_order || startMin) : startMin,
    };

    if (slotId) {
      payload.id = Number(slotId);
    }
    return payload;
  };

  ReminderCalendar.prototype.saveFromModal = function () {
    var self = this;
    if (!this.formEl || !this.selectedRange) {
      return;
    }

    if (!this.formEl.checkValidity()) {
      this.formEl.classList.add("was-validated");
      return;
    }

    var title = this.titleEl ? String(this.titleEl.value || "").trim() : "";
    var color = this.categoryEl ? String(this.categoryEl.value || "").trim() : DEFAULT_COLOR;
    var audioId = this.audioEl ? toPositiveIntOrNull(String(this.audioEl.value || "")) : null;
    if (!title) {
      this.formEl.classList.add("was-validated");
      return;
    }

    var payload;
    try {
      payload = this.buildSavePayload(
        this.selectedSlotId,
        this.selectedRange.start,
        this.selectedRange.end,
        title,
        color,
        audioId,
      );
    } catch (err) {
      Swal.fire({
        title: "Invalid Time",
        text: err && err.message ? err.message : "Invalid time range",
        icon: "warning",
      });
      return;
    }

    requestJson(SAVE_API, "POST", payload)
      .then(function (data) {
        if (!data || !data.success) {
          throw createApiError((data && data.message) || "Save failed");
        }
        self.modal.hide();
        return self.loadSchedule();
      })
      .catch(function (err) {
        console.error("Save reminder slot failed", err);
        Swal.fire({
          title: "Save Failed",
          text: err && err.message ? err.message : "Save failed",
          icon: "error",
        });
      });
  };

  ReminderCalendar.prototype.deleteSelectedSlot = function () {
    var self = this;
    if (!this.selectedSlotId) {
      return;
    }

    requestJson(DELETE_API, "POST", { id: Number(this.selectedSlotId) })
      .then(function (data) {
        if (!data || !data.success) {
          throw createApiError((data && data.message) || "Delete failed");
        }
        self.modal.hide();
        return self.loadSchedule();
      })
      .catch(function (err) {
        console.error("Delete reminder slot failed", err);
        Swal.fire({
          title: "Delete Failed",
          text: err && err.message ? err.message : "Delete failed",
          icon: "error",
        });
      });
  };

  ReminderCalendar.prototype.saveMovedEvent = function (info) {
    var self = this;
    var event = info ? info.event : null;
    if (!event || !event.start) {
      return;
    }

    var slotId = Number(event.extendedProps ? event.extendedProps.slotId : 0);
    var slot = this.slotMap.get(slotId);
    if (!slot) {
      info.revert();
      this.loadSchedule();
      return;
    }

    var end = event.end ? cloneDate(event.end) : new Date(event.start.getTime() + 30 * 60 * 1000);
    var payload;
    try {
      payload = this.buildSavePayload(
        slotId,
        cloneDate(event.start),
        end,
        String(event.title || slot.title || "").trim(),
        normalizeColorClass((slot && slot.color) || DEFAULT_COLOR),
        slot.audio_id,
      );
    } catch (err) {
      info.revert();
      Swal.fire({
        title: "Move Rejected",
        text: err && err.message ? err.message : "Invalid time range",
        icon: "warning",
      });
      return;
    }

    requestJson(SAVE_API, "POST", payload)
      .then(function (data) {
        if (!data || !data.success) {
          throw createApiError((data && data.message) || "Save failed");
        }
        return self.loadSchedule();
      })
      .catch(function (err) {
        console.error("Save moved reminder slot failed", err);
        info.revert();
        Swal.fire({
          title: "Move Failed",
          text: err && err.message ? err.message : "Move failed",
          icon: "error",
        });
      });
  };

  ReminderCalendar.prototype.saveDroppedPreset = function (info) {
    var self = this;
    var event = info ? info.event : null;
    if (!event || !event.start) {
      if (info && typeof info.revert === "function") {
        info.revert();
      }
      return;
    }

    var presetId = String(event.extendedProps ? event.extendedProps.presetId || "" : "");
    var preset = this.presetMap.get(presetId);
    if (!preset) {
      if (typeof info.revert === "function") {
        info.revert();
      } else {
        event.remove();
      }
      Swal.fire({
        title: "Preset Missing",
        text: "Preset data is missing. Please refresh and try again.",
        icon: "warning",
      });
      return;
    }

    var durationMin = Number(preset.duration_min || DEFAULT_PRESET_DURATION_MIN);
    if (!Number.isFinite(durationMin) || durationMin < 1) {
      durationMin = DEFAULT_PRESET_DURATION_MIN;
    }
    durationMin = Math.floor(durationMin);

    var start = cloneDate(event.start);
    var end = cloneDate(start);
    end.setMinutes(end.getMinutes() + durationMin);

    var payload;
    try {
      payload = this.buildSavePayload(
        null,
        start,
        end,
        String(preset.name || "Untitled").trim() || "Untitled",
        normalizeColorClass(preset.color || DEFAULT_COLOR),
        preset.audio_id,
      );
    } catch (err) {
      if (typeof info.revert === "function") {
        info.revert();
      } else {
        event.remove();
      }
      Swal.fire({
        title: "Drop Rejected",
        text: err && err.message ? err.message : "Invalid time range",
        icon: "warning",
      });
      return;
    }

    requestJson(SAVE_API, "POST", payload)
      .then(function (data) {
        if (!data || !data.success) {
          throw createApiError((data && data.message) || "Save failed");
        }

        if (event) {
          event.remove();
        }
        return self.loadSchedule();
      })
      .catch(function (err) {
        console.error("Save dropped preset failed", err);
        if (typeof info.revert === "function") {
          info.revert();
        } else if (event) {
          event.remove();
        }
        Swal.fire({
          title: "Drop Failed",
          text: err && err.message ? err.message : "Drop failed",
          icon: "error",
        });
      });
  };

  document.addEventListener("DOMContentLoaded", function () {
    new ReminderCalendar().init();
  });
})(window);
