import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { normalizeDecision, validateDecision, type DecisionDefinition } from "./core/schema.js";

const SERVER_VERSION = "0.1.0";
const WIDGET_URI = "ui://decision-picker/decision-picker.html";
const DEFAULT_PUBLIC_ORIGIN = "https://chatgpt-decision-picker-production.up.railway.app";
const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN ?? DEFAULT_PUBLIC_ORIGIN).replace(/\/$/, "");
const REPOSITORY_URL = "https://github.com/JILeXanDR/ChatGPT-Decision-Picker";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const WIDGET_PATH = path.resolve(ROOT_DIR, "dist/widget/index.html");

const optionInput = z.object({
  id: z.string().min(1),
  value: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  recommended: z.boolean().optional()
});

const decisionInput = z.object({
  schemaVersion: z.literal(1),
  decisionId: z.string().min(1).optional(),
  interactionType: z.enum(["single_choice", "multi_select"]),
  layout: z.enum(["cards", "list", "segmented"]),
  question: z.string().min(1),
  description: z.string().optional(),
  options: z.array(optionInput).min(2),
  minSelections: z.number().int().positive().optional(),
  maxSelections: z.number().int().positive().optional()
});

const normalizedOptionOutput = z.object({
  id: z.string().min(1),
  value: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  recommended: z.boolean()
});

const normalizedDecisionOutput = z.object({
  schemaVersion: z.literal(1),
  decisionId: z.string().min(1),
  interactionType: z.enum(["single_choice", "multi_select"]),
  layout: z.enum(["cards", "list", "segmented"]),
  question: z.string().min(1),
  description: z.string().optional(),
  options: z.array(normalizedOptionOutput).min(2),
  minSelections: z.number().int().positive().optional(),
  maxSelections: z.number().int().positive().optional()
});

function readWidgetHtml(): string {
  if (!fs.existsSync(WIDGET_PATH)) {
    throw new Error(`Widget asset missing: ${WIDGET_PATH}. Run "npm run build:widget" first.`);
  }
  return fs.readFileSync(WIDGET_PATH, "utf8");
}

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "chatgpt-decision-picker",
    version: SERVER_VERSION
  });

  registerAppTool(
    server,
    "decision_picker",
    {
      title: "Decision Picker",
      description:
        "Render an inline decision with explicit options. Use when the user should choose by clicking instead of typing. " +
        "Supports single-choice and bounded multi-select decisions with cards, list, or segmented layouts.",
      inputSchema: { decision: decisionInput },
      outputSchema: { decision: normalizedDecisionOutput },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      },
      _meta: { ui: { resourceUri: WIDGET_URI } }
    },
    async ({ decision }) => {
      const validation = validateDecision(decision);
      if (!validation.ok) {
        return {
          isError: true,
          content: [{
            type: "text" as const,
            text: `Unsupported decision schema: ${validation.errors.join("; ")}`
          }]
        };
      }

      const normalized = normalizeDecision(decision as DecisionDefinition);
      return {
        content: [{
          type: "text" as const,
          text: `Interactive decision rendered: ${normalized.question}`
        }],
        structuredContent: { decision: normalized }
      };
    }
  );

  registerAppResource(
    server,
    "Decision Picker Widget",
    WIDGET_URI,
    {
      mimeType: RESOURCE_MIME_TYPE,
      description: "Inline final-choice UI for single-choice and bounded multi-select decisions."
    },
    async () => ({
      contents: [{
        uri: WIDGET_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: readWidgetHtml(),
        _meta: {
          ui: {
            csp: {
              connectDomains: [],
              resourceDomains: []
            },
            domain: PUBLIC_ORIGIN,
            prefersBorder: true
          }
        }
      }]
    })
  );

  return server;
}

function staticPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — ChatGPT Decision Picker</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;max-width:760px;margin:48px auto;padding:0 20px;line-height:1.6;color:#18181b}
    h1,h2{line-height:1.2} a{color:inherit} code{background:#f4f4f5;padding:2px 5px;border-radius:4px}
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${body}
  <hr>
  <p><a href="/">ChatGPT Decision Picker</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/support">Support</a></p>
</body>
</html>`;
}

const port = Number.parseInt(process.env.PORT ?? "8000", 10);
const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

app.get("/", (_req, res) => {
  res.type("html").send(staticPage(
    "ChatGPT Decision Picker",
    `<p>Decision Picker turns explicit choices into inline single-choice or bounded multi-select controls for ChatGPT conversations.</p>
     <p>The public MCP endpoint is <code>${PUBLIC_ORIGIN}/mcp</code>.</p>
     <p>Source: <a href="${REPOSITORY_URL}">${REPOSITORY_URL}</a></p>`
  ));
});

app.get("/privacy", (_req, res) => {
  res.type("html").send(staticPage(
    "Privacy Policy",
    `<p><strong>Effective date:</strong> September 11, 2026.</p>
     <h2>Data handled</h2>
     <p>The app receives the decision text and option metadata that ChatGPT sends to the <code>decision_picker</code> tool so it can validate and render the requested control. The app does not request passwords, payment data, government identifiers, health records, or other sensitive credentials.</p>
     <h2>Storage and use</h2>
     <p>The application does not intentionally persist decision inputs or selections in an application database and does not use analytics or advertising trackers. Inputs are processed to build the widget. A final choice is sent by the widget back into the user's ChatGPT conversation.</p>
     <p>Infrastructure providers may retain operational logs according to their own policies. OpenAI processes conversation data according to the policies that apply to the user's ChatGPT account.</p>
     <h2>Contact</h2>
     <p>Privacy questions can be opened through <a href="${REPOSITORY_URL}/issues">GitHub Issues</a>.</p>`
  ));
});

app.get("/terms", (_req, res) => {
  res.type("html").send(staticPage(
    "Terms of Service",
    `<p><strong>Effective date:</strong> September 11, 2026.</p>
     <p>ChatGPT Decision Picker provides an interface for presenting structured choices and returning a user's selected option to the conversation. It does not make decisions on the user's behalf or execute the selected real-world action.</p>
     <p>Users are responsible for the decisions they make and for any actions taken after a selection. The service is provided as-is without guarantees of uninterrupted availability or fitness for a particular purpose, to the extent permitted by applicable law.</p>
     <p>Do not use the service to submit credentials, payment card data, government identifiers, or other secrets as decision content.</p>
     <p>Questions can be opened through <a href="${REPOSITORY_URL}/issues">GitHub Issues</a>.</p>`
  ));
});

app.get("/support", (_req, res) => {
  res.type("html").send(staticPage(
    "Support",
    `<p>For bugs, compatibility problems, or feature requests, open an issue at <a href="${REPOSITORY_URL}/issues">${REPOSITORY_URL}/issues</a>.</p>
     <p>Include the interaction type, layout, and a minimal example decision when reporting a rendering problem. Do not include secrets or sensitive personal data.</p>`
  ));
});

app.get("/.well-known/openai-apps-challenge", (_req, res) => {
  const token = process.env.OPENAI_APPS_CHALLENGE_TOKEN?.trim();
  if (!token) {
    res.status(404).end();
    return;
  }
  res.type("text/plain").send(token);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, name: "chatgpt-decision-picker", version: SERVER_VERSION });
});

app.all("/mcp", async (req, res) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      });
    }
  }
});

app.listen(port, () => {
  console.log(`ChatGPT Decision Picker listening on http://localhost:${port}/mcp`);
});
