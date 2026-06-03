'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface RouterContextType {
  pathname: string;
  navigate: (href: string) => void;
  pageId: string | null;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export function RouterProvider({ children }: { children: ReactNode }) {
  // Use state to track current client-side route path
  const [pathname, setPathname] = useState<string>(() => {
    // Synchronize with window.location.hash or fallback to '/'
    const hash = window.location.hash;
    if (hash && hash.startsWith('#')) {
      return hash.substring(1);
    }
    return '/';
  });

  const navigate = (href: string) => {
    setPathname(href);
    window.location.hash = href;
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#')) {
        setPathname(hash.substring(1));
      } else {
        setPathname('/');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Parse pageId if the path matches /page/[pageId]
  const pageIdMatch = pathname.match(/^\/page\/([^/]+)/);
  const pageId = pageIdMatch ? pageIdMatch[1] : null;

  return (
    <RouterContext.Provider value={{ pathname, navigate, pageId }}>
      {children}
    </RouterContext.Provider>
  );
}

export function usePathname() {
  const context = useContext(RouterContext);
  if (!context) throw new Error('usePathname must be used within a RouterProvider');
  return context.pathname;
}

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) throw new Error('useRouter must be used within a RouterProvider');
  return {
    push: (href: string) => context.navigate(href),
    replace: (href: string) => context.navigate(href),
  };
}

export function useParams() {
  const context = useContext(RouterContext);
  if (!context) throw new Error('useParams must be used within a RouterProvider');
  return { pageId: context.pageId };
}

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: ReactNode;
}

export function Link({ href, children, ...props }: LinkProps) {
  const context = useContext(RouterContext);
  if (!context) throw new Error('Link must be used within a RouterProvider');

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    context.navigate(href);
  };

  // Convert pure href to a hash-based route link for HTML-compatibility
  return (
    <a href={`#${href}`} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
