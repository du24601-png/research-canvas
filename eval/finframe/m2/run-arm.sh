#!/usr/bin/env bash
# M2 单因素实验的一组测量：seed ×2 + planning ×2 + prompt ×2，顺序执行（不并发，避免互相影响耗时与限频）。
# 用法：bash eval/finframe/m2/run-arm.sh <label> <logdir>
set -u
LABEL="$1"
LOGDIR="$2"
mkdir -p "$LOGDIR"
cd "$(dirname "$0")/../../.."
npm run build -w @opptrix/shared -w @opptrix/agent -w @opptrix/agent-skills > "$LOGDIR/$LABEL-build.log" 2>&1 || { echo "BUILD_FAILED $LABEL"; exit 1; }
for i in 1 2; do
  node eval/finframe/run.mjs > "$LOGDIR/$LABEL-seed-$i.log" 2>&1
  node eval/agent/planning/run.mjs > "$LOGDIR/$LABEL-planning-$i.log" 2>&1
  node eval/agent/prompt/run.mjs > "$LOGDIR/$LABEL-prompt-$i.log" 2>&1
done
echo "ARM_DONE $LABEL"
