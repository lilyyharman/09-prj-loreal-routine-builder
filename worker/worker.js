export default {
  async fetch(request, env) {
    const CORS = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Respond to OPTIONS preflight quickly
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // Provide a simple health check on GET so the preview URL looks active
    if (request.method === "GET") {
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Read the raw request body first so we can debug what the worker actually receives.
    let body = {};
    let rawText = "";
    try {
      rawText = await request.text();
      if (rawText && rawText.trim()) {
        try {
          body = JSON.parse(rawText);
        } catch (err) {
          // Return a helpful debug response showing the raw payload and content-type
          const ct = request.headers.get("content-type") || "(none)";
          return new Response(
            JSON.stringify({
              error: "Invalid JSON body",
              contentType: ct,
              preview: rawText.slice(0, 200),
            }),
            {
              status: 400,
              headers: { ...CORS, "Content-Type": "application/json" },
            }
          );
        }
      }
    } catch (err) {
      // If reading the body failed for any reason, continue with empty body
      body = {};
    }

    // Support shapes: { messages: [...] } (chat history), { selected: [...] }, or { chat: { message: '...' } }
    const messagesFromClient = Array.isArray(body.messages)
      ? body.messages
      : null;
    const selected = Array.isArray(body.selected) ? body.selected : [];
    const chatMessage = body?.chat?.message;

    let payload;
    if (messagesFromClient) {
      // If client sends full messages, ensure there's a system prompt; if not, prepend one.
      const hasSystem =
        messagesFromClient.length > 0 &&
        messagesFromClient[0].role === "system";
      const systemMsg = {
        role: "system",
        content:
          "You are a helpful beauty assistant. Answer user questions about products, routines, and usage clearly and concisely.",
      };
      const messages = hasSystem
        ? messagesFromClient
        : [systemMsg, ...messagesFromClient];

      payload = {
        model: "gpt-4o",
        messages,
        max_tokens: 600,
        temperature: 0.7,
      };
    } else if (chatMessage) {
      // chat flow (simple)
      const systemMsg = {
        role: "system",
        content:
          "You are a helpful beauty assistant. Answer user questions about products, routines, and usage clearly and concisely.",
      };
      payload = {
        model: "gpt-4o",
        messages: [systemMsg, { role: "user", content: String(chatMessage) }],
        max_tokens: 600,
        temperature: 0.7,
      };
    } else if (selected.length > 0) {
      // routine flow
      const systemMessage = {
        role: "system",
        content:
          "You are an expert beauty advisor. Given a list of products with name, brand, category and description, produce a clear, step-by-step routine that uses these products. Keep steps short and practical, include order of use and any timing or cautions. Output plain text suitable for display in a chat window.",
      };
      const userMessage = {
        role: "user",
        content: `Selected products:\n${JSON.stringify(selected, null, 2)}`,
      };
      payload = {
        model: "gpt-4o",
        messages: [systemMessage, userMessage],
        max_tokens: 800,
        temperature: 0.7,
      };
    } else {
      return new Response(
        JSON.stringify({
          error:
            "No valid payload: send { messages } or { selected } or { chat: { message } }",
        }),
        {
          status: 400,
          headers: { ...CORS, "Content-Type": "application/json" },
        }
      );
    }

    if (!env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not set in worker env" }),
        {
          status: 500,
          headers: { ...CORS, "Content-Type": "application/json" },
        }
      );
    }

    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      const text = await resp.text();
      if (!resp.ok) {
        return new Response(
          JSON.stringify({
            error: `OpenAI error: ${resp.status}`,
            details: text,
          }),
          {
            status: resp.status,
            headers: { ...CORS, "Content-Type": "application/json" },
          }
        );
      }

      // parse JSON safely
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { raw: text };
      }

      const content =
        data?.choices?.[0]?.message?.content ??
        data.content ??
        data.text ??
        JSON.stringify(data);

      return new Response(JSON.stringify({ content, raw: data }), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  },
};
