'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface RouterContextType {
  pathname: string;
  navigate: (href: string) => void;
  pageId: string | null;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

function normalizePath(raw: string): string {
  if (!raw) return '/';
  let path = raw;
  if (path.startsWith('#')) {
    path = path.substring(1);
  }
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  return path;
}

export function RouterProvider({ children }: { children: ReactNode }) {
  // Use state to track current client-side route path
  const [pathname, setPathname] = useState<string>(() => {
    return normalizePath(window.location.hash);
  });

  const navigate = (href: string) => {
    const clean = normalizePath(href);
    setPathname(clean);
    if (window.location.hash !== `#${clean}`) {
      window.location.hash = clean;
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      setPathname(normalizePath(window.location.hash));
    };

    const handleGlobalLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href && (href.startsWith('/') || href.startsWith('#/'))) {
          e.preventDefault();
          e.stopPropagation();
          anchor.setAttribute('target', '_self');
          navigate(href);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    document.addEventListener('click', handleGlobalLinkClick, true);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      document.removeEventListener('click', handleGlobalLinkClick, true);
    };
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
    back: () => {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        window.history.back();
      } else {
        context.navigate('/');
      }
    },
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
