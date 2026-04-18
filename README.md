# VR 大庚剑阵 · 青竹蜂云剑

> 中华传统修仙 × WebXR VR体验。挥手御剑，结印变阵。

## 一句话

Quest 3 浏览器打开 → 进入VR → 伸手控剑 → 四种阵型随手势切换。

## 访问

| 入口 | URL |
|------|-----|
| **公网HTTPS (GitHub Pages)** | https://zhouyoukang.github.io/vr-xianxia-jianzhen/ |
| **公网HTTPS (阿里云, 旧)** | https://aiotvr.xyz/quest/jianzhen.html ※ 2026-04 当前 SSH/443 暂不可达, 以 GH Pages 为准 |
| **本地开发** | http://localhost:8870 |
| **Quest 3 ADB** | `adb reverse tcp:8870 tcp:8870` → http://localhost:8870 |

三页面完整公网路径 (GitHub Pages · v10.1):
- `jianzhen` (大庚剑阵): https://zhouyoukang.github.io/vr-xianxia-jianzhen/index.html
- `xianxia` (修仙WorldLabs): https://zhouyoukang.github.io/vr-xianxia-jianzhen/xianxia_worldlabs.html
- `diag` (Quest 3 诊断): https://zhouyoukang.github.io/vr-xianxia-jianzhen/_q3_diag.html
- `beacon` (Quest 3 信标): https://zhouyoukang.github.io/vr-xianxia-jianzhen/_q3_beacon.html

## 核心功能

### 四种剑阵

| 手势 | 阵型 | 效果 |
|------|------|------|
| 🌸 张掌 (Open Palm) | **莲花现世** | 斐波那契黄金角螺旋，剑身向外发散 |
| 🐉 剑指 (Sword Finger) | **游龙随行** | 飞剑追随手指轨迹，龙形蜿蜒 |
| 🛡️ 握拳 (Fist) | **剑盾护体** | 球形轨道环绕，万剑护体 |
| 🤘 结印 (Rock) | **大庚剑阵** | 天降剑雨 + 金色法阵 + 辟邪神雷 |

### VR特性
- **WebXR Hand Tracking** — Quest 3 原生手势识别
- **WebXR Controllers** — 手柄Trigger切换阵型，摇杆移动剑阵
- **空间HUD** — VR内悬浮模式提示
- **地面法阵** — 双环旋转参考地面
- **手部光效** — 活跃手发光指示

### 平面模式
- 鼠标/触控移动剑阵目标
- 点击切换阵型
- OrbitControls 自由视角

### 道·推进到极

| 特性 | 实现 | 快捷键 |
|------|------|--------|
| **道·注视点** | Quest 3 固定注视点渲染 (`setFoveation(1.0)`)，中心高分辨率，边缘降采样 | 自动 (进入VR时) |
| **道·传承** | 修为跨会话持久化 (localStorage)，境界/灵力/经验自动保存 | 突破时自动保存 |
| **道·归零** | 重置修为，一键回炼气一层 | `Shift+R` |
| **道·传影** | 360° 全景截图，立方体贴图→等距投影 → PNG 下载 (2048×1024) | `P` 或 HUD `📷 传影` (仅 `xianxia_worldlabs.html`) |

控制台 API (两文件通用)：

```js
window._saveCult();      // 立即保存
window._loadCult();      // 手动重载
window._resetCult();     // 重置为炼气一层
window._capturePanorama(size);  // 仅 xianxia_worldlabs.html; size 默认 2048
```

## 技术栈

| 层 | 技术 |
|---|------|
| 渲染 | Three.js 0.178.0 (InstancedMesh × 350剑) |
| VR | WebXR Device API + Hand Tracking + Controllers |
| 手势 | XRHand 25关节 → 指伸展检测 → 5手势分类 |
| 特效 | 辟邪神雷(LineSegments) + 金色法阵(Shader) + 灵气粒子 |
| 部署 | 阿里云 Nginx + Let's Encrypt SSL |
| 来源 | [jianzhen.upma.site](https://jianzhen.upma.site/) 源码重构 |

## 原始项目

来源: https://jianzhen.upma.site/ ("大庚剑阵")
- **原技术栈**: React 19 + @react-three/fiber + MediaPipe HandLandmarker (摄像头手势)
- **VR重构**: 替换MediaPipe为WebXR Hand API，添加VR立体渲染，适配Quest 3

## 文件结构

```
VR仙侠/
  index.html                ← ★大庚剑阵VR应用 (~109KB, CDN加载Three.js)
  xianxia_worldlabs.html    ← ★修仙界 WorldLabs 3DGS (12场景内嵌, standalone)
  worldlabs_hub.py          ← WorldLabs API代理+场景发现 (开发用)
  _e2e_full.py              ← Playwright全量E2E测试 (663行)
  _curated_scenes.json      ← 精选仙侠场景数据
  README.md / _AGENT_GUIDE.md
```

## 开发

```bash
# 本地服务器
python -m http.server 8870 --directory "VR仙侠"

# Quest 3 ADB端口转发
adb -s 2G0YC5ZG8L08Z7 reverse tcp:8870 tcp:8870

# 推送到Quest 3浏览器
adb -s 2G0YC5ZG8L08Z7 shell am start -a android.intent.action.VIEW \
  -d "http://localhost:8870" com.oculus.browser

# 公网部署 (GitHub Pages, v10.1 已就绪)
# 推到 main 即自动重建, 通常 1-2 分钟生效
git push origin main
# 阿里云部署 (备用, 当前 SSH 不通)
# scp index.html aliyun:/var/www/quest/jianzhen.html
```

## 一键真机 (Quest 3)

```bash
# ① USB 连接 Quest 3, 开启开发者模式, 确认 adb devices 有设备
# ② 让 Quest 3 浏览器直接访问公网 GitHub Pages (无需 ADB reverse)
adb shell am start -a android.intent.action.VIEW \
  -d "https://zhouyoukang.github.io/vr-xianxia-jianzhen/" com.oculus.browser

# ③ 戴上头显, 点击页面 "VR模式" 进入, 享受 F1 注视点/F2 传承/F3 传影
```

## 性能

| 指标 | 值 |
|------|---|
| 剑数量 | 350 (桌面) / 150 (Quest 3)，自适应降至100 |
| 自适应 | FPS<30自动减剑，FPS>50自动恢复 |
| 帧率 | 180 FPS (桌面) |
| 文件大小 | ~109KB (单HTML，CDN加载Three.js) |
| 首屏 | <2s (CDN缓存后) |

## 端口: 8870
