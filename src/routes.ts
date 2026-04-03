import express, { Request, Response, Router } from "express";
import { v4 as uuidv4 } from "uuid";
import QRCode from "qrcode";
import { db } from "./database.js";

const router = Router();

interface Session {
  id: string;
  storyId: string;
  createdAt: Date;
  qrCode: string;
  participants: Map<string, ParticipantData>;
  status: "active" | "completed";
}

interface ParticipantData {
  name: string;
  role: "FE" | "BE" | "QA";
  points: number[];
  totalPoints: number;
  timestamp: Date;
}

// 内存存储会话（可选：也可以从数据库读取）
const sessions = new Map<string, Session>();

// 创建新的估算会话
router.post("/api/session/create", async (req: Request, res: Response) => {
  try {
    const { storyId } = req.body;

    if (!storyId) {
      return res.status(400).json({ error: "storyId is required" });
    }

    const sessionId = uuidv4();
    // 使用请求的实际 host 地址，确保手机扫码可访问
    const protocol = req.protocol;
    const host = req.get("host") || "localhost:4000";
    const baseUrl = process.env.CLIENT_URL || `${protocol}://${host}`;
    const qrCodeData = `${baseUrl}/join/${sessionId}`;

    // 生成二维码
    const qrCode = await QRCode.toDataURL(qrCodeData);

    const session: Session = {
      id: sessionId,
      storyId,
      createdAt: new Date(),
      qrCode,
      participants: new Map(),
      status: "active",
    };

    sessions.set(sessionId, session);

    // 保存到数据库
    await db.saveSession(sessionId, storyId, qrCode);

    res.json({
      sessionId,
      qrCode,
      storyId,
    });
  } catch (error) {
    console.error("创建会话失败:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

// 获取会话信息
router.get("/api/session/:sessionId", (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const participants = Array.from(session.participants.values()).map((p) => ({
    name: p.name,
    role: p.role,
    totalPoints: p.totalPoints,
  }));

  res.json({
    sessionId: session.id,
    storyId: session.storyId,
    status: session.status,
    participants,
    createdAt: session.createdAt,
  });
});

// 参与者加入会话
router.post("/api/session/:sessionId/join", (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { name, role } = req.body;

  if (!name || !role) {
    return res.status(400).json({ error: "name and role are required" });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  // 添加参与者
  const participantId = uuidv4();
  session.participants.set(participantId, {
    name,
    role: role as "FE" | "BE" | "QA",
    points: [],
    totalPoints: 0,
    timestamp: new Date(),
  });

  res.json({
    participantId,
    sessionId,
    storyId: session.storyId,
  });
});

// 提交点数
router.post(
  "/api/session/:sessionId/submit-points",
  async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { participantId, points } = req.body;

    if (!participantId || typeof points !== "number") {
      return res.status(400).json({ error: "participantId and points required" });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const participant = session.participants.get(participantId);
    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    // 更新点数
    participant.points = [points];
    participant.totalPoints = points;

    // 保存到数据库
    await db.savePointSubmission(
      sessionId,
      participantId,
      participant.name,
      participant.role,
      points
    );

    res.json({
      success: true,
      participantName: participant.name,
      pointsSubmitted: points,
    });
  }
);

// 完成估算会话，显示结果
router.post(
  "/api/session/:sessionId/finalize",
  async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const participants = Array.from(session.participants.values());

    // 按角色计算平均值
    const roleStats: {
      [key: string]: { points: number[]; average: number };
    } = {
      FE: { points: [], average: 0 },
      BE: { points: [], average: 0 },
      QA: { points: [], average: 0 },
    };

    participants.forEach((p) => {
      roleStats[p.role].points.push(p.totalPoints);
    });

    // 计算每个角色的平均值
    Object.keys(roleStats).forEach((role) => {
      const points = roleStats[role as "FE" | "BE" | "QA"].points;
      if (points.length > 0) {
        roleStats[role as "FE" | "BE" | "QA"].average =
          points.reduce((a, b) => a + b, 0) / points.length;
      }
    });

    // 计算最终点数（平均值）
    const allPoints = participants.map((p) => p.totalPoints);
    const finalPoints =
      allPoints.length > 0
        ? Math.round(allPoints.reduce((a, b) => a + b, 0) / allPoints.length)
        : 0;

    session.status = "completed";

    const result = {
      sessionId: session.id,
      storyId: session.storyId,
      finalPoints,
      roleStats,
      participantDetails: participants.map((p) => ({
        name: p.name,
        role: p.role,
        points: p.totalPoints,
      })),
    };

    // 保存结果到数据库
    await db.saveFinalResult(
      sessionId,
      session.storyId,
      finalPoints,
      JSON.stringify(result)
    );

    res.json(result);
  }
);

// 更新最终点数和工作时间
router.post(
  "/api/session/:sessionId/update-final",
  async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { finalPoints, hours } = req.body;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // 更新数据库中的最终点数和工作时间
    await db.updateFinalResult(sessionId, finalPoints, hours);

    res.json({
      success: true,
      sessionId,
      finalPoints,
      hours,
    });
  }
);

// 获取历史记录列表
router.get("/api/history", async (req: Request, res: Response) => {
  try {
    const history = await db.getHistory();
    res.json(history);
  } catch (error) {
    console.error("获取历史记录失败:", error);
    res.status(500).json({ error: "Failed to get history" });
  }
});

// 获取历史记录详情
router.get("/api/history/:sessionId", async (req: Request, res: Response) => {
  try {
    const detail = await db.getHistoryDetail(req.params.sessionId);
    if (!detail) return res.status(404).json({ error: "Record not found" });
    res.json(detail);
  } catch (error) {
    console.error("获取历史详情失败:", error);
    res.status(500).json({ error: "Failed to get history detail" });
  }
});

// 删除历史记录
router.delete("/api/history/:sessionId", async (req: Request, res: Response) => {
  try {
    await db.deleteHistory(req.params.sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error("删除历史记录失败:", error);
    res.status(500).json({ error: "Failed to delete history" });
  }
});

export default router;
