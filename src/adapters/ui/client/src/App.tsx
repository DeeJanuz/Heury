import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { SearchPage } from './pages/SearchPage';
import { ClusterMapPage } from './pages/ClusterMapPage';
import { CodeUnitPage } from './pages/CodeUnitPage';
import type { Stats } from './types';

function getHash(): string {
  return window.location.hash || '#/';
}

interface Route {
  page: 'dashboard' | 'search' | 'clusters' | 'code-unit';
  params: Record<string, string>;
}

function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';

  if (path === '/') {
    return { page: 'dashboard', params: {} };
  }

  if (path === '/search') {
    return { page: 'search', params: {} };
  }

  if (path === '/clusters') {
    return { page: 'clusters', params: {} };
  }

  const codeUnitMatch = path.match(/^\/code-units\/(.+)$/);
  if (codeUnitMatch) {
    return { page: 'code-unit', params: { id: codeUnitMatch[1] } };
  }

  return { page: 'dashboard', params: {} };
}

export const App: React.FC = () => {
  const [hash, setHash] = useState(getHash);
  const [projectName, setProjectName] = useState<string>();
  const [projectDir, setProjectDir] = useState<string>();

  useEffect(() => {
    const onHashChange = () => setHash(getHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data: Stats) => {
        setProjectName(data.project_name);
        setProjectDir(data.project_dir);
      })
      .catch(() => {
        // Stats fetch failed — project context unavailable
      });
  }, []);

  const navigate = useCallback((newHash: string) => {
    window.location.hash = newHash;
  }, []);

  const route = parseRoute(hash);

  let page: React.ReactNode;
  switch (route.page) {
    case 'dashboard':
      page = <DashboardPage />;
      break;
    case 'search':
      page = <SearchPage onNavigate={navigate} />;
      break;
    case 'clusters':
      page = <ClusterMapPage onNavigate={navigate} />;
      break;
    case 'code-unit':
      page = <CodeUnitPage id={route.params.id} onNavigate={navigate} />;
      break;
  }

  return (
    <Layout currentRoute={hash} onNavigate={navigate} projectName={projectName} projectDir={projectDir}>
      {page}
    </Layout>
  );
};
