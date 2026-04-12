# VR 大庚剑阵 · 青竹蜂云剑

> 中华传统修仙 × WebXR VR体验。挥手御剑，结印变阵。
>
> **道·架构**: 万设备自适应 · 无为而入 · 完全动态软编码

## 一句话

任何设备打开 → 自动感知能力 → 自动进入最佳模式 → 四种阵型随手势/触控/手柄/陀螺仪切换。

## 访问

| 入口 | URL |
|------|-----|
| **公网HTTPS (Cloudflare Tunnel)** | 运行 `node _start_tunnel.js` 获取临时公网URL |
| **阿里云HTTPS** | https://aiotvr.xyz/quest/jianzhen.html |
| **本地开发** | http://localhost:8870 |
| **Quest 3 ADB** | `adb reverse tcp:8870 tcp:8870` → http://localhost:8870 |
| **Quest 3 WiFi公网** | 戴上头显 → Oculus Browser → 粘贴Cloudflare Tunnel URL |

## 核心功能

### 四种剑阵

| 手势 | 阵型 | 效果 |
|------|------|------|
| 🌸 张掌 (Open Palm) | **莲花现世** | 斐波那契黄金角螺旋，剑身向外发散 |
| 🐉 剑指 (Sword Finger) | **游龙随行** | 飞剑追随手指轨迹，龙形蜿蜒 |
| 🛡️ 握拳 (Fist) | **剑盾护体** | 球形轨道环绕，万剑护体 |
| 🤘 结印 (Rock) | **大庚剑阵** | 天降剑雨 + 金色法阵 + 辟邪神雷 |

### 道·感知 — 万设备自适应

| 层 | 能力 |
|---|------|
| **VR头显** | Quest 2/3/Pro, Pico 4, Vision Pro, Vive, Index, WMR — WebXR全适配 |
| **手机/平板** | 触控拖拽瞄准 + 陀螺仪倾斜瞄准 + 滑动施法 |
| **桌面** | 鼠标+键盘 WASD移动, OrbitControls |
| **手柄** | PS5/Xbox/Switch Pro — 摇杆+按钮全映射 |
| **GPU适应** | WebGL自动检测GPU型号 → 三档品质(Low/Mid/High) |
| **自动进入** | HMD设备自动VR, 其他设备自动平面模式, 零配置 |

### VR特性
- **WebXR Hand Tracking** — 所有支持手追踪的VR头显
- **WebXR Controllers** — 所有VR手柄，Trigger切换阵型，摇杆移动
- **空间HUD** — VR内悬浮信息面板
- **传送系统** — 左手柄摇杆+扳机传送
- **手部光效** — 活跃手发光指示

### 触控/手柄操控 (平面模式)
- **触控**: 拖拽=瞄准, 双击=切阵, 右划🔥 上划⚡ 下划❄️ 左划⚔️
- **陀螺仪**: 倾斜手机自动瞄准(可与触控叠加)
- **手柄**: 左摇杆移动, 右摇杆瞄准, A/X/LB/RB=施法, Y=飞行, B=切阵
- **键鼠**: WASD移动, 鼠标瞄准, 1234施法, F飞行, M打坐, Q切阵

## 技术栈

| 层 | 技术 |
|---|------|
| 渲染 | Three.js 0.178.0 (InstancedMesh × 动态剑数) |
| VR | WebXR Device API + Hand Tracking + Controllers (全头显) |
| 手势 | XRHand 25关节 → 指伸展检测 → 5手势分类 |
| 输入 | 道·输入: Touch/Gyro/Gamepad/Mouse/Keys → 统一Intent |
| 感知 | 道·感知: UA+WebGL+Capabilities → GPU三档 + 设备类型 |
| 适应 | 道·适应: 实时FPS监测 → 自动调节剑数/品质 |
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

# Quest 3 ADB端口转发 (多设备时加 -s <serial>)
adb reverse tcp:8870 tcp:8870

# 推送到Quest 3浏览器
adb shell am start -a android.intent.action.VIEW \
  -d "http://localhost:8870" com.oculus.browser

# 部署到阿里云
scp index.html aliyun:/var/www/quest/jianzhen.html
```

## 性能

| 指标 | 值 |
|------|---|
| 剑数量 | GPU自动: 350(High) / 200(Mid) / 100(Low)，FPS<30自动降 |
| 自适应 | FPS<30自动减剑，FPS>50自动恢复 |
| 帧率 | 180 FPS (桌面) |
| 文件大小 | ~109KB (单HTML，CDN加载Three.js) |
| 首屏 | <2s (CDN缓存后) |

## 端口: 8870
