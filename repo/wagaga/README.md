# wagaga

这个目录是一个独立的静态网页小项目，核心效果是：

- 使用 SVG `clipPath` 将图片裁剪成不规则 blob 形状
- 沿着同一条 blob 路径做循环滚动文字（`textPath + animate`）
- 鼠标悬停时放大 blob，并切换文字颜色

## 目录结构

```text
wagaga/
├─ index.html
└─ assets/
   ├─ css/
   │  └─ style.css
   └─ images/
      └─ pic.jpg
```

## 文件说明

- `index.html`：页面主体，包含 SVG、图片裁剪路径、文字路径和动画定义。
- `assets/css/style.css`：页面样式，负责居中布局、背景渐变、hover 过渡和文字样式。
- `assets/images/pic.jpg`：被裁剪展示的图片素材。

## 本地预览

可直接用浏览器打开 `index.html`。

如果你希望通过本地服务访问（更接近线上环境），可在该目录运行：

```bash
python3 -m http.server 8000
```

然后访问：`http://localhost:8000`

## 备注

- 项目不依赖构建工具或框架。
- 页面从 Google Fonts 引入了 `Montserrat` 字体（当前样式主要使用系统字体栈显示动画文字）。
