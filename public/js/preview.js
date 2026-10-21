// Preview page logic — loads the generated resume and cover letter HTML
// into the two iframes via /api/resume-html and /api/cover-letter-html.
(function () {
  "use strict";

  var TIMEOUT_MS = 15000;

  function setFrameMessage(frameId, message) {
    var frame = document.getElementById(frameId);
    if (frame) frame.srcdoc =
      '<div style="font-family:system-ui,sans-serif;padding:40px;text-align:center;color:#64748b;">' +
      message + "</div>";
  }

  function fetchHtml(url) {
    // fetch with a timeout so a hung request can't leave "Loading..." forever
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () { controller.abort(); }, TIMEOUT_MS)
      : null;
    return fetch(url, controller ? { signal: controller.signal } : undefined)
      .then(function (res) {
        if (!res.ok) {
          // The API returns JSON errors like {error: "..."}
          return res.json().catch(function () { return {}; }).then(function (body) {
            throw new Error(body.error || "HTTP " + res.status);
          });
        }
        return res.json();
      })
      .then(function (data) {
        if (!data || typeof data.html !== "string") {
          throw new Error("Response contained no HTML");
        }
        return data.html;
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  function loadFrame(frameId, url, label) {
    fetchHtml(url).then(function (html) {
      var frame = document.getElementById(frameId);
      if (frame) frame.srcdoc = html;
    }).catch(function (err) {
      console.error("Failed to load " + label + " preview:", err);
      var hint = /No .+ data found/i.test(err.message)
        ? "No generated " + label + " found. Go back to the editor and generate it first."
        : "Could not load the " + label + " (" + err.message + "). Try regenerating it.";
      setFrameMessage(frameId, "⚠️ " + hint);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadFrame("resumeFrame", "/api/resume-html", "resume");
    loadFrame("coverLetterFrame", "/api/cover-letter-html", "cover letter");
  });
})();
