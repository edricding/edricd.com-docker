(function () {
  var usernameElements = document.querySelectorAll(".js-username");
  var sessionRemainingElements = document.querySelectorAll(".js-session-remaining");
  var sessionCountdownTimer = null;

  if ((usernameElements && usernameElements.length > 0) || (sessionRemainingElements && sessionRemainingElements.length > 0)) {
    fetch("/api/session/status", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.loggedIn) {
          if (data.username) {
            usernameElements.forEach(function (el) {
              el.textContent = data.username;
            });
          }
          if (data.expiresAt && sessionRemainingElements.length > 0) {
            startSessionCountdown(data.expiresAt, sessionRemainingElements);
          }
        } else {
          sessionRemainingElements.forEach(function (el) {
            el.textContent = "--";
          });
        }
      })
      .catch(function () {});
  }

  var logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function (e) {
      e.preventDefault();
      fetch("/api/AuthLogout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      })
        .then(function (response) {
          return response.json();
        })
        .then(function (data) {
          if (data && data.success) {
            window.location.href = "/login";
          }
        })
        .catch(function () {});
    });
  }

  function startSessionCountdown(expiresAtSeconds, elements) {
    if (sessionCountdownTimer) {
      clearInterval(sessionCountdownTimer);
    }

    function render() {
      var remaining = Math.max(0, Math.floor(expiresAtSeconds - Date.now() / 1000));
      var text = formatRemaining(remaining);
      elements.forEach(function (el) {
        el.textContent = text;
      });
    }

    render();
    sessionCountdownTimer = setInterval(render, 1000);
  }

  function formatRemaining(totalSeconds) {
    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    if (hours > 0) {
      return (
        String(hours).padStart(2, "0") +
        ":" +
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0")
      );
    }
    return (
      String(minutes).padStart(2, "0") +
      ":" +
      String(seconds).padStart(2, "0")
    );
  }
})();
