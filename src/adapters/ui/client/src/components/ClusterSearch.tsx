/**
 * Search overlay component for finding clusters in the graph.
 */

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Cluster } from '../types';

export interface ClusterSearchProps {
  clusters: Cluster[];
  onClusterClick: (clusterId: string) => void;
}

export const ClusterSearch: React.FC<ClusterSearchProps> = ({ clusters, onClusterClick }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const lower = query.toLowerCase();
    return clusters
      .filter((c) => c.name.toLowerCase().includes(lower))
      .slice(0, 8);
  }, [query, clusters]);

  const showDropdown = isOpen && query.trim().length > 0;

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as globalThis.Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const selectCluster = useCallback(
    (clusterId: string) => {
      onClusterClick(clusterId);
      setQuery('');
      setIsOpen(false);
      inputRef.current?.blur();
      // Delay fitView to run after React re-render settles
      requestAnimationFrame(() => {
        fitView({ nodes: [{ id: clusterId }], duration: 500, padding: 0.5 });
      });
    },
    [onClusterClick, fitView],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < filtered.length) {
            selectCluster(filtered[activeIndex].id);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [showDropdown, filtered, activeIndex, selectCluster],
  );

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const listboxId = 'cluster-search-listbox';

  const highlightMatch = (name: string): React.ReactNode => {
    const lower = name.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx === -1) return name;
    return (
      <>
        {name.slice(0, idx)}
        <strong style={{ fontWeight: 700 }}>{name.slice(idx, idx + query.length)}</strong>
        {name.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        zIndex: 10,
        width: '280px',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search clusters..."
        role="combobox"
        aria-label="Search clusters"
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 ? `cluster-option-${activeIndex}` : undefined}
        aria-autocomplete="list"
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: '13px',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          backgroundColor: '#fff',
          outline: 'none',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          boxSizing: 'border-box',
        }}
      />
      {showDropdown && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Cluster suggestions"
          style={{
            margin: '4px 0 0',
            padding: 0,
            listStyle: 'none',
            backgroundColor: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            maxHeight: '320px',
            overflowY: 'auto',
          }}
        >
          {filtered.length === 0 ? (
            <li
              style={{
                padding: '10px 12px',
                fontSize: '13px',
                color: '#999',
              }}
            >
              No clusters found
            </li>
          ) : (
            filtered.map((cluster, idx) => (
              <li
                key={cluster.id}
                id={`cluster-option-${idx}`}
                role="option"
                aria-selected={idx === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectCluster(cluster.id);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  backgroundColor: idx === activeIndex ? '#f0f4ff' : '#fff',
                  borderBottom: idx < filtered.length - 1 ? '1px solid #f0f0f0' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {highlightMatch(cluster.name)}
                </span>
                <span style={{ fontSize: '11px', color: '#999', marginLeft: '8px', flexShrink: 0 }}>
                  {cluster.memberCount} units
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};
