import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { prisma } from "./db.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);
const isProduction = process.env.NODE_ENV === "production";
const eventClients = new Set<express.Response>();

const broadcastTodosChanged = () => {
  const payload = `data: ${JSON.stringify({ type: "todos:changed", at: new Date().toISOString() })}\n\n`;
  for (const client of eventClients) {
    client.write(payload);
  }
};

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(morgan(isProduction ? "combined" : "dev"));

const todoInput = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  completed: z.boolean().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  dueDate: z.string().datetime().optional().nullable()
});

const todoPatch = todoInput.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required"
});

const toTodoData = (input: z.infer<typeof todoInput>) => ({
  title: input.title,
  description: input.description || null,
  completed: input.completed ?? false,
  priority: input.priority ?? "MEDIUM",
  dueDate: input.dueDate ? new Date(input.dueDate) : null
});

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/events", (request, response) => {
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders();
  response.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  eventClients.add(response);

  request.on("close", () => {
    eventClients.delete(response);
  });
});

app.get("/api/todos", async (request, response, next) => {
  try {
    const status = String(request.query.status ?? "all");
    const where =
      status === "active" ? { completed: false } : status === "completed" ? { completed: true } : {};

    const todos = await prisma.todo.findMany({
      where,
      orderBy: [{ completed: "asc" }, { createdAt: "desc" }]
    });

    response.json(todos);
  } catch (error) {
    next(error);
  }
});

app.post("/api/todos", async (request, response, next) => {
  try {
    const input = todoInput.parse(request.body);
    const todo = await prisma.todo.create({ data: toTodoData(input) });
    broadcastTodosChanged();
    response.status(201).json(todo);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/todos/:id", async (request, response, next) => {
  try {
    const input = todoPatch.parse(request.body);
    const todo = await prisma.todo.update({
      where: { id: request.params.id },
      data: {
        ...("title" in input ? { title: input.title } : {}),
        ...("description" in input ? { description: input.description || null } : {}),
        ...("completed" in input ? { completed: input.completed } : {}),
        ...("priority" in input ? { priority: input.priority } : {}),
        ...("dueDate" in input ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {})
      }
    });

    broadcastTodosChanged();
    response.json(todo);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/todos/:id", async (request, response, next) => {
  try {
    await prisma.todo.delete({ where: { id: request.params.id } });
    broadcastTodosChanged();
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.delete("/api/todos", async (_request, response, next) => {
  try {
    const result = await prisma.todo.deleteMany({ where: { completed: true } });
    broadcastTodosChanged();
    response.json({ deleted: result.count });
  } catch (error) {
    next(error);
  }
});

if (isProduction) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const clientPath = path.resolve(__dirname, "../client");

  app.use(express.static(clientPath));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(clientPath, "index.html"));
  });
}

app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
  void next;

  if (error instanceof z.ZodError) {
    response.status(400).json({ message: "Invalid todo payload", issues: error.flatten() });
    return;
  }

  if (typeof error === "object" && error && "code" in error && error.code === "P2025") {
    response.status(404).json({ message: "Todo not found" });
    return;
  }

  console.error(error);
  response.status(500).json({ message: "Something went wrong" });
});

app.listen(port, () => {
  console.log(`Todo API listening on port ${port}`);
});
