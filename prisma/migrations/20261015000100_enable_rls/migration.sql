-- NFR-02/NFR-03: منع الوصول المباشر عبر واجهات قاعدة البيانات العامة (مثل Supabase Data API).
-- التطبيق يتصل بدور مالك الجداول فيتجاوز RLS، ولا توجد سياسات تسمح لأي دور آخر.
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subtasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "login_attempts" ENABLE ROW LEVEL SECURITY;
