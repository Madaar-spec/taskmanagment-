// FR-01: طبقة مصادقة قابلة للاستبدال. موفّر Credentials الآن، ويُضاف موفّر SSO
// (Azure AD / نفاذ عبر OIDC) لاحقاً بتنفيذ الواجهة نفسها دون تغيير بقية النظام.
import bcrypt from 'bcryptjs';
import { prisma } from '../db';

export interface AuthenticatedIdentity {
  userId: string;
}

export interface AuthProvider {
  readonly id: string;
  authenticate(input: { email: string; password: string }): Promise<AuthenticatedIdentity | null>;
}

// تجزئة وهمية لمساواة زمن الاستجابة عند عدم وجود المستخدم
const DUMMY_HASH = '$2b$12$F7B.SjhrXdHNfCHmWkvqheUPVu1Hmc8hiNtbXV7aDZ4an3I/4aDaa';

export const credentialsProvider: AuthProvider = {
  id: 'credentials',
  async authenticate({ email, password }) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.passwordHash || !ok || !user.isActive) return null;
    return { userId: user.id };
  },
};

export const authProvider: AuthProvider = credentialsProvider;

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
