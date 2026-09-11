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
        text: readWidgetHtml()
      }]
    })
  );

  return server;
}

const port = Number.parseInt(process.env.PORT ?? "8000", 10);
const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

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
