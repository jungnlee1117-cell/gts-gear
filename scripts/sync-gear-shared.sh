#!/bin/sh
# 교구 순환 계산 로직(src)을 Edge Function(send-push)에서도 쓰도록 복사한다.
# src/itemRotation.js 등을 수정했다면 이 스크립트를 실행한 뒤 send-push 를 다시 배포하세요.
set -e
cd "$(dirname "$0")/.."
for f in itemRotation lessonPlan rentalInstitutionOptions teacherGearStatus teacherRotationRentalStatus; do
  cp "src/$f.js" "supabase/functions/_shared/gear/$f.js"
done
echo "synced"
