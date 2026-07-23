(function () {
  const APP_STORE_SELECTOR = "a[data-app-store-link]";
  const SUPPORT_EMAIL_SELECTOR = "a[data-support-email]";
  const VENMO_SELECTOR = 'a[data-support-type="venmo"]';
  const SUPPORT_MODAL_TRIGGER_SELECTOR = '[data-open="venmo"][data-cta-location]';
  const FOUNDER_PROFILE_SELECTOR = "a[data-founder-profile]";

  function track(eventName, params) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: eventName,
      ...params
    });
  }

  function pageTypeFromPath(pathname) {
    if (pathname === "/") return "home";
    if (pathname === "/pricing" || pathname === "/pricing/" || pathname === "/pricing/index.html") return "pricing";
    if (pathname === "/guides" || pathname === "/guides/") return "guides_hub";
    if (pathname.startsWith("/guides/")) return "guide_article";
    if (
      pathname === "/founder/kevin-barrett" ||
      pathname === "/founder/kevin-barrett/" ||
      pathname === "/founder/kevin-barrett/index.html"
    ) return "founder";
    if (pathname === "/privacy" || pathname === "/privacy/" || pathname === "/privacy/index.html") return "privacy";
    if (pathname === "/terms" || pathname === "/terms/" || pathname === "/terms/index.html") return "terms";
    return "site";
  }

  function ctaLocation(element) {
    return element.getAttribute("data-cta-location") || "unknown";
  }

  function destinationUrl(link) {
    return link.href || "";
  }

  const pageType = pageTypeFromPath(window.location.pathname);

  if (pageType === "founder") {
    track("founder_page_view", {
      page_type: pageType
    });
  }

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

      const founderProfileLink = event.target.closest(FOUNDER_PROFILE_SELECTOR);
      if (founderProfileLink instanceof HTMLAnchorElement) {
        track("founder_profile_click", {
          profile_name: founderProfileLink.getAttribute("data-profile-name") || "unknown",
          destination_url: destinationUrl(founderProfileLink),
          cta_location: ctaLocation(founderProfileLink),
          page_type: pageType
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
