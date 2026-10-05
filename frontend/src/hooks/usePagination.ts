import { useState, useMemo, useEffect } from 'react';

export function usePagination<T>(items: T[], initialPageSize = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [isLazyLoading, setIsLazyLoading] = useState(false);

  // Automatically adjust current page if total pages shrinks
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [items.length, totalPages, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage === currentPage) return;
    setIsLazyLoading(true);
    setCurrentPage(newPage);
    // Smooth micro-task lazy load animation to avoid jarring layout shifts
    setTimeout(() => {
      setIsLazyLoading(false);
    }, 150);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setIsLazyLoading(true);
    setPageSize(newPageSize);
    setCurrentPage(1);
    setTimeout(() => {
      setIsLazyLoading(false);
    }, 150);
  };

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, currentPage, pageSize]);

  return {
    currentPage,
    pageSize,
    totalPages,
    totalItems: items.length,
    paginatedItems,
    isLazyLoading,
    setCurrentPage: handlePageChange,
    setPageSize: handlePageSizeChange,
  };
}
