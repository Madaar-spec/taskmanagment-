// أنواع استجابات API للواجهة (استيراد أنواع فقط من الخادم)
import type { TaskDetail, TaskListItem } from '@/server/services/tasks';
import type { SessionUser } from '@/server/auth/currentUser';
import type { Status } from './taskRules';

export type { TaskDetail, TaskListItem, SessionUser };

export interface TaskList {
  items: TaskListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TaskStats {
  kpi: {
    total: number;
    new: number;
    active: number;
    review: number;
    overdue: number;
    dueSoon: number;
    done: number;
    completionRate: number;
  };
  byStatus: Record<Status, number>;
  sidebar: { all: number; mine: number; overdue: number; done: number; completionRate: number };
  bell: number;
}

export interface UserOption {
  id: string;
  fullNameAr: string;
  departmentId: string;
  departmentName: string;
}

export interface NotificationList {
  unread: number;
  items: { id: string; messageAr: string; taskCode: string; readAt: string | null; createdAt: string }[];
}
