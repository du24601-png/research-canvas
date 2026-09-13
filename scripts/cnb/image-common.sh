#!/bin/sh
# scripts/cnb/image-common.sh — CNB 手动通道共用逻辑（标签归一化 / 登录 / 同步 / 校验）
#
# 被 .cnb.yml 的两条手动流水线（web_trigger_sync_image / web_trigger_build_image）
# source 使用。alpine:3.20 与 docker:27 的默认 shell 均为 busybox ash，
# 因此本文件刻意不用 bash 专属语法（无 bash 数组、无 [[ ]]，正则统一走 grep -Eq）；
# bash 亦可直接 source。标签解析规则与 GitHub workflow
# (.github/workflows/publish-selfhost-image.yml 的 steps.meta) 保持完全一致。
#
# 安全约定：本文件不持有任何密钥。CNB_TOKEN 由 CNB 流水线内置注入，
# 仅经环境变量引用，禁止明文写入任何文件。
#
# 制品路径（写死，来源：CNB 仓库 Travisun/Opptrix → 制品路径强制全小写）：
CNB_IMAGE=docker.cnb.cool/travisun/opptrix
GHCR_IMAGE=ghcr.io/travisun/opptrix  # GitHub 权威制品源（owner 小写，同 workflow OWNER_LC）

# 与 workflow steps.meta 相同的 semver 校验式
OPPTRIX_SEMVER_RE='^[0-9]+\.[0-9]+\.[0-9]+([-+].*)?$'

# normalize_image_tag <raw>
# 将输入标签解析为 FULL_TAG / VERSION / IMAGE_TAGS（全局变量，供调用方使用）。
# 规则与 workflow steps.meta 完全一致：
#   opptrix-selfhost-vX.Y.Z → FULL_TAG=opptrix-selfhost-vX.Y.Z  VERSION=X.Y.Z
#   X.Y.Z                   → 同上（先剥 refs/tags/ 前缀，再做纯 semver 校验）
# 额外入口（GitHub workflow 不接受）：selfhost —— 浮动标签直通，仅处理 selfhost 一个标签。
# 常规输入 IMAGE_TAGS 为三 tag（FULL_TAG、VERSION、selfhost，空格分隔；
# busybox sh 无 bash 数组，故用空格串，按 "$IMAGE_TAGS" 不加引号迭代）。
# 非法输入报错并返回 1（配合 set -e 直接终止流水线）。
normalize_image_tag() {
  _RAW="${1:-}"
  _RAW="${_RAW#refs/tags/}"
  if [ "${_RAW}" = "selfhost" ]; then
    FULL_TAG=""
    VERSION=""
    IMAGE_TAGS="selfhost"
    echo "[cnb] 浮动标签 selfhost：仅同步/构建 selfhost（如需锁定版本请输入 X.Y.Z）"
    return 0
  fi
  if [ "${_RAW#opptrix-selfhost-v}" != "${_RAW}" ]; then
    FULL_TAG="${_RAW}"
    VERSION="${_RAW#opptrix-selfhost-v}"
  elif printf '%s\n' "${_RAW}" | grep -Eq "${OPPTRIX_SEMVER_RE}"; then
    VERSION="${_RAW}"
    FULL_TAG="opptrix-selfhost-v${VERSION}"
  else
    echo "[cnb] 非法标签 '${_RAW}'：应为 opptrix-selfhost-vX.Y.Z、X.Y.Z 或 selfhost" >&2
    return 1
  fi
  if ! printf '%s\n' "${VERSION}" | grep -Eq "${OPPTRIX_SEMVER_RE}"; then
    echo "[cnb] 非法 semver '${VERSION}'（来自 '${FULL_TAG}'）" >&2
    return 1
  fi
  IMAGE_TAGS="${FULL_TAG} ${VERSION} selfhost"
  echo "[cnb] 标签解析完成：FULL_TAG=${FULL_TAG} VERSION=${VERSION} TAGS=${IMAGE_TAGS}"
}

# cnb_login
# 登录本仓制品库 docker.cnb.cool。CNB_TOKEN 为 CNB 流水线内置注入的访问令牌；
# 经 stdin 传入 skopeo login，避免出现在进程列表或日志中。
cnb_login() {
  if [ -z "${CNB_TOKEN:-}" ]; then
    echo "[cnb] 缺少 CNB_TOKEN（应由 CNB 流水线内置注入，请勿手工写入文件）" >&2
    return 1
  fi
  printf '%s\n' "${CNB_TOKEN}" | skopeo login docker.cnb.cool -u cnb --password-stdin
}

# sync_tag <tag>
# 把 GHCR 上已发布的镜像（含多架构 manifest，digest 不变）复制到本仓制品库。
# 源 GHCR 为公开镜像，匿名拉取即可；若日后转为私有，请在本命令追加
# --src-creds "<user>:<token>"（凭据同样只能经环境变量传入）。
# --all 为传统旗标：复制整个多架构 manifest；新版 skopeo 等价写法为
# --multi-arch all，若旧版对 --all 报错可替换。
sync_tag() {
  _TAG="${1:?usage: sync_tag <tag>}"
  skopeo copy --all --retry-times 3 \
    "docker://${GHCR_IMAGE}:${_TAG}" \
    "docker://${CNB_IMAGE}:${_TAG}"
}

# verify_tag <tag>
# 校验源/目标 raw manifest（多架构时为 manifest list 原始字节）的 sha256 一致，
# 不一致返回 1（配合 set -e 终止流水线）。
verify_tag() {
  _TAG="${1:?usage: verify_tag <tag>}"
  _SRC="$(skopeo inspect --raw "docker://${GHCR_IMAGE}:${_TAG}" | sha256sum | awk '{print $1}')"
  _DST="$(skopeo inspect --raw "docker://${CNB_IMAGE}:${_TAG}" | sha256sum | awk '{print $1}')"
  if [ -z "${_SRC}" ] || [ "${_SRC}" != "${_DST}" ]; then
    echo "[cnb] digest 校验失败：${_TAG} src=${_SRC} dst=${_DST}" >&2
    return 1
  fi
  echo "[cnb] digest 校验通过：${_TAG}（${_SRC}）"
}
