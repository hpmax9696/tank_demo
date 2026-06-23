# AI 搜寻行为设计 (2026-06-23)

## 问题

训练场坦克AI托管: 敌我一方复活后若离对方太远(>viewDist 80), 或丢失敌人, AI 卡在 PATROL 原地不动(updatePatrol 无 patrolPath 时直接 return)。

## 方案 A+B 组合

### A. 复活获知(互相追击)

- 敌方复活(`_processTrainingRespawn` 敌方分支): 额外设玩家 `ai.state='chase'` + `target=敌方` + `lastSeenPlayerPos=敌方位置`
- 玩家复活(玩家分支): 设玩家 `ai.state='chase'`(复活后立即追, 不等视野距离)

### B. PATROL 搜寻兜底(updatePatrol 无 patrolPath)

当前: 无 patrolPath 直接 return(卡死)。改为:

1. 有 `lastSeenPlayerPos`: 朝它移动(速度×0.6)
2. 到达(dist<2)仍无新目标: 朝对方复活点(trainingEnemySpawn/PlayerSpawn)
3. 无 `lastSeenPlayerPos`: 直接朝对方复活点

## 改动

- `combat/enemyAI.js` updatePatrol: 加搜寻分支(~10行)
- `js/engine.js` 敌方复活块: 设玩家 chase(~5行); 玩家复活块: 设 state=chase(~1行)

## 效果

复活远/丢失敌人都不再原地卡死: 立即对追(A) 或 移动搜寻找回(B)。
