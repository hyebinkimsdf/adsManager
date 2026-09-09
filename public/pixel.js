/**
 * AI 광고 관리자 픽셀 — 토스 픽셀(Toss Pixel)과 같은 방식의 전환 추적 스니펫에,
 * GTM처럼 "이벤트/트리거를 직접 설정"하는 과정을 AI 자동 설정으로 대체하는 기능을 더한 버전.
 *
 * 사용법:
 *   <script src="https://<이 앱의 도메인>/pixel.js" data-campaign-id="camp-xxxx"></script>
 *
 * 스크립트가 설치되면 자동으로:
 *   1. page_view 이벤트를 보낸다 (방문 집계).
 *   2. 페이지 안의 폼·버튼·링크를 한 번 크롤링해 서버에 기록한다 (AI 자동 설정의 입력 데이터).
 *   3. 관리자가 AI 자동 설정에서 승인한 규칙(EventRule)을 받아와 해당 요소에 리스너를 걸고,
 *      방문자가 클릭/제출하면 자동으로 전환 이벤트를 전송한다.
 *
 * 필요하면 여전히 수동으로도 보낼 수 있다: AdsAI.track("purchase", { value: 49000 });
 */
(function () {
  var currentScript = document.currentScript;
  var campaignId = currentScript ? currentScript.getAttribute("data-campaign-id") : null;
  var origin = currentScript ? new URL(currentScript.src).origin : "";
  var eventsEndpoint = origin + "/api/tracking/events";
  var scanEndpoint = origin + "/api/tracking/scan";
  var rulesEndpoint = origin + "/api/tracking/rules";

  var RULES_CACHE_KEY = "adsai_rules_" + campaignId;
  var RULES_CACHE_TTL_MS = 10 * 60 * 1000;
  var SCAN_MAX_ELEMENTS = 60;

  function track(eventType, params) {
    if (!campaignId) {
      console.warn("[AdsAI] script 태그에 data-campaign-id가 없어서 이벤트를 보내지 못했어요.");
      return;
    }
    var value = params && typeof params.value === "number" ? params.value : 0;
    var body = JSON.stringify({ campaignId: campaignId, eventType: eventType, value: value });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(eventsEndpoint, new Blob([body], { type: "application/json" }));
      return;
    }
    fetch(eventsEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      keepalive: true,
    }).catch(function () {
      // 전송 실패는 조용히 무시한다 — 분석 스크립트가 호스트 페이지를 막으면 안 된다.
    });
  }

  // ---- 1. 자동 page_view ----
  function trackPageView() {
    track("page_view", {});
  }

  // ---- 2. 사이트 크롤링(스캔) ----
  function isVisible(el) {
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    var style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function textOf(el) {
    var text = (el.textContent || "").replace(/\s+/g, " ").trim();
    return text.slice(0, 60);
  }

  // el이 유일하게 식별되도록 최대한 짧은 CSS 선택자를 만든다. id가 있으면 그걸로 끝내고,
  // 없으면 body까지(최대 5단계) nth-of-type 경로를 쌓아 올린다.
  function buildSelector(el) {
    if (el.id && document.querySelectorAll("#" + CSS.escape(el.id)).length === 1) {
      return "#" + CSS.escape(el.id);
    }
    var parts = [];
    var node = el;
    var depth = 0;
    while (node && node.nodeType === 1 && node !== document.body && depth < 5) {
      if (node.id && document.querySelectorAll("#" + CSS.escape(node.id)).length === 1) {
        parts.unshift("#" + CSS.escape(node.id));
        return parts.join(" > ");
      }
      var tag = node.tagName.toLowerCase();
      var parent = node.parentElement;
      if (parent) {
        var siblings = Array.prototype.filter.call(parent.children, function (c) {
          return c.tagName === node.tagName;
        });
        var index = siblings.indexOf(node) + 1;
        parts.unshift(tag + ":nth-of-type(" + index + ")");
      } else {
        parts.unshift(tag);
      }
      node = parent;
      depth++;
    }
    return parts.join(" > ");
  }

  function labelForForm(form) {
    var submit = form.querySelector('button, input[type="submit"]');
    var submitText = submit ? textOf(submit) : "";
    if (submitText) return submitText + " 폼";
    var heading = form.closest("section, div")?.querySelector("h1, h2, h3");
    if (heading) return textOf(heading) + " 폼";
    return "입력 폼";
  }

  function collectElements() {
    var found = [];
    var seen = {};

    function add(el, type, text) {
      if (!isVisible(el)) return;
      if (!text) return;
      var selector = buildSelector(el);
      if (!selector || seen[selector]) return;
      seen[selector] = true;
      found.push({ selector: selector, tag: el.tagName.toLowerCase(), type: type, text: text });
    }

    var forms = document.querySelectorAll("form");
    for (var i = 0; i < forms.length && found.length < SCAN_MAX_ELEMENTS; i++) {
      add(forms[i], "form", labelForForm(forms[i]));
    }

    var buttons = document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]');
    for (var b = 0; b < buttons.length && found.length < SCAN_MAX_ELEMENTS; b++) {
      var btn = buttons[b];
      var btnText = btn.tagName.toLowerCase() === "input" ? btn.value || "" : textOf(btn);
      add(btn, "button", (btnText || "").replace(/\s+/g, " ").trim().slice(0, 60));
    }

    var links = document.querySelectorAll("a[href]");
    for (var l = 0; l < links.length && found.length < SCAN_MAX_ELEMENTS; l++) {
      add(links[l], "link", textOf(links[l]));
    }

    return found.slice(0, SCAN_MAX_ELEMENTS);
  }

  function sendScan() {
    if (!campaignId) return;
    var scanKey = "adsai_scanned_" + campaignId + "_" + location.pathname;
    try {
      if (sessionStorage.getItem(scanKey)) return; // 같은 세션·같은 경로는 한 번만 스캔한다.
    } catch {
      // sessionStorage 접근이 막힌 환경(프라이빗 모드 등)이면 그냥 계속 진행한다.
    }

    var elements = collectElements();
    if (elements.length === 0) return;

    fetch(scanEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: campaignId, pageUrl: location.href, elements: elements }),
      keepalive: true,
    })
      .then(function () {
        try {
          sessionStorage.setItem(scanKey, "1");
        } catch {}
      })
      .catch(function () {
        // 스캔 전송 실패도 조용히 무시한다.
      });
  }

  // ---- 3. AI가 자동 설정한 규칙을 받아와 클릭/제출을 자동 추적 ----
  function readCachedRules() {
    try {
      var raw = sessionStorage.getItem(RULES_CACHE_KEY);
      if (!raw) return null;
      var cached = JSON.parse(raw);
      if (!cached || Date.now() - cached.fetchedAt > RULES_CACHE_TTL_MS) return null;
      return cached.rules;
    } catch {
      return null;
    }
  }

  function writeCachedRules(rules) {
    try {
      sessionStorage.setItem(RULES_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), rules: rules }));
    } catch {}
  }

  function applyRules(rules) {
    if (!rules || rules.length === 0) return;

    var clickRules = rules.filter(function (r) {
      return r.trigger === "click";
    });
    var submitRules = rules.filter(function (r) {
      return r.trigger === "submit";
    });

    if (clickRules.length > 0) {
      document.addEventListener(
        "click",
        function (event) {
          for (var i = 0; i < clickRules.length; i++) {
            var rule = clickRules[i];
            var matched = event.target && event.target.closest ? event.target.closest(rule.selector) : null;
            if (matched) {
              var raw = matched.getAttribute("data-value");
              var value = raw !== null && !isNaN(Number(raw)) ? Number(raw) : 0;
              track(rule.eventType, { value: value });
            }
          }
        },
        true
      );
    }

    if (submitRules.length > 0) {
      document.addEventListener(
        "submit",
        function (event) {
          for (var i = 0; i < submitRules.length; i++) {
            var rule = submitRules[i];
            var matched = event.target && event.target.matches && event.target.matches(rule.selector) ? event.target : null;
            if (matched) {
              var raw = matched.getAttribute("data-value");
              var value = raw !== null && !isNaN(Number(raw)) ? Number(raw) : 0;
              track(rule.eventType, { value: value });
            }
          }
        },
        true
      );
    }
  }

  function loadRules() {
    if (!campaignId) return;
    var cached = readCachedRules();
    if (cached) {
      applyRules(cached);
      return;
    }
    fetch(rulesEndpoint + "?campaignId=" + encodeURIComponent(campaignId))
      .then(function (res) {
        return res.ok ? res.json() : [];
      })
      .then(function (rules) {
        writeCachedRules(rules);
        applyRules(rules);
      })
      .catch(function () {
        // 규칙을 못 받아와도 수동 track() 호출은 계속 동작해야 하므로 조용히 무시한다.
      });
  }

  window.AdsAI = window.AdsAI || { track: track };

  if (campaignId) {
    trackPageView();
    loadRules();
    if (document.readyState === "complete") {
      sendScan();
    } else {
      window.addEventListener("load", sendScan);
    }
  }
})();
