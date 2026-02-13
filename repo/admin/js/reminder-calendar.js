;(function (window) {
  "use strict";

  var DEFAULT_COLOR = "bg-primary";
  var SAVE_API = "/api/reminder/slot/save";
  var DELETE_API = "/api/reminder/slot/delete";
  var SCHEDULE_API = "/api/reminder/schedule";

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

  function ReminderCalendar() {
    this.calendarEl = document.getElementById("calendar");
    this.modalEl = document.getElementById("event-modal");
    this.formEl = document.getElementById("forms-event");
    this.titleEl = document.getElementById("event-title");
    this.categoryEl = document.getElementById("event-category");
    this.modalTitleEl = document.getElementById("modal-title");
    this.btnNewEvent = document.getElementById("btn-new-event");
    this.btnDeleteEvent = document.getElementById("btn-delete-event");
    this.externalEventsEl = document.getElementById("external-events");

    this.modal = null;
    this.calendar = null;
    this.slots = [];
    this.slotMap = new Map();
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
      eventStartEditable: true,
      eventDurationEditable: true,
      slotDuration: "00:15:00",
      slotMinTime: "00:00:00",
      slotMaxTime: "24:00:00",
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
          classNames: slot.color ? [slot.color] : [],
          extendedProps: {
            slotId: slot.id,
          },
        });
      }
      dayCursor.setDate(dayCursor.getDate() + 1);
    }

    return events;
  };

  ReminderCalendar.prototype.loadSchedule = function () {
    var self = this;
    return requestJson(SCHEDULE_API, "GET")
      .then(function (data) {
        var payload = data && data.data ? data.data : {};
        var slots = Array.isArray(payload.slots) ? payload.slots : [];
        self.timezoneName = payload.timezone || "Asia/Shanghai";
        self.slots = slots;
        self.slotMap = new Map();
        for (var i = 0; i < slots.length; i += 1) {
          var slot = slots[i];
          self.slotMap.set(Number(slot.id), slot);
        }

        self.renderExternalPanelHint();
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

  ReminderCalendar.prototype.renderExternalPanelHint = function () {
    if (!this.externalEventsEl) {
      return;
    }
    this.externalEventsEl.innerHTML =
      '<p class="text-muted mb-1">Timezone: ' +
      String(this.timezoneName || "Asia/Shanghai") +
      "</p>" +
      '<p class="text-muted mb-0">Click or drag on the calendar to create reminder slots. Drag/resize to save.</p>';
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
      this.categoryEl.value = slot.color || DEFAULT_COLOR;
    }
    if (this.btnDeleteEvent) {
      this.btnDeleteEvent.style.display = "inline-block";
    }
    this.modal.show();
  };

  ReminderCalendar.prototype.buildSavePayload = function (slotId, start, end, title, color) {
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
    var payload = {
      weekday: jsDayToWeekday(start.getDay()),
      start_min: startMin,
      end_min: endMin,
      title: title,
      color: color || DEFAULT_COLOR,
      note: existing ? existing.note : null,
      audio_id: existing ? existing.audio_id : null,
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
        String((slot && slot.color) || DEFAULT_COLOR),
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

  document.addEventListener("DOMContentLoaded", function () {
    new ReminderCalendar().init();
  });
})(window);
