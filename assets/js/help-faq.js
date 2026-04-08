(function () {
  const searchInput = document.querySelector("[data-faq-search-input]");
  const items = Array.from(document.querySelectorAll("[data-faq-item]"));
  const groups = Array.from(document.querySelectorAll("[data-faq-group]"));
  const chips = Array.from(document.querySelectorAll("[data-faq-topic-chip]"));
  const results = document.querySelector("[data-faq-results-count]");
  const emptyState = document.querySelector("[data-faq-empty]");

  if (!searchInput || items.length === 0) return;

  const params = new URLSearchParams(window.location.search);
  let query = (params.get("q") || "").trim();
  let activeTopic = (params.get("topic") || "all").trim();

  const normalize = (value) => value.toLowerCase().trim();

  function syncUrl() {
    const nextParams = new URLSearchParams(window.location.search);

    if (query) {
      nextParams.set("q", query);
    } else {
      nextParams.delete("q");
    }

    if (activeTopic && normalize(activeTopic) !== "all") {
      nextParams.set("topic", activeTopic);
    } else {
      nextParams.delete("topic");
    }

    const nextSearch = nextParams.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }

  function syncChips() {
    chips.forEach((chip) => {
      const isActive = normalize(chip.dataset.faqTopic || "all") === normalize(activeTopic);
      chip.setAttribute("aria-pressed", isActive ? "true" : "false");
      chip.classList.toggle("is-active", isActive);
    });
  }

  function applyFilters() {
    const normalizedQuery = normalize(query);
    const normalizedTopic = normalize(activeTopic || "all");
    let visibleCount = 0;

    items.forEach((item) => {
      const topic = normalize(item.dataset.faqTopic || "");
      const text = normalize([
        item.dataset.faqQuestion || "",
        item.dataset.faqKeywords || "",
        item.textContent || ""
      ].join(" "));

      const topicMatch = normalizedTopic === "all" || topic === normalizedTopic;
      const queryMatch = !normalizedQuery || text.includes(normalizedQuery);
      const visible = topicMatch && queryMatch;

      item.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    groups.forEach((group) => {
      const visibleItems = group.querySelectorAll("[data-faq-item]:not([hidden])");
      group.hidden = visibleItems.length === 0;
    });

    if (results) {
      results.innerHTML = visibleCount === 1 ? "<strong>1</strong> answer" : `<strong>${visibleCount}</strong> answers`;
    }

    if (emptyState) {
      emptyState.classList.toggle("is-visible", visibleCount === 0);
    }

    syncChips();
    syncUrl();
  }

  searchInput.value = query;

  searchInput.addEventListener("input", (event) => {
    query = event.target.value.trim();
    applyFilters();
  });

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      activeTopic = chip.dataset.faqTopic || "all";
      applyFilters();
    });
  });

  applyFilters();
})();
