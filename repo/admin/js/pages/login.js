;(function (window) {
  "use strict";

  var RECAPTCHA_SITE_KEY = "6LeLHmAsAAAAAIMDu4IcbDpVMrSn0QU4u0EyKHVr";
  var RECAPTCHA_TIMEOUT_MS = 15000;
  var isRedirecting = false;
  var isSubmitting = false;
  var initialized = false;

  function sanitizeNextPath(value) {
    if (!value || typeof value !== "string") {
      return "";
    }

    if (value.indexOf("/") !== 0 || value.indexOf("//") === 0) {
      return "";
    }

    if (value === "/login" || value.indexOf("/login?") === 0) {
      return "";
    }

    return value;
  }

  function getTargetPathFromQuery() {
    try {
      var params = new window.URLSearchParams(window.location.search || "");
      return sanitizeNextPath(params.get("next") || "");
    } catch (err) {
      return "";
    }
  }

  function buildLoginPathWithNext(nextPath) {
    var normalized = sanitizeNextPath(nextPath);
    if (!normalized) {
      return "/login";
    }
    return "/login?next=" + encodeURIComponent(normalized);
  }

  function showMsg(el, msg) {
    if (!el) {
      return;
    }

    if (!msg) {
      el.style.display = "none";
      el.textContent = "";
      return;
    }

    el.textContent = msg;
    el.style.display = "block";
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function ensureCanonicalLoginPath() {
    var pathname = (window.location && window.location.pathname) || "";
    if (pathname === "/login") {
      return true;
    }

    // If login HTML is served on a non-login path, normalize URL first.
    if (document.getElementById("login-submit-btn")) {
      var currentPath =
        pathname + (window.location.search || "") + (window.location.hash || "");
      window.location.replace(buildLoginPathWithNext(currentPath));
      return false;
    }

    return true;
  }

  function redirectToTargetOnce(targetPath) {
    if (isRedirecting) {
      return;
    }

    isRedirecting = true;
    var safePath = sanitizeNextPath(targetPath) || "/";
    window.location.replace(safePath);
  }

  function checkSessionReadyOnce() {
    return fetch("/api/session/require", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })
      .then(function (res) {
        return res.status === 204;
      })
      .catch(function () {
        return false;
      });
  }

  function redirectToTargetWhenReady(maxAttempts, delayMs, targetPath) {
    var maxTry = typeof maxAttempts === "number" ? maxAttempts : 8;
    var waitMs = typeof delayMs === "number" ? delayMs : 250;
    var attempt = 0;
    var safePath = sanitizeNextPath(targetPath) || "/";

    function loop() {
      return checkSessionReadyOnce().then(function (ready) {
        if (ready) {
          redirectToTargetOnce(safePath);
          return true;
        }

        attempt += 1;
        if (attempt >= maxTry) {
          return false;
        }

        return delay(waitMs).then(loop);
      });
    }

    return loop();
  }

  function setSubmitting(context, submitting, processingMessage) {
    var message = processingMessage || "";
    isSubmitting = submitting;
    context.btn.disabled = submitting;
    context.usernameEl.disabled = submitting;
    context.passwordEl.disabled = submitting;
    context.btn.textContent = submitting ? "Please wait..." : context.btnDefaultText;

    if (submitting && message) {
      showMsg(context.generalMsgEl, message);
    }
  }

  function executeRecaptchaToken() {
    return new Promise(function (resolve, reject) {
      if (
        !window.grecaptcha ||
        typeof window.grecaptcha.ready !== "function" ||
        typeof window.grecaptcha.execute !== "function"
      ) {
        reject(new Error("reCAPTCHA not ready"));
        return;
      }

      var finished = false;
      var timeoutId = window.setTimeout(function () {
        if (finished) {
          return;
        }
        finished = true;
        reject(new Error("reCAPTCHA timeout"));
      }, RECAPTCHA_TIMEOUT_MS);

      function once(cb) {
        return function (value) {
          if (finished) {
            return;
          }
          finished = true;
          window.clearTimeout(timeoutId);
          cb(value);
        };
      }

      window.grecaptcha.ready(function () {
        if (typeof window.grecaptcha.execute !== "function") {
          once(reject)(new Error("reCAPTCHA not ready"));
          return;
        }

        window.grecaptcha
          .execute(RECAPTCHA_SITE_KEY, { action: "login" })
          .then(once(resolve))
          .catch(once(reject));
      });
    });
  }

  function submitLogin(context) {
    if (isSubmitting || isRedirecting) {
      return;
    }

    showMsg(context.userMsgEl, "");
    showMsg(context.passMsgEl, "");
    showMsg(context.generalMsgEl, "");

    var username = (context.usernameEl.value || "").trim();
    var password = context.passwordEl.value || "";
    var hasError = false;

    if (!username) {
      showMsg(context.userMsgEl, "Please enter your username.");
      hasError = true;
    }
    if (!password) {
      showMsg(context.passMsgEl, "Please enter your password.");
      hasError = true;
    }
    if (hasError) {
      return;
    }

    setSubmitting(context, true, "Verifying reCAPTCHA...");

    executeRecaptchaToken()
      .then(function (token) {
        return fetch("/api/AuthLogin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            username: username,
            password: password,
            recaptchaToken: token,
          }),
        });
      })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return null;
          })
          .then(function (data) {
            return {
              data: data,
            };
          });
      })
      .then(function (result) {
        var data = result.data;
        if (data && data.success) {
          showMsg(context.generalMsgEl, "Login succeeded. Redirecting...");
          return redirectToTargetWhenReady(20, 250, context.targetPath).then(function (redirected) {
            if (!redirected) {
              showMsg(context.generalMsgEl, "Login succeeded, but session is not ready. Please retry.");
            }
          });
        }

        showMsg(context.generalMsgEl, (data && data.message) || "Login failed");
      })
      .catch(function (err) {
        var message = "Login failed";
        if (err && err.message === "reCAPTCHA not ready") {
          message = "reCAPTCHA not ready.";
        } else if (err && err.message === "reCAPTCHA timeout") {
          message = "reCAPTCHA timeout. Please retry.";
        }
        console.error("Login failed", err);
        showMsg(context.generalMsgEl, message);
      })
      .finally(function () {
        if (!isRedirecting) {
          setSubmitting(context, false);
        }
      });
  }

  function initYear() {
    var yearEl = document.getElementById("login-current-year");
    if (!yearEl) {
      return;
    }
    yearEl.textContent = String(new Date().getFullYear());
  }

  function initLoginPage() {
    var btn = document.getElementById("login-submit-btn");
    var usernameEl = document.getElementById("login-username");
    var passwordEl = document.getElementById("login-password");
    var userMsgEl = document.getElementById("login-username-msg");
    var passMsgEl = document.getElementById("login-password-msg");
    var generalMsgEl = document.getElementById("login-general-msg");
    var loginForm = document.getElementById("login-form") || document.querySelector("form.needs-validation");

    if (!btn || !usernameEl || !passwordEl) {
      return;
    }

    var context = {
      btn: btn,
      usernameEl: usernameEl,
      passwordEl: passwordEl,
      userMsgEl: userMsgEl,
      passMsgEl: passMsgEl,
      generalMsgEl: generalMsgEl,
      btnDefaultText: btn.textContent || "Login",
      targetPath: getTargetPathFromQuery() || "/",
    };

    checkSessionReadyOnce().then(function (ready) {
      if (ready) {
        redirectToTargetOnce(context.targetPath);
      }
    });

    btn.addEventListener("click", function (e) {
      if (e) {
        e.preventDefault();
      }
      submitLogin(context);
    });

    if (loginForm) {
      // Capture submit first to prevent any other global submit handler from reloading the page.
      loginForm.addEventListener(
        "submit",
        function (e) {
          e.preventDefault();
          e.stopPropagation();
          submitLogin(context);
        },
        true
      );
    }

    function bindEnterSubmit(inputEl) {
      if (!inputEl) {
        return;
      }
      inputEl.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          submitLogin(context);
        }
      });
    }

    bindEnterSubmit(usernameEl);
    bindEnterSubmit(passwordEl);
  }

  function initialize() {
    if (initialized) {
      return;
    }
    initialized = true;

    if (!ensureCanonicalLoginPath()) {
      return;
    }

    initYear();
    initLoginPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})(window);
