import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';

export const AppLayout = () => {
  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
