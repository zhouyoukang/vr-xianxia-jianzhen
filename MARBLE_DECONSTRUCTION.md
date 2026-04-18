# Marble WorldLabs 全面解构报告

> 道可道，非常道 — 反者道之动，弱者道之用
> 逆向工程不在于复制，而在于理解其道

---

## 1. 平台概览

**Marble** (`marble.worldlabs.ai`) 是 WorldLabs 推出的 AI 3D 世界生成平台。
用户输入文本 prompt → AI 生成 3D Gaussian Splatting 场景 → 可在浏览器中实时渲染、分享。

| 层级 | 技术栈 |
|------|--------|
| 前端框架 | React (SPA) + Vite 构建 |
| 3D 渲染 | Three.js + 自研 Splat Mesh 渲染器 |
| 数据格式 | `.spz` (Compressed Splat) + `.ply` (fallback) |
| WASM 加速 | Rust→WASM 模块: 排序、解压、LOD 处理 |
| API | `api.worldlabs.ai` (REST, 需认证) |
| CDN | `cdn.marble.worldlabs.ai` (CloudFront/S3) |
| 状态管理 | React Query (TanStack Query) |

---

## 2. 核心架构解构

### 2.1 渲染管线 (Rendering Pipeline)

```
[用户请求] → [API 获取 World 数据]
                    ↓
         [SPZ URL 解析 (low/medium/high)]
                    ↓
         [Fetch + WASM 解压 CsplatArray]
                    ↓
         [CsplatArray → PackedSplats / ExtSplats]
                    ↓
         [GPU 排序 (sort_splats / sort32_splats)]
                    ↓
         [BufferGeometry 更新 → Three.js 渲染]
```

### 2.2 关键 JS 模块

#### `splat-files-*.js` — SPZ 文件管理
- **SplatCache**: LRU 缓存，基于文件大小的淘汰策略
- **fetchAndParseSplatFile**: 获取 + WASM 解析 SPZ
- **getUrls(world)**: 从 world 对象提取多分辨率 URL
  ```js
  getUrls(world) → {
    lowRes:    world.spz?.low    || null,
    mediumRes: world.spz?.medium || null,
    highRes:   world.spz?.high   || null,
    plyUrl:    world.ply         || null
  }
  ```

#### `splat-mesh-*.js` — 渲染核心
- 继承 Three.js `BufferGeometry`
- **WASM 模块** (`Te`): 编译为 WebAssembly 的排序/解压内核
- **CsplatArray 类**: WASM 侧的核心数据结构
  ```
  CsplatArray.inject_rgba8(rgba)     → 注入颜色数据
  CsplatArray.to_extsplats()         → 转为扩展 splat 格式
  CsplatArray.to_packedsplats()      → 转为压缩 splat 格式
  CsplatArray.to_extsplats_lod()     → 带 LOD 的扩展格式
  CsplatArray.to_packedsplats_lod()  → 带 LOD 的压缩格式
  CsplatArray.len()                  → splat 数量
  CsplatArray.has_lod()              → 是否有 LOD 数据
  CsplatArray.tiny_lod(base, merge)  → 简化 LOD 生成
  CsplatArray.bhatt_lod(base)        → Bhattacharyya LOD
  ```
- **sort_splats / sort32_splats**: 视角排序，每帧调用

#### `worlds-*.js` — API 交互
- **查询函数**:
  - `fetchUserWorlds()` — 用户创建的世界
  - `fetchWorld(id)` — 单个世界 (含状态轮询)
  - `fetchLikedWorlds()` — 收藏的世界
  - `fetchExploreWorlds(tags, search)` — 探索页 (支持标签/搜索)
- **状态机**: `pending → initializing → running → completed`
- **错误处理**: 403 (WorldForbiddenError), 404, 重试逻辑

#### `download-*.js` — 下载 + 着色器
- 带进度回调的 fetch 包装
- 包含 GLSL 着色器片段 (splatDefines, logdepthbuf 等)
- 支持取消信号 (AbortController)

#### `use-world-data-transformation-*.js` — UI 数据转换
- 世界状态标签映射
- 剪贴板操作 (分享 URL)
- VR 模式 URL 生成
- 图片 prompt 处理

---

## 3. 数据结构解构

### 3.1 World 对象

```json
{
  "id": "uuid-v4",
  "name": "场景名称",
  "tags": ["curated", "fantasy", "exterior"],
  "prompt": "详细的场景描述文本...",
  "thumbnail": "https://cdn.marble.worldlabs.ai/{id}/{hash}_image_prompt_sanitized.png",
  "spz": {
    "low":    "https://cdn.marble.worldlabs.ai/{id}/{hash}_dust_100k.spz",
    "medium": "https://cdn.marble.worldlabs.ai/{id}/{hash}_ceramic_500k.spz",
    "high":   "https://cdn.marble.worldlabs.ai/{id}/{hash}_ceramic.spz"
  },
  "collider_mesh": null,
  "panorama": null,
  "mpi": "https://cdn.marble.worldlabs.ai/{id}/{hash}_dust_mpi",
  "scale": 1.359,
  "ground_offset": 1.362,
  "owner": "username",
  "model": "Marble 0.1-plus"
}
```

### 3.2 SPZ 文件格式

| 分辨率 | 后缀 | 典型大小 | Splat 数量 |
|--------|------|---------|-----------|
| Low | `_dust_100k.spz` | ~2-5 MB | ~100K |
| Medium | `_ceramic_500k.spz` | ~10-25 MB | ~500K |
| High | `_ceramic.spz` | ~30-80 MB | ~1-3M |

**SPZ 内部结构** (WASM 解析):
- 压缩的 3D Gaussian 参数 (位置 xyz, 缩放, 旋转四元数, 球谐系数/颜色)
- 支持 LOD 层级 (tiny_lod, bhatt_lod)
- 可注入外部 RGBA8 颜色数据

### 3.3 MPI (Multi-Plane Image)

- URL 格式: `{cdn}/{world_id}/{hash}_dust_mpi`
- 多平面图像，用于视差效果的 2.5D 渲染
- 作为 3DGS 的轻量替代方案
- **当前 VR仙侠 未使用此资源**

### 3.4 CDN URL 模式

```
https://cdn.marble.worldlabs.ai/
  └── {world_id}/
      ├── {hash}_image_prompt_sanitized.png  (缩略图)
      ├── {hash}_dust_100k.spz              (低分辨率 splat)
      ├── {hash}_ceramic_500k.spz           (中分辨率 splat)
      ├── {hash}_ceramic.spz                (高分辨率 splat)
      └── {hash}_dust_mpi                   (多平面图像)
```

---

## 4. API 端点解构

> ⚠️ API 需要认证令牌，以下为逆向推断的端点结构

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/worlds` | GET | 用户的世界列表 |
| `/api/worlds/{id}` | GET | 单个世界详情 |
| `/api/worlds/liked` | GET | 收藏列表 |
| `/api/worlds/explore` | GET | 探索页 (支持 `tags`, `search`, `cursor`) |
| `/api/worlds` | POST | 创建新世界 (prompt → 生成) |

**探索页参数**:
- `tags`: 标签过滤 (fantasy, realism, interior, exterior, curated)
- `search`: 文本搜索 (prompt 匹配)
- `cursor`: 分页游标
- `limit`: 每页数量

**世界状态流转**:
```
created → pending → initializing → running → completed
                                           → failed
```

---

## 5. 渲染技术深度分析

### 5.1 3D Gaussian Splatting 核心

Marble 使用 **3D Gaussian Splatting** (3DGS) 技术:
- 每个 "splat" 是一个 3D 高斯椭球体
- 参数: 位置(3), 缩放(3), 旋转(4), 颜色/球谐(N)
- 渲染: 按深度排序 → 累积 alpha blending
- WASM 加速: 排序算法在 Rust→WASM 中实现

### 5.2 LOD (Level of Detail) 策略

```
用户远距离 → dust_100k (100K splats, 快速加载)
用户交互中 → ceramic_500k (500K splats, 平衡)
用户近距离 → ceramic (1-3M splats, 最高质量)
```

WASM 端还支持运行时 LOD:
- `tiny_lod(base, merge_filter)` — 基于距离的简化
- `bhatt_lod(base)` — 基于 Bhattacharyya 距离的智能合并

### 5.3 缓存策略 (SplatCache)

- **LRU 淘汰**: 基于文件大小
- **内存管理**: 自动释放最久未使用的 splat 数据
- **预加载**: 探索页可见的场景预加载 low-res

### 5.4 着色器管线

`download-*.js` 中内嵌的 GLSL 片段表明:
- 使用对数深度缓冲 (`logdepthbuf`) 处理大场景
- 自定义 splat 渲染着色器 (`splatDefines`)
- 支持 Three.js 标准 PBR 管线扩展

---

## 6. SparkJS 集成层

VR仙侠 使用 **SparkJS** (`@sparkjsdev/spark`) 作为 Marble 底层渲染的开源替代:

| Marble 内部 | SparkJS 对应 | 状态 |
|-------------|-------------|------|
| 自研 SplatMesh | `SplatMesh` | ✅ 直接使用 |
| 自研 SparkRenderer | `SparkRenderer` | ✅ 直接使用 |
| WASM 排序/解压 | SparkJS 内置 | ✅ 兼容 |
| VR 支持 | `VRButton`, `XrHands`, `FpsMovement` | ✅ 完整 |
| SplatCache | 未内置 | ⚠️ 需自行实现 |
| MPI 渲染 | 未内置 | ⚠️ 需自行实现 |

---

## 7. 安全与限制

### 7.1 API 认证
- 所有 API 调用需要 Bearer Token
- Token 通过 OAuth/SSO 获取 (Google, etc.)
- 无公开 API key

### 7.2 CDN 资源
- **SPZ/PNG 文件: 公开可访问** (无需认证)
- 只需知道 world_id + 文件 hash
- CORS 已开启 (`Access-Control-Allow-Origin: *`)

### 7.3 速率限制
- API 有速率限制 (具体阈值未知)
- CDN 无明显限制

---

## 8. VR仙侠 集成现状与增强路线

### 8.1 已实现 ✅
- SparkJS SplatMesh 渲染 Marble CDN 的 SPZ 文件
- 12 个精选修仙场景 (embedded data)
- 自适应画质 (low/medium/high)
- VR 支持 (WebXR + Quest 3 手柄)
- 修仙系统 (灵力、法术、境界、御剑飞行)
- 场景氛围自适应 (雾、光照、背景色)

### 8.2 已增强 ✅ (v10.3 截止)
- **SPZ 缓存** ✅ — SplatCache LRU (Mobile 3条 / Desktop 6条)
- **渐进加载** ✅ — low → medium 8 秒稳定后自动升级
- **场景预加载** ✅ — 相邻场景 CDN HEAD 预热
- **注视点渲染** ✅ — `renderer.xr.setFoveation(1.0)` on XR sessionstart (v10.0)
- **全景截图** ✅ — cubemap→equirect GLSL 管线, 2048×1024 PNG 下载 (v10.0)
- **修为持久化** ✅ — localStorage 跨会话保存境界/灵力/经验 (v10.0)
- **dt 封顶** ✅ — `Math.min(dt, 0.1)` 防帧停滞连锁清空 (v10.1)
- **可观测性钩子** ✅ — `window.scene / _threeLoaded / REALMS` 外暴露 (v10.2)

### 8.3 仍待增强 🔧 (非 VR 核心体验)
- **MPI 背景** ❌ — CDN 返回 404, 暂无公开资源
- **动态场景发现** 🔧 — 需 OAuth token, 当前用 12 精选场景硬编码
- **碰撞网格** 🔧 — `collider_mesh` 字段普遍为 null, 无法利用

### 8.4 架构原则

> 道法自然 — 架构随需求自然演进，不强求

```
             ┌─────────────────────────────┐
             │     VR仙侠 · 万界穿梭        │
             │  (xianxia_worldlabs.html)    │
             └──────────┬──────────────────┘
                        │
          ┌─────────────┼─────────────────┐
          │             │                 │
    ┌─────▼─────┐ ┌────▼────┐ ┌─────────▼────────┐
    │  SparkJS  │ │ Three.js│ │  Marble CDN       │
    │ SplatMesh │ │ WebGL   │ │  SPZ/PNG/MPI      │
    │ VRButton  │ │ WebXR   │ │  (公开资源)        │
    └───────────┘ └─────────┘ └──────────────────┘
```

---

## 9. 关键发现总结

1. **SPZ 文件可直接下载** — CDN 无需认证，是核心可利用资源
2. **WASM 是性能关键** — splat 排序/解压必须用 WASM，SparkJS 已内置
3. **LOD 是体验关键** — 100K→500K→Full 的渐进加载决定首屏速度
4. **MPI 是未利用资源** — 可作为 3DGS 加载前的高质量过渡
5. **场景元数据完整** — scale/ground_offset 对正确视角至关重要
6. **SparkJS 完全兼容** — 可替代 Marble 自研渲染层

---

*道生一，一生二，二生三，三生万物 — 从一个 SPZ 文件到一个完整的修仙世界*

---

## 10. 深度解构 — 第二轮逆向 (2026-04-13)

### 10.1 完整 JS 模块地图

从 `marble.worldlabs.ai` 提取的完整前端 bundle (release `rel-24fe854`):

| 模块 | 大小 | 功能 |
| --- | --- | --- |
| `main-ClLtFBQA.js` | 入口 | 应用入口，路由初始化 |
| `download-BxoQfa6S.js` | 4.7MB | **核心**: WASM二进制(base64内联), GLSL着色器, 下载器 |
| `_id-Cjz0FUc2.js` | 301KB | **核心**: 世界查看器组件, YUV编码器, 全景截图 |
| `module-Bve6IoF4.js` | 168KB | SparkJS模块 |
| `geometry-io-B4OJOoNa.js` | 129KB | 几何体I/O (碰撞网格加载) |
| `use-world-creation-C1G4Eb7w.js` | 78KB | 世界创建流程 |
| `world-info-content-BYXWNfYM.js` | 22KB | 世界信息展示UI |
| `use-panorama-capture-BlNn4n9L.js` | 11KB | 全景截图系统 (cubemap→equirect) |
| `use-gallery-dialog-D6DZjm6P.js` | 9KB | 画廊对话框 |
| `_explore-Dkp2VaSq.js` | 8KB | 探索页面 (场景发现) |
| `splavatar-Cls77Hg9.js` | 7KB | 用户头像splat |
| `three-Dn14h6iB.js` | 44KB | Three.js封装层 |
| `splat-files-qFIj_cl9.js` | - | SPZ文件加载/缓存 |
| `splat-mesh-MhRcAuAJ.js` | 2KB | SplatMesh渲染入口 |
| `worlds-J3yNChJf.js` | - | 世界API交互 |
| `device-detection--vjH65HP.js` | 1.4KB | 设备检测 (mobile/tablet/touch) |
| `use-large-scene-Bw81V7oZ.js` | 2.2KB | 大场景API (付费功能) |
| `platform-BFRCKZ-e.js` | 1KB | 平台工具 (Mac检测, 对话框检测) |

### 10.2 WASM 二进制分析

**关键发现**: WASM 二进制以 `data:application/wasm;base64,AGFzbQ...` 形式**内联**在 `download-BxoQfa6S.js` 中。

两个独立 WASM 模块:

#### WASM Module 1 — Splat 处理 (wasm-bindgen)

```
CsplatArray (压缩splat):
  .inject_rgba8(rgba)         — 注入RGBA颜色数据
  .to_extsplats()             — 转换为扩展splat格式
  .to_packedsplats()          — 转换为打包splat格式
  .to_extsplats_lod()         — LOD版扩展splat
  .to_packedsplats_lod()      — LOD版打包splat
  .len()                      — splat数量
  .has_lod()                  — 是否有LOD数据

GsplatArray (高斯splat):
  .to_extsplats()
  .to_packedsplats()
  .to_extsplats_lod()
  .to_packedsplats_lod(encoding)
  .len()
  .has_lod()

SplatDecoder:
  — SPZ解码器 (接收file_type, path_name参数)
```

#### WASM Module 2 — Splat 排序

```javascript
sort_splats(num_splats, readback, ordering)
// 基于相机深度的基数排序, 返回激活splat数量
// readback: Float32Array (splat深度缓冲)
// ordering: Uint32Array (排序后索引)
```

### 10.3 LOD + 注视点渲染

从 WASM 函数签名发现**注视点渲染**(foveated rendering):

```
参数:
  lod_ids        — LOD层级ID
  page_bases     — 分页基址
  chunk_bases    — 块基址
  root_pages     — 根页
  view_to_objects — 视图→物体变换
  lod_scales     — LOD缩放因子
  behind_foveates — 背面注视遮罩
  cone_foveates  — 锥形注视区域
  cone_fov0s     — 注视中心视角
  cone_fovs      — 注视扩展视角
```

这表明 Marble 使用**分层LOD + 注视点渲染**优化 — VR模式下中心区域高精度，外围低精度。

### 10.4 全景截图管线

从 `use-panorama-capture-BlNn4n9L.js` 提取的完整管线:

```
1. 获取相机世界四元数
2. 转换为旋转矩阵 (makeRotationFromQuaternion)
3. 渲染cubemap (6面环境贴图)
4. cubemap → equirectangular投影 (GLSL着色器)
5. GPU readback (readRenderTargetPixels)
6. Canvas 2D翻转 + 导出PNG
```

关键 GLSL — cubemap 到等距圆柱投影:

```glsl
uniform samplerCube envMap;
uniform mat3 rotationMatrix;
varying vec2 vUv;

void main() {
  float theta = vUv.x * PI2 - PI;
  float phi = (1.0 - vUv.y) * PI;
  vec3 direction = normalize(rotationMatrix * vec3(
    sin(theta) * sin(phi),
    cos(phi),
    -cos(theta) * sin(phi)
  ));
  gl_FragColor = textureCube(envMap, direction);
}
```

### 10.5 新发现 API 端点

| 端点 | 方法 | 功能 | 认证 |
| --- | --- | --- | --- |
| `/api/v1/large-scene-requests` | GET | 获取大场景请求列表 | 需要 |
| `/api/v1/large-scene-requests` | POST | 创建大场景请求 | 需要 |
| `/api/v1/large-scene-requests:checkAvailability` | POST | 检查大场景可用性 | 需要 |
| `/api/v1/large-scene-requests/{id}:cancel` | POST | 取消大场景请求 | 需要 |
| `/api/v1/vid` | - | 视频相关 | 需要 |
| `/api/v1/operations/{id}` | - | 操作状态查询 | 需要 |

### 10.6 CDN 资源验证结果 (2026-04-13)

```
资源类型     | 状态 | CORS    | 大小范围
SPZ low      | ✅ 200 | Access-Control-Allow-Origin: * | 1.3-1.5MB
SPZ medium   | ✅ 200 | Access-Control-Allow-Origin: * | 7.4-7.8MB
SPZ high     | ✅ 200 | Access-Control-Allow-Origin: * | 29-31MB
Thumbnail    | ✅ 200 | Access-Control-Allow-Origin: * | ~100KB
MPI          | ❌ 404 | — | 不可访问
```

**结论**: MPI 资源不在公开 CDN 上。SPZ 三级分辨率 + 缩略图完全公开可用。

### 10.7 设备检测逻辑 (逆向自 device-detection.js)

```javascript
// 移动端检测
const isMobile = /android|webos|iphone|ipad|tablet/i.test(ua);

// 桌面端排除
const isDesktop = /cros|ubuntu|debian|fedora|opensuse|arch|mint|manjaro|windows|macos|mac os x/i.test(ua);

// 平板检测
const isTablet = /ipad/i.test(ua) || /tablet/i.test(ua);

// 触摸设备综合判断
const isTouchDevice = ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  && (isMobile || isTablet);

// 粗精度指针检测
const hasCoarsePointer = matchMedia('(pointer: coarse)').matches;
```

---

## 11. 已完成集成状态

### VR仙侠 增强清单

| 特性 | 状态 | 说明 |
| --- | --- | --- |
| SplatCache LRU缓存 | ✅ | Mobile 3条 / Desktop 6条，自动淘汰 |
| 渐进SPZ加载 (low→medium) | ✅ | 8秒稳定后自动升级 |
| 相邻场景CDN预热 | ✅ | HEAD请求预热，不下载全量 |
| 12场景嵌入数据 | ✅ | 全部CDN验证通过 (10/12 low有效) |
| 中文场景名 + 氛围系统 | ✅ | 12场景全覆盖 |
| HUD缓存状态显示 | ✅ | `缓N` 实时显示 |
| MPI资源 | ❌ | CDN返回404，暂不可用 |
| WASM排序管线 | ✅ | SparkJS 内置, `renderer.xr.setFoveation()` 桥接 |
| 注视点渲染 (道·注视点) | ✅ | v10.0 `setFoveation(1.0)` on XR sessionstart (两文件) |
| 全景截图 (道·传影) | ✅ | v10.0 cubemap→equirect GLSL 移植, `P` 键触发 (xianxia) |
| 修为持久化 (道·传承) | ✅ | v10.0 localStorage `daojing_cult_v1`, 自动保存+恢复 |
| dt 封顶 (道·时度) | ✅ | v10.1 `Math.min(dt, 0.1)` 防帧停滞清空 CD/qi/粒子 |
| 可观测性钩子 (道·观照) | ✅ | v10.2 `window.scene / _threeLoaded / cult / REALMS` |

### 提取的模块文件

```
_marble_modules/
├── device-detection.js      — 设备检测
├── download.js              — WASM + 着色器 (4.7MB)
├── explore-page.js          — 探索页面
├── gallery-dialog.js        — 画廊对话框
├── geometry-io.js           — 几何体I/O
├── panorama-capture.js      — 全景截图
├── platform.js              — 平台工具
├── queryOptions.js          — 查询选项
├── spark-module.js          — SparkJS核心 (168KB)
├── splat-mesh.js            — SplatMesh入口
├── three-wrapper.js         — Three.js封装
├── use-large-scene.js       — 大场景API
├── use-world-creation.js    — 世界创建
├── world-detail-page.js     — 世界详情路由
├── world-info.js            — 世界信息UI
└── world-viewer.js          — 世界查看器 (301KB, 金矿)
```
