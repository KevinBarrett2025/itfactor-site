const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-RHEIR-Password"
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders
    }
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

function getProposalId(url) {
  const match = url.pathname.match(/^\/api\/rheir\/proposals\/([A-Za-z0-9_-]+)\/?$/);
  return match ? match[1] : null;
}

function validatePassword(request, env) {
  const supplied = request.headers.get("X-RHEIR-Password");
  return supplied && env.RHEIR_PROPOSAL_PASSWORD && supplied === env.RHEIR_PROPOSAL_PASSWORD;
}

function normalizePayload(proposalId, payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Request body must be JSON.");
  }

  if (!payload.state || typeof payload.state !== "object") {
    throw new Error("Shared state payload is missing state.");
  }

  return {
    proposalId,
    updatedAt: new Date().toISOString(),
    updatedBy:
      typeof payload.updatedBy === "string" && payload.updatedBy.trim()
        ? payload.updatedBy.trim().slice(0, 40)
        : "Unknown",
    state: {
      fields: payload.state.fields && typeof payload.state.fields === "object" ? payload.state.fields : {},
      calculatorState:
        payload.state.calculatorState && typeof payload.state.calculatorState === "object"
          ? payload.state.calculatorState
          : {},
      sidebarState: payload.state.sidebarState === "collapsed" ? "collapsed" : "expanded"
    }
  };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const proposalId = getProposalId(url);

    if (!proposalId) {
      return errorResponse("Not found.", 404);
    }

    if (!env.RHEIR_PROPOSALS_KV) {
      return errorResponse("KV binding is not configured.", 500);
    }

    if (!env.RHEIR_PROPOSAL_PASSWORD) {
      return errorResponse("Proposal password secret is not configured.", 500);
    }

    if (!validatePassword(request, env)) {
      return errorResponse("Unauthorized.", 401);
    }

    const currentKey = `rheir:proposal:${proposalId}:current`;
    const previousKey = `rheir:proposal:${proposalId}:previous`;

    if (request.method === "GET") {
      const current = await env.RHEIR_PROPOSALS_KV.get(currentKey, "json");
      if (!current) {
        return errorResponse("No shared version has been saved yet.", 404);
      }
      return jsonResponse(current);
    }

    if (request.method === "POST") {
      let payload;
      try {
        payload = await request.json();
      } catch (error) {
        return errorResponse("Invalid JSON body.", 400);
      }

      let normalized;
      try {
        normalized = normalizePayload(proposalId, payload);
      } catch (error) {
        return errorResponse(error.message, 400);
      }

      const current = await env.RHEIR_PROPOSALS_KV.get(currentKey, "json");
      if (current) {
        await env.RHEIR_PROPOSALS_KV.put(previousKey, JSON.stringify(current));
      }

      await env.RHEIR_PROPOSALS_KV.put(currentKey, JSON.stringify(normalized));
      return jsonResponse(normalized);
    }

    return errorResponse("Method not allowed.", 405);
  }
};
