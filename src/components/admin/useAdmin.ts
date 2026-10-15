'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Role } from '@/lib/taskRules';

export interface AdminUser {
  id: string;
  fullNameAr: string;
  email: string;
  role: Role;
  isActive: boolean;
  departmentId: string;
  department: { nameAr: string };
}

export interface AdminDepartment {
  id: string;
  nameAr: string;
  manager: { id: string; fullNameAr: string } | null;
  usersCount: number;
}

export const useAdminUsers = () => useQuery({ queryKey: ['admin', 'users'], queryFn: () => api<AdminUser[]>('/admin/users') });
export const useAdminDepartments = () =>
  useQuery({ queryKey: ['admin', 'departments'], queryFn: () => api<AdminDepartment[]>('/admin/departments') });
