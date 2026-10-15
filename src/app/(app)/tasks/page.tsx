import { Suspense } from 'react';
import { TasksPage } from '@/components/tasks/TasksPage';

export default function Page() {
  return (
    <Suspense>
      <TasksPage />
    </Suspense>
  );
}
