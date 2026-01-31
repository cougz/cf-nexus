import { Hono } from "hono";

type Env = {
  Bindings: {
    DB: D1Database;
    KV: KVNamespace;
    UserDO: DurableObjectNamespace;
  };
};

const app = new Hono<Env>();

app.get("/", (c) => {
  return c.json({ message: "Nexus API" });
});

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default app;
