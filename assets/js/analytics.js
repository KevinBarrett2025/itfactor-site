(function () {
  const APP_STORE_SELECTOR = "a[data-app-store-link]";
  const SUPPORT_EMAIL_SELECTOR = "a[data-support-email]";
  const VENMO_SELECTOR = 'a[data-support-type="venmo"]';
  const SUPPORT_MODAL_TRIGGER_SELECTOR = '[data-open="venmo"][data-cta-location]';

  function track(eventName, params) {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", eventName, params);
  }

  function pageTypeFromPath(pathname) {
    if (pathname === "/") return "home";
    if (pathname === "/pricing" || pathname === "/pricing/" || pathname === "/pricing/index.html") return "pricing";
    if (pathname === "/guides" || pathname === "/guides/") return "guides_hub";
    if (pathname.startsWith("/guides/")) return "guide_article";
    if (pathname === "/privacy.html") return "privacy";
    if (pathname === "/terms.html") return "terms";
    return "site";
  }

  function ctaLocation(element) {
    return element.getAttribute("data-cta-location") || "unknown";
  }

  function destinationUrl(link) {
    return link.href || "";
  }

  const pageType = pageTypeFromPath(window.location.pathname);

  document.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) return;

      const modalTrigger = event.target.closest(SUPPORT_MODAL_TRIGGER_SELECTOR);
      if (modalTrigger) {
        track("support_modal_open", {
          cta_location: ctaLocation(modalTrigger),
          page_type: pageType
        });
        return;
      }

      const appStoreLink = event.target.closest(APP_STORE_SELECTOR);
      if (appStoreLink instanceof HTMLAnchorElement) {
        track("app_store_click", {
          cta_location: ctaLocation(appStoreLink),
          page_type: pageType,
          destination_url: destinationUrl(appStoreLink)
        });
        return;
      }

      const supportEmailLink = event.target.closest(SUPPORT_EMAIL_SELECTOR);
      if (supportEmailLink instanceof HTMLAnchorElement) {
        track("support_click", {
          support_type: "email",
          cta_location: ctaLocation(supportEmailLink),
          destination_url: destinationUrl(supportEmailLink)
        });
        return;
      }

      const venmoLink = event.target.closest(VENMO_SELECTOR);
      if (venmoLink instanceof HTMLAnchorElement) {
        track("support_click", {
          support_type: "venmo",
          cta_location: ctaLocation(venmoLink),
          destination_url: destinationUrl(venmoLink)
        });
      }
    },
    { capture: true }
  );
})();
