let activeResetUserId = null;
let usersRequestSeq = 0;

window.addEventListener("DOMContentLoaded", function () {
  fetchUsers();
  bindResetPasswordActions();
  bindCreateUserActions();
});

function fetchUsers() {
  const requestSeq = ++usersRequestSeq;

  fetch("/api/users", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  })
    .then((res) => res.json())
    .then((data) => {
      if (!data || !data.success) {
        renderError((data && data.message) || "Failed to load users.");
        return;
      }

      // Ignore stale responses so old requests cannot overwrite newer table state.
      if (requestSeq !== usersRequestSeq) {
        return;
      }

      renderUsersTable(Array.isArray(data.data) ? data.data : []);
    })
    .catch((err) => {
      console.error("Failed to load users", err);
      renderError("Failed to load users.");
    });
}

function renderUsersTable(users) {
  const container = document.getElementById("table-gridjs");
  if (!container) {
    return;
  }

  const table = document.createElement("table");
  table.className = "table table-sm mb-0";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th style="width: 80px;">ID</th>
      <th>Username</th>
      <th style="width: 140px;">Role</th>
      <th style="width: 140px;">Action</th>
    </tr>
  `;

  const tbody = document.createElement("tbody");

  if (users.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `
      <td colspan="4" class="text-muted">No users found.</td>
    `;
    tbody.appendChild(emptyRow);
  } else {
    users.forEach((user) => {
      const roleValue = (user.role || "").toLowerCase();
      const isSuperAdmin = roleValue === "superadmin";
      const roleBadge = renderRoleBadge(roleValue);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${user.id}</td>
        <td>${escapeHtml(user.username || "")}</td>
        <td>${roleBadge}</td>
        <td>

        <a href="javascript:void(0);" 
                 class="btn btn-soft-warning btn-icon btn-sm rounded-circle reset-password-btn me-1" data-bs-toggle="modal"
            data-bs-target="#ResetPasswordModal"
                 data-id="${user.id}">
                <i class="ti ti-key"></i>
              </a>

              ${
                isSuperAdmin
                  ? ""
                  : `<a href="javascript:void(0);" 
                 class="btn btn-soft-danger btn-icon btn-sm rounded-circle delete-user-btn" 
                 data-id="${user.id}">
                <i class="ti ti-trash"></i>
              </a>`
              }
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  table.appendChild(thead);
  table.appendChild(tbody);

  container.innerHTML = "";
  container.appendChild(table);
}

function renderError(message) {
  const container = document.getElementById("table-gridjs");
  if (!container) {
    return;
  }
  container.innerHTML = `
    <div class="text-danger">${escapeHtml(message)}</div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderRoleBadge(roleValue) {
  const label = roleValue ? roleValue.toUpperCase() : "UNKNOWN";
  if (roleValue === "superadmin") {
    return `<span class="badge bg-danger">${label}</span>`;
  }
  if (roleValue === "admin") {
    return `<span class="badge bg-warning">${label}</span>`;
  }
  if (roleValue === "user") {
    return `<span class="badge bg-success">${label}</span>`;
  }
  return `<span class="badge bg-secondary">${label}</span>`;
}

function bindResetPasswordActions() {
  const tableContainer = document.getElementById("table-gridjs");
  if (tableContainer) {
    tableContainer.addEventListener("click", function (e) {
      const btn = e.target.closest(".reset-password-btn");
      if (!btn) {
        return;
      }
      activeResetUserId = parseInt(btn.getAttribute("data-id"), 10);
      clearResetPasswordForm();
    });

    tableContainer.addEventListener("click", function (e) {
      const deleteBtn = e.target.closest(".delete-user-btn");
      if (!deleteBtn) {
        return;
      }
      const id = parseInt(deleteBtn.getAttribute("data-id"), 10);
      if (!id) {
        return;
      }

      Swal.fire({
        title: "Are you sure?",
        text: "The user will be deleted",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Delete",
        cancelButtonText: "Cancel",
        customClass: {
          confirmButton: "swal2-confirm btn btn-danger",
          cancelButton: "btn btn-warning ms-2",
        },
        buttonsStyling: false,
      }).then((result) => {
        if (!result.isConfirmed) {
          return;
        }
        fetch("/api/users/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: id }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data && data.success) {
              Swal.fire({
                title: "Deleted",
                text: "User deleted successfully",
                icon: "success",
              });
              fetchUsers();
              return;
            }
            renderError((data && data.message) || "Delete failed.");
          })
          .catch((err) => {
            console.error("Delete failed", err);
            renderError("Delete failed.");
          });
      });
    });
  }

  const submitBtn = document.getElementById("reset-password-btn");
  if (submitBtn) {
    submitBtn.addEventListener("click", function () {
      const passwordEl = document.getElementById("reset-password");
      const confirmEl = document.getElementById("reset-password-confirm");

      const password = passwordEl ? passwordEl.value : "";
      const confirm = confirmEl ? confirmEl.value : "";

      if (!activeResetUserId || !password || !confirm) {
        showResetPasswordMsg("Please enter and confirm the new password.");
        return;
      }
      if (password !== confirm) {
        showResetPasswordMsg("Passwords do not match.");
        return;
      }

      submitBtn.disabled = true;
      fetch("/api/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: activeResetUserId,
          password: password,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.success) {
            showResetPasswordMsg("");
            const modalEl = document.getElementById("ResetPasswordModal");
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) {
              modal.hide();
            }
            clearResetPasswordForm();
            return;
          }
          showResetPasswordMsg((data && data.message) || "Update failed.");
        })
        .catch((err) => {
          console.error("Password reset failed", err);
          showResetPasswordMsg("Update failed.");
        })
        .finally(() => {
          submitBtn.disabled = false;
        });
    });
  }
}

function clearResetPasswordForm() {
  const passwordEl = document.getElementById("reset-password");
  const confirmEl = document.getElementById("reset-password-confirm");
  if (passwordEl) passwordEl.value = "";
  if (confirmEl) confirmEl.value = "";
  showResetPasswordMsg("");
}

function showResetPasswordMsg(msg) {
  const msgEl = document.getElementById("reset-password-msg");
  if (!msgEl) {
    return;
  }
  if (!msg) {
    msgEl.style.display = "none";
    msgEl.textContent = "";
    return;
  }
  msgEl.textContent = msg;
  msgEl.style.display = "block";
}

function bindCreateUserActions() {
  const submitBtn = document.getElementById("add-new-user-btn");
  if (!submitBtn) {
    return;
  }

  submitBtn.addEventListener("click", function () {
    const usernameEl = document.getElementById("add-new-user-username");
    const passwordEl = document.getElementById("add-new-user-password");
    const confirmEl = document.getElementById("add-new-user-reset-password");
    const roleEl = document.querySelector(
      'input[name="add-new-user-roleRadio"]:checked'
    );

    const username = (usernameEl && usernameEl.value ? usernameEl.value : "").trim();
    const password = passwordEl ? passwordEl.value : "";
    const confirm = confirmEl ? confirmEl.value : "";
    const role = mapRoleValue(roleEl ? roleEl.id : "");

    if (!username || !password || !confirm || !role) {
      Swal.fire({
        title: "Missing fields",
        text: "Please fill in username, password, and role.",
        icon: "warning",
      });
      return;
    }

    if (password !== confirm) {
      Swal.fire({
        title: "Password mismatch",
        text: "Passwords do not match.",
        icon: "warning",
      });
      return;
    }

    submitBtn.disabled = true;
    fetch("/api/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        username: username,
        password: password,
        role: role,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.success) {
          const modalEl = document.getElementById("AddUserModal");
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) {
            modal.hide();
          }
          clearCreateUserForm();
          Swal.fire({
            title: "Success",
            text: "User created successfully",
            icon: "success",
          });
          fetchUsers();
          return;
        }
        Swal.fire({
          title: "Create failed",
          text: (data && data.message) || "Create failed.",
          icon: "error",
        });
      })
      .catch((err) => {
        console.error("Create user failed", err);
        Swal.fire({
          title: "Create failed",
          text: "Create failed.",
          icon: "error",
        });
      })
      .finally(() => {
        submitBtn.disabled = false;
      });
  });
}

function mapRoleValue(roleId) {
  if (roleId === "add-new-user-roleRadio0") return "superadmin";
  if (roleId === "add-new-user-roleRadio1") return "admin";
  if (roleId === "add-new-user-roleRadio2") return "user";
  return "";
}

function clearCreateUserForm() {
  const usernameEl = document.getElementById("add-new-user-username");
  const passwordEl = document.getElementById("add-new-user-password");
  const confirmEl = document.getElementById("add-new-user-reset-password");
  if (usernameEl) usernameEl.value = "";
  if (passwordEl) passwordEl.value = "";
  if (confirmEl) confirmEl.value = "";

  const roleDefault = document.getElementById("add-new-user-roleRadio1");
  if (roleDefault) {
    roleDefault.checked = true;
  }
}
