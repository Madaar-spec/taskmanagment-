# مدار — نظام إدارة المهام

وحدة إدارة المهام في بوابة مدار، مبنية وفق [`docs/BRD.md`](docs/BRD.md).
Next.js 15 · TypeScript strict · PostgreSQL 16 / Prisma · Tailwind · TanStack Query · Radix UI · dnd-kit · Zod.

## التشغيل

```bash
cp .env.example .env            # عدّل SESSION_SECRET
docker compose up -d db
npm ci
npm run db:migrate && npm run db:seed
npm run dev                     # http://localhost:3000
```
أو التطبيق كاملاً: `docker compose up --build`.

**الحسابات التجريبية** (كلمة المرور `Madaar@2026`): `admin@` · `manager@` · `viewer@` · `sara@` · `mohammed@` · `noura@` · `khalid@` · `lama@` · `reem@` · `fahad@` — جميعها `@madaar.test`.
لتثبيت تاريخ اليوم على بيانات Seed اضبط `APP_FIXED_TODAY=2026-10-15`.

## الاختبارات

| الأمر | النطاق | النتيجة الحالية |
|---|---|---|
| `npm test` | Vitest — قواعد الأعمال + الخدمات + مسارات API | 121 ناجحة، تغطية الخدمات 98% (NFR-07) |
| `npm run test:e2e` | Playwright — AC-01..AC-15 + فحص axe (WCAG 2.1 AA) | 26 ناجحة |

## مصفوفة التتبّع (مختصرة)

| المتطلب | التنفيذ | الاختبار |
|---|---|---|
| FR-01..03 | `services/auth.ts`، `middleware.ts`، `IdleWatcher` | `api.test.ts` (المصادقة)، `auth-admin.spec.ts` |
| FR-04..07، FR-13 | `services/tasks.ts`، `subtasks.ts`، `attachments.ts`، `TaskFormDialog` | `tasks.service.test.ts`، AC-02، AC-03 |
| FR-08..12، FR-14 | `transitionTask`، `TaskDetailsPanel`، `ReasonDialog` | AC-05..AC-10 |
| FR-15..24 | `listTasks`، `getStats`، `TaskTable`، `TaskBoard`، `FilterBar`، `useTaskParams` | AC-04، AC-11..AC-14، FR-24 |
| FR-25..28 | `getStats`، `KpiCards`، `Header`، `notifications.ts` | AC-01، AC-04، AC-08 |
| FR-29..30 | `Toast`، أخطاء الحقول من Zod | AC-02، AC-03، AC-09 |
| FR-31..32 | `services/users.ts`، `/admin/*` | `api.test.ts`، `auth-admin.spec.ts` |
| BR-01..BR-18 | `permissions.ts`، `taskRules.ts`، الخدمات، قيود قاعدة البيانات | كل قاعدة لها اختبار باسمها في `tests/` |

## ملاحظات وانحرافات عن الوثيقة
- **المصادقة:** جلسة JWT موقّعة (jose) في ملف تعريف HttpOnly/SameSite=Lax بدلاً من Auth.js، خلف واجهة `AuthProvider` قابلة لإضافة SSO (Azure AD / نفاذ) — لتطابق مسارات `/api/v1/auth/*` المحددة في القسم 7.
- **جدول تقني ثامن** `login_attempts` لتحديد محاولات الدخول (NFR-02) بشكل يعمل مع عدة نسخ.
- **الشعار:** ضع `public/madaar-logo-light.png` المعتمد؛ يُعرض اسم «مدار» نصاً حتى يُضاف.
- **بيانات Seed:** التصور التفاعلي لم يكن متاحاً، فصُمّمت المهام T-1041..T-1050 لتغطي معايير القبول.
- **AC-03:** المهمة المنشأة للتو تُثبَّت أعلى القائمة مع إبقاء الفرز الافتراضي (المتأخرة أولاً).
- **NFR-03:** الاستضافة داخل المملكة قرار نشر — Vercel/Supabase لا يوفّران منطقة في السعودية.
