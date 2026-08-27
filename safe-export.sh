#!/bin/bash
# safe-export.sh — يجهز نسخة من المشروع آمنة للمشاركة (مع Claude، أو أي حد تاني)
# بيشيل تلقائيًا: .env, .env.local, .env.*.local, .git, node_modules, dist
#
# الاستخدام:
#   bash safe-export.sh vue-project-v2
#   (أو بمسار كامل: bash safe-export.sh /c/Users/.../vue-project-v2)
#
# الناتج: ملف .tar.gz في نفس مكان فولدر المشروع، اسمه <اسم-المشروع>-safe-<التاريخ>.tar.gz
# (استخدمنا tar بدل zip لأن Git Bash على ويندوز مش بييجي معاه أمر zip افتراضيًا،
#  لكن tar بييجي معاه دايمًا. أي أداة فك ضغط عادية بتفتح .tar.gz بسهولة.)

set -e

SRC="$1"
if [ -z "$SRC" ]; then
  echo "استخدام: bash safe-export.sh /path/to/project"
  exit 1
fi

if [ ! -d "$SRC" ]; then
  echo "❌ الفولدر مش موجود: $SRC"
  exit 1
fi

NAME=$(basename "$SRC")
DATE=$(date +%Y%m%d-%H%M)
OUT="${NAME}-safe-${DATE}.tar.gz"

cd "$(dirname "$SRC")"

tar --exclude="${NAME}/.env" \
    --exclude="${NAME}/.env.local" \
    --exclude="${NAME}/.env.*.local" \
    --exclude="${NAME}/.git" \
    --exclude="${NAME}/node_modules" \
    --exclude="${NAME}/dist" \
    -czf "$OUT" "$NAME"

echo "✅ تم إنشاء: $(pwd)/$OUT"
echo "تم استبعاد: .env, .env.local, .git, node_modules, dist"
