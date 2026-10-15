// قاعدة بيانات الاختبار وتاريخ مثبّت 2026-10-15 (القسم 9)
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/madaar_test?schema=public';
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.APP_FIXED_TODAY = '2026-10-15';
process.env.SESSION_SECRET ??= 'test-secret-test-secret-test-secret-0123456789';
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_LOCAL_DIR = './storage-test';
