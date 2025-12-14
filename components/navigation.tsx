'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { MessageIcon, TaskIcon, FileIcon, LogoutIcon } from '@hugeicons/core-free-icons';

export function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: '/chat', label: 'Chat', icon: MessageIcon },
    { href: '/tasks', label: 'Tasks', icon: TaskIcon },
    { href: '/summary', label: 'Summary', icon: FileIcon },
  ];

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold">
              ProdUp
            </Link>
            <div className="flex items-center gap-4">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <HugeiconsIcon icon={item.icon} className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          >
            <HugeiconsIcon icon={LogoutIcon} className="w-5 h-5 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  );
}

