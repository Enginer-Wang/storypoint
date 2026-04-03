import express, { Express } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import os from "os";
import { WebSocketServer } from "ws";
import routes from "./routes.js";
import { db } from "./database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const port = process.env.PORT || 4000;

// 中间件
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// 静态文件
app.use(express.static(path.join(__dirname, "../public")));

// API 路由
app.use(routes);

// PC 端主页
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/pc.html"));
});

// 加入页面
app.get("/join/:sessionId", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/mobile.html"));
});

// WebSocket 服务器
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

interface ClientConnection {
  sessionId?: string;
  role?: string;
  name?: string;
  participantId?: string;
}

const clients = new Map<any, ClientConnection>();

wss.on("connection", (ws: any) => {
  const client: ClientConnection = {};
  clients.set(ws, client);

  ws.on("message", (message: string) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "join") {
        client.sessionId = data.sessionId;
        client.role = data.role;
        client.name = data.name;
        client.participantId = data.participantId;

        // 广播参与者加入消息
        broadcastToSession(data.sessionId, {
          type: "participant-joined",
          name: data.name,
          role: data.role,
        });
      } else if (data.type === "points-submitted") {
        // 广播点数提交
        broadcastToSession(data.sessionId, {
          type: "participant-submitted",
          name: data.name,
          role: data.role,
          points: data.points,
        });
      }
    } catch (error) {
      console.error("WebSocket message error:", error);
    }
  });

  ws.on("close", () => {
    if (client.sessionId && client.name) {
      broadcastToSession(client.sessionId, {
        type: "participant-left",
        name: client.name,
      });
    }
    clients.delete(ws);
  });
});

function broadcastToSession(sessionId: string, message: any) {
  const msg = JSON.stringify(message);
  clients.forEach((client, ws) => {
    if (
      client.sessionId === sessionId &&
      (ws as any).readyState === 1 // OPEN
    ) {
      (ws as any).send(msg);
    }
  });
}

// 启动服务器
async function startServer() {
  try {
    // 连接数据库
    await db.connect();
    console.log("Database initialized");

    server.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);

      // 输出局域网 IP，方便手机扫码访问
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
          if (iface.family === "IPv4" && !iface.internal) {
            console.log(`LAN access: http://${iface.address}:${port}/`);
          }
        }
      }
    });
  } catch (error) {
    console.error("启动服务器失败:", error);
    process.exit(1);
  }
}

startServer();

// 优雅关闭
process.on("SIGTERM", async () => {
  console.log("SIGTERM received");
  await db.disconnect();
  process.exit(0);
});
