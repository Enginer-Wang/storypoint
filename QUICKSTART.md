# 🚀 快速启动指南

## 1️⃣ 系统要求

- **操作系统**: Windows / macOS / Linux
- **Node.js**: v14 或更高版本
- **npm**: v6 或更高版本
- **浏览器**: 现代浏览器（Chrome、Firefox、Safari、Edge）

## 2️⃣ 安装步骤

### 步骤 1: 进入项目目录
```bash
cd Strory_Point_Calculation
```

### 步骤 2: 安装依赖
```bash
npm install
```
这将安装所有必要的 Node.js 包，可能需要几分钟。

### 步骤 3: 编译代码
```bash
npm run build
```
将 TypeScript 代码编译为 JavaScript。

### 步骤 4: 启动服务器
```bash
npm start
```

您应该看到类似的输出：
```
Connected to SQLite database
Database initialized
Server running at http://localhost:4000
PC端访问: http://localhost:4000/
```

## 3️⃣ 使用应用

### PC 端
1. 打开浏览器，访问 `http://localhost:4000`
2. 输入故事号（如：`STORY-001`）
3. 点击"开始估算"按钮
4. 二维码将被生成
5. 等待团队成员加入

### 手机端
1. 用手机浏览器或微信/钉钉扫描 PC 端显示的二维码
2. 输入你的名字
3. 选择你的角色（FE/BE/QA）
4. 点击"确认加入"
5. 选择你的估算点数（1、2、3、5、8、13、21）
6. 点击"提交估算"

### 查看结果
1. PC 端点击"完成估算"后，所有参与者的估算结果将被显示
2. 系统会自动计算每个角色的平均值
3. 编辑最终的故事点和工作时间
4. 点击"保存决策"完成

## 4️⃣ 故障排除

### 问题：端口 4000 已被占用
**解决方案**：
```bash
PORT=3001 npm start
```

### 问题：无法连接到服务器
**检查清单**：
- 确保 Node.js 已正确安装
- 确保 npm install 已完成
- 确保 npm run build 成功
- 检查防火墙设置
- 尝试手动访问 `http://localhost:4000`

### 问题：二维码无法扫描
**解决方案**：
- 确保使用了 `http://` 开头的本地地址
- 尝试增加浏览器窗口大小
- 在手机设置中开启相机权限

### 问题：数据丢失
**重置数据库**：
```bash
rm data/story_point.db
npm start
```

## 5️⃣ 开发命令

| 命令 | 说明 |
|------|------|
| `npm start` | 启动生产服务器 |
| `npm run dev` | 热重载开发模式 |
| `npm run build` | 编译 TypeScript |
| `npm test` | 运行测试 |

## 6️⃣ 功能测试清单

使用应用时，请验证以下功能：

- [ ] PC 端可以成功创建会话
- [ ] 二维码能够正确生成
- [ ] 手机端可以扫码加入
- [ ] 手机端可以选择估算点数
- [ ] PC 端实时显示参与者加入
- [ ] 点数提交后能正确统计
- [ ] 完成估算后显示结果统计
- [ ] 最终决策能够保存

## 7️⃣ 数据导出（可选）

项目的所有数据存储在 `data/story_point.db` 中。

您可以：
- 备份数据库文件进行安全保存
- 在其他服务器上恢复数据
- 使用 SQLite 工具查询数据

## 8️⃣ 常见问题

### Q: 如何修改端口号？
A: 在启动时使用环境变量：
```bash
PORT=8080 npm start
```

### Q: 如何连接到远程数据库？
A: 当前版本使用 SQLite 本地数据库。若需要远程数据库，请联系技术支持。

### Q: 支持多少并发用户？
A: WebSocket 支持 100+ 同时连接，SQLite 支持 10,000+ 记录。

### Q: 如何备份数据？
A: 直接备份 `data/story_point.db` 文件即可。

### Q: 如何清除所有数据？
A: 删除 `data/story_point.db` 文件，重启服务器将自动创建新的空数据库。

## 9️⃣ 深层链接（Direct Link）

如果知道会话 ID，可以直接访问手机端：
```
http://localhost:4000/join/[SESSION_ID]
```

例如：
```
http://localhost:4000/join/550e8400-e29b-41d4-a716-446655440000
```

## 🔟 获取帮助

如遇到问题，请：
1. 检查 [README.md](./README.md) 的详细文档
2. 查看 [DELIVERY.md](./DELIVERY.md) 的项目信息
3. 检查浏览器控制台（F12）的错误信息
4. 检查服务器终端的错误日志

## ✅ 验收清单

项目交付包含：
- ✅ 完整的源代码（TypeScript）
- ✅ PC 端 HTML/CSS/JavaScript
- ✅ 手机端响应式设计
- ✅ SQLite 数据库
- ✅ WebSocket 实时通信
- ✅ 完整的 API 文档
- ✅ 详细的用户指南
- ✅ 自动化测试脚本

## 📞 技术支持

- **项目文档**: 查看 `README.md`
- **交付说明**: 查看 `DELIVERY.md`
- **API 文档**: 查看本文件的"深层链接"部分

---

**祝您使用愉快！** 🎉
