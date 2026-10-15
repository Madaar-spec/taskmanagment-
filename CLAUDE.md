# مدار — إدارة المهام

المرجع: `docs/BRD.md`. اذكر معرّفات FR/BR/AC في التعليقات وأسماء الاختبارات.

## الأوامر
- تشغيل قاعدة البيانات: `docker compose up -d db`
- إعداد: `cp .env.example .env && npm ci && npm run db:migrate && npm run db:seed`
- تطوير: `npm run dev` (http://localhost:3000)
- فحوص سريعة: `npm run lint && npm run typecheck`
- اختبارات الوحدة والتكامل (قاعدة `madaar_test`): `npm test` / `npm run test:coverage`
- اختبارات القبول Playwright (قاعدة `madaar_e2e`): `npm run test:e2e`

## البنية
- `src/lib/taskRules.ts` قواعد الأعمال النقية (BR-04..BR-17) — مشتركة مع الواجهة
- `src/lib/schemas.ts` مخططات Zod المشتركة
- `src/server/permissions.ts` دالة النطاق `scopeTasks(user)` (BR-01) — تُستخدم في كل استعلام
- `src/server/services/*` الطبقة الخدمية (المرجع الملزم لكل القواعد)
- `src/app/api/v1/*` مسارات REST — `src/middleware.ts` الجلسة المنزلقة 30 دقيقة وCSRF
- `messages/ar.json` كل النصوص العربية (NFR-08)
