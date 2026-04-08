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
  fe: number;
  be: number;
  qa: number;
  totalPoints: number;
  hasSubmitted: boolean;
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

  const participants = Array.from(session.participants.entries()).map(([pid, p]) => ({
    participantId: pid,
    name: p.name,
    hasSubmitted: p.hasSubmitted,
    fe: p.hasSubmitted ? p.fe : 0,
    be: p.hasSubmitted ? p.be : 0,
    qa: p.hasSubmitted ? p.qa : 0,
    total: p.hasSubmitted ? p.totalPoints : 0,
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
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  // 添加参与者
  const participantId = uuidv4();
  session.participants.set(participantId, {
    name,
    fe: 0,
    be: 0,
    qa: 0,
    totalPoints: 0,
    hasSubmitted: false,
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
    const { participantId, fe, be, qa } = req.body;

    if (!participantId) {
      return res.status(400).json({ error: "participantId is required" });
    }

    const feVal = typeof fe === "number" ? fe : 0;
    const beVal = typeof be === "number" ? be : 0;
    const qaVal = typeof qa === "number" ? qa : 0;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const participant = session.participants.get(participantId);
    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    // 更新点数
    participant.fe = feVal;
    participant.be = beVal;
    participant.qa = qaVal;
    participant.totalPoints = feVal + beVal + qaVal;
    participant.hasSubmitted = true;

    // 保存到数据库 (分三条记录: FE / BE / QA)
    if (feVal > 0) await db.savePointSubmission(sessionId, participantId, participant.name, "FE", feVal);
    if (beVal > 0) await db.savePointSubmission(sessionId, participantId, participant.name, "BE", beVal);
    if (qaVal > 0) await db.savePointSubmission(sessionId, participantId, participant.name, "QA", qaVal);

    res.json({
      success: true,
      participantName: participant.name,
      fe: feVal,
      be: beVal,
      qa: qaVal,
      total: participant.totalPoints,
    });
  }
);

// 删除参与者（从会话中完全移除）
router.delete(
  "/api/session/:sessionId/submission/:participantId",
  async (req: Request, res: Response) => {
    const { sessionId, participantId } = req.params;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (!session.participants.has(participantId)) {
      return res.status(404).json({ error: "Participant not found" });
    }

    // 从内存中完全移除该参与者
    session.participants.delete(participantId);

    // 同时删除 submissions 表中该参与者的记录
    await db.deleteParticipantSubmissions(sessionId, participantId);

    res.json({ success: true, participantId });
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

    // 按角色聚合每位参与者的点数
    const roleStats: {
      [key: string]: { points: number[]; average: number; sum: number };
    } = {
      FE: { points: [], average: 0, sum: 0 },
      BE: { points: [], average: 0, sum: 0 },
      QA: { points: [], average: 0, sum: 0 },
    };

    participants.forEach((p) => {
      if (p.fe > 0) roleStats.FE.points.push(p.fe);
      if (p.be > 0) roleStats.BE.points.push(p.be);
      if (p.qa > 0) roleStats.QA.points.push(p.qa);
    });

    // 计算每个角色的平均值和总和
    Object.keys(roleStats).forEach((role) => {
      const pts = roleStats[role].points;
      if (pts.length > 0) {
        roleStats[role].sum = pts.reduce((a, b) => a + b, 0);
        roleStats[role].average = roleStats[role].sum / pts.length;
      }
    });

    // 最终点数 = 三个角色平均值之和(取整)
    const finalPoints = Math.round(
      (roleStats.FE.average || 0) + (roleStats.BE.average || 0) + (roleStats.QA.average || 0)
    );

    // 注意：不再改变 session.status，也不写入数据库
    // 只在前端 Save 时才持久化

    const result = {
      sessionId: session.id,
      storyId: session.storyId,
      finalPoints,
      roleStats,
      participantDetails: participants.map((p) => ({
        name: p.name,
        fe: p.fe,
        be: p.be,
        qa: p.qa,
        total: p.totalPoints,
      })),
    };

    res.json(result);
  }
);

// 保存最终结果到数据库（Save 按钮触发）
router.post(
  "/api/session/:sessionId/save",
  async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { finalPoints, hours, feFinal, beFinal, qaFinal, resultData } = req.body;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // 标记会话完成
    session.status = "completed";

    // 先创建 results 记录
    await db.saveFinalResult(
      sessionId,
      session.storyId,
      finalPoints || 0,
      JSON.stringify(resultData || {})
    );

    // 再更新 final decision 值
    await db.updateFinalResult(sessionId, finalPoints || 0, hours || 0, feFinal || 0, beFinal || 0, qaFinal || 0);

    res.json({
      success: true,
      sessionId,
      finalPoints,
      feFinal,
      beFinal,
      qaFinal,
      hours,
    });
  }
);

// 重新打开会话（从 Results 返回 Session Active）
router.post(
  "/api/session/:sessionId/reopen",
  async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    session.status = "active";
    res.json({ success: true });
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
