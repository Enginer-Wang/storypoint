# 🃏 故事点估算工具 (Story Point Poker)

一个为 Sprint Grooming 设计的现代化故事点估算应用，支持多人实时协作估算。

## 功能特性

### PC端功能
- 📝 **创建估算会话** - 输入故事号并生成二维码
- 📱 **二维码加入** - 手机扫码即可加入估算
- 👥 **实时参与者显示** - 显示已加入的估算者及其角色
- 📊 **实时结果展示** - 显示每个角色的平均值和最终建议
- 🎯 **最终决策** - 最终确定故事点和预计工作时间

### 手机端功能
- 🔐 **会话加入** - 扫二维码或输入会话ID加入
- 👤 **身份信息** - 填写名字并选择角色（FE/BE/QA）
- 🎴 **扑克牌界面** - 简洁的触摸友好卡牌选择界面
- 📍 **实时点数选项** - 支持的点数：1、2、3、5、8、13、21
- ✅ **点数提交** - 提交估算并等待其他人完成

## 支持的故事点

| 点数 | 描述 |
|------|------|
| 1 | 极小 - 可能几分钟完成 |
| 2 | 小 - 约一两小时 |
| 3 | 小中等 - 约半天 |
| 5 | 中等 - 约一天 |
| 8 | 大 - 约一到两天 |
| 13 | 很大 - 约半周 |
| 21 | 非常大 - 可能需要拆分 |

## 角色说明

- **FE** (Frontend) - 前端工程师
- **BE** (Backend) - 后端工程师  
- **QA** (Quality Assurance) - 测试质量保证

## 安装与运行

### 前置要求
- Node.js >= 14
- npm >= 6

### 安装步骤

```bash
# 1. 克隆或下载项目
cd Strory_Point_Calculation

# 2. 安装依赖
npm install

# 3. 编译 TypeScript
npm run build

# 4. 启动服务器
npm start
```

服务器将在 `http://localhost:4000` 启动

### 访问应用

- **PC端**：打开浏览器访问 `http://localhost:4000`
- **手机端**：扫描PC端生成的二维码，或访问 `http://[PC_IP]:4000/join/[SESSION_ID]`

## 使用流程

### PC端
1. 输入故事号（如：STORY-001）
2. 点击"开始估算"生成二维码
3. 等待团队成员扫码加入
4. 看到所有成员加入后，点击"完成估算"
5. 查看结果统计和角色平均值
6. 编辑最终故事点和工作时间后提交

### 手机端
1. 扫描PC端的二维码
2. 填写你的名字
3. 选择你的角色（FE/BE/QA）
4. 点击"确认加入"
5. 在卡牌界面选择你的估算点数
6. 点击"提交估算"

## 项目结构

```
Strory_Point_Calculation/
├── src/
│   ├── index.ts          # 主服务器入口
│   ├── routes.ts         # API 路由定义
│   └── database.ts       # 数据库操作
├── public/
│   ├── pc.html          # PC端界面
│   ├── mobile.html      # 手机端界面
├── data/
│   └── story_point.db   # SQLite 数据库文件
├── build/               # 编译输出目录
├── package.json
├── tsconfig.json
└── README.md
```

## API 端点

### 创建会话
```bash
POST /api/session/create
Body: { "storyId": "STORY-001" }
```

### 获取会话信息
```bash
GET /api/session/:sessionId
```

### 参与者加入
```bash
POST /api/session/:sessionId/join
Body: { "name": "张三", "role": "FE" }
```

### 提交点数
```bash
POST /api/session/:sessionId/submit-points
Body: { "participantId": "...", "points": 5 }
```

### 完成估算
```bash
POST /api/session/:sessionId/finalize
```

### 保存最终决策
```bash
POST /api/session/:sessionId/update-final
Body: { "finalPoints": 8, "hours": 1.5 }
```

## 技术栈

- **后端框架**：Express.js
- **实时通信**：WebSocket
- **前端**：HTML5 + CSS3 + JavaScript
- **数据库**：SQLite3
- **二维码生成**：qrcode
- **语言**：TypeScript

## 数据库

应用使用 SQLite 作为数据库，存储以下信息：

- **sessions** - 估算会话记录
- **submissions** - 每个参与者的点数提交记录
- **results** - 估算结果和最终决定

数据库文件位于 `./data/story_point.db`

## 实时通信

应用使用 WebSocket 实现PC端和手机端的实时同步：

- 参与者加入时实时通知
- 点数提交时实时更新
- 参与者离开时实时显示

## 浏览器兼容性

- Chrome/Chromium 51+
- Firefox 55+
- Safari 10.1+
- Edge 15+
- 移动浏览器（iOS Safari, Android Chrome）

## 开发

### 热重载开发
```bash
npm run dev
```

### 构建
```bash
npm run build
```

### 启动
```bash
npm start
```

## 故障排除

### 端口已被占用
如果端口 4000 已被占用，可以设置环境变量：
```bash
PORT=3001 npm start
```

### 数据库错误
删除 `./data/story_point.db` 文件，应用会自动重建：
```bash
rm data/story_point.db
npm start
```

### 二维码无法扫描
确保PC端和手机端在同一网络，使用IP地址而非localhost

## 性能优化

- 使用内存缓存存储活动会话
- 实时数据通过WebSocket推送，减少轮询
- 静态文件由Express直接提供
- 数据库查询优化

## 安全建议

- 在生产环境中启用HTTPS
- 添加会话认证机制
- 限制API请求速率
- 定期备份数据库

## 许可证

MIT License

## 支持

如有问题或建议，请提交反馈。

---

**当前版本**：1.0.0  
**最后更新**：2026年4月2日
