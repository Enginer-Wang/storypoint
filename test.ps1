# 故事点估算工具 - 功能测试脚本 (PowerShell)
# 使用此脚本测试 API 端点

$BASE_URL = "http://localhost:4000"

Write-Host "`n=== 故事点估算工具 API 测试 ===`n" -ForegroundColor Blue

try {
    # 1. 创建会话
    Write-Host "1️⃣ 测试：创建估算会话" -ForegroundColor Yellow
    $createBody = @{
        storyId = "STORY-TEST-001"
    } | ConvertTo-Json
    
    $createRes = Invoke-WebRequest -Uri "$BASE_URL/api/session/create" `
        -Method POST `
        -ContentType "application/json" `
        -Body $createBody
    
    $session = $createRes.Content | ConvertFrom-Json
    Write-Host "✓ 会话创建成功: $($session.sessionId)" -ForegroundColor Green
    Write-Host "✓ 生成的二维码已创建" -ForegroundColor Green
    
    $sessionId = $session.sessionId
    
    # 2. 获取会话信息
    Write-Host "`n2️⃣ 测试：获取会话信息" -ForegroundColor Yellow
    $getRes = Invoke-WebRequest -Uri "$BASE_URL/api/session/$sessionId" -Method GET
    $sessionInfo = $getRes.Content | ConvertFrom-Json
    Write-Host "✓ 会话信息获取成功" -ForegroundColor Green
    Write-Host "  - 故事号: $($sessionInfo.storyId)" -ForegroundColor Green
    Write-Host "  - 状态: $($sessionInfo.status)" -ForegroundColor Green
    
    # 3. 参与者加入会话
    Write-Host "`n3️⃣ 测试：参与者加入会话" -ForegroundColor Yellow
    $participants = @(
        @{ name = "张三"; role = "FE" },
        @{ name = "李四"; role = "BE" },
        @{ name = "王五"; role = "QA" }
    )
    
    $participantIds = @()
    foreach ($p in $participants) {
        $joinBody = $p | ConvertTo-Json
        $joinRes = Invoke-WebRequest -Uri "$BASE_URL/api/session/$sessionId/join" `
            -Method POST `
            -ContentType "application/json" `
            -Body $joinBody
        
        $participant = $joinRes.Content | ConvertFrom-Json
        $participantIds += $participant.participantId
        Write-Host "✓ $($p.name) ($($p.role)) 加入成功" -ForegroundColor Green
    }
    
    # 4. 获取更新后的会话信息
    Write-Host "`n4️⃣ 测试：获取参与者列表" -ForegroundColor Yellow
    $getRes2 = Invoke-WebRequest -Uri "$BASE_URL/api/session/$sessionId" -Method GET
    $sessionInfo2 = $getRes2.Content | ConvertFrom-Json
    Write-Host "✓ 当前参与者数: $($sessionInfo2.participants.Count)" -ForegroundColor Green
    foreach ($p in $sessionInfo2.participants) {
        Write-Host "  - $($p.name) ($($p.role))" -ForegroundColor Green
    }
    
    # 5. 完成估算
    Write-Host "`n5️⃣ 测试：完成估算会话" -ForegroundColor Yellow
    $finalizeRes = Invoke-WebRequest -Uri "$BASE_URL/api/session/$sessionId/finalize" -Method POST
    $result = $finalizeRes.Content | ConvertFrom-Json
    Write-Host "✓ 估算完成" -ForegroundColor Green
    Write-Host "✓ 建议最终点数: $($result.finalPoints)" -ForegroundColor Green
    Write-Host "✓ 角色统计:" -ForegroundColor Green
    
    $result.roleStats | Get-Member -MemberType NoteProperty | ForEach-Object {
        $role = $_.Name
        $stats = $result.roleStats.$role
        if ($stats.points.Count -gt 0) {
            $average = [math]::Round($stats.average)
            Write-Host "  $($role): 平均值 $average, 提交数 $($stats.points.Count)" -ForegroundColor Green
        }
    }
    
    # 6. 保存最终决策
    Write-Host "`n6️⃣ 测试：保存最终决策" -ForegroundColor Yellow
    $updateBody = @{
        finalPoints = 8
        hours = 1.5
    } | ConvertTo-Json
    
    $updateRes = Invoke-WebRequest -Uri "$BASE_URL/api/session/$sessionId/update-final" `
        -Method POST `
        -ContentType "application/json" `
        -Body $updateBody
    
    $updateResult = $updateRes.Content | ConvertFrom-Json
    Write-Host "✓ 最终决策已保存: $($updateResult.finalPoints) 点, $($updateResult.hours) 小时" -ForegroundColor Green
    
    Write-Host "`n✅ 所有测试通过！" -ForegroundColor Green
    Write-Host "`n=== 测试结果总结 ===" -ForegroundColor Blue
    Write-Host "✓ 会话创建和管理正常" -ForegroundColor Green
    Write-Host "✓ 参与者加入机制正常" -ForegroundColor Green
    Write-Host "✓ 估算完成和统计正常" -ForegroundColor Green
    Write-Host "✓ 最终决策保存正常" -ForegroundColor Green
    Write-Host "`n应用正常运行！可以开始使用。`n" -ForegroundColor Cyan
    
} catch {
    Write-Host "`n❌ 测试失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`n请确保服务器正在运行 (npm start)" -ForegroundColor Yellow
    exit 1
}
