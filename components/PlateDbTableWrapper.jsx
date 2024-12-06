"use client";

import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useMemo } from "react";
import PlateDbTable from "./plateDbTable";
import { getAllPlatesWithKnownInfo } from "@/app/actions";
import { format } from "date-fns";

export function PlateDbTableWrapper() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // Get values from URL parameters or use defaults
  const urlParams = useMemo(() => ({
    page: searchParams.get('page') || '1',
    pageSize: searchParams.get('pageSize') || '10',
    sortField: searchParams.get('sortField') || 'first_seen_at',
    sortOrder: searchParams.get('sortOrder') || 'DESC',
    tag: searchParams.get('tag') || 'all',
    search: searchParams.get('search') || '',
    dateFrom: searchParams.get('dateFrom') || null,
    dateTo: searchParams.get('dateTo') || null
  }), [searchParams]);

  const createQueryString = useCallback(
    (params) => {
      const current = new URLSearchParams(Array.from(searchParams.entries()));
      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") {
          current.delete(key);
        } else {
          current.set(key, value);
        }
      });
      return current.toString();
    },
    [searchParams]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllPlatesWithKnownInfo({
        page: parseInt(urlParams.page),
        pageSize: parseInt(urlParams.pageSize),
        sortField: urlParams.sortField,
        sortOrder: urlParams.sortOrder,
        filters: {
          tag: urlParams.tag || 'all',
          search: urlParams.search || '',
          dateFrom: urlParams.dateFrom,
          dateTo: urlParams.dateTo
        }
      });

      if (result.success) {
        setData(result.data);
        setTotal(result.pagination.total);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  }, [urlParams]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlers = useMemo(() => ({
    handleTagClick: (tagName) => {
      const newTag = tagName === urlParams.tag ? 'all' : tagName;
      const queryString = createQueryString({ 
        tag: newTag,
        page: '1'
      });
      router.push(`${pathname}?${queryString}`);
    },

    handleSearch: (searchTerm) => {
      const queryString = createQueryString({ 
        search: searchTerm,
        page: '1'
      });
      router.push(`${pathname}?${queryString}`);
    },

    handleDateRangeChange: (range) => {
      if (!range) {
        const queryString = createQueryString({ 
          dateFrom: null,
          dateTo: null,
          page: '1'
        });
        router.push(`${pathname}?${queryString}`);
        return;
      }

      const queryString = createQueryString({ 
        dateFrom: format(range.from, 'yyyy-MM-dd'),
        dateTo: format(range.to || range.from, 'yyyy-MM-dd'),
        page: '1'
      });
      router.push(`${pathname}?${queryString}`);
    },

    handlePageChange: (direction) => {
      const currentPage = parseInt(urlParams.page);
      const newPage = direction === "next" ? currentPage + 1 : currentPage - 1;

      if (newPage < 1 || (direction === "next" && currentPage * parseInt(urlParams.pageSize) >= total)) {
        return;
      }

      const queryString = createQueryString({ page: newPage.toString() });
      router.push(`${pathname}?${queryString}`);
    },

    handlePageSizeChange: (newPageSize) => {
      const queryString = createQueryString({
        pageSize: newPageSize.toString(),
        page: '1',
      });
      router.push(`${pathname}?${queryString}`);
    },

    handleSort: (field) => {
      const currentSortField = urlParams.sortField;
      const currentSortOrder = urlParams.sortOrder;
      
      // Toggle order if clicking same field, otherwise default to DESC
      const newSortOrder = 
        field === currentSortField 
          ? (currentSortOrder === 'DESC' ? 'ASC' : 'DESC')
          : 'DESC';

      const queryString = createQueryString({ 
        sortField: field,
        sortOrder: newSortOrder,
        page: '1' // Reset to first page when sorting changes
      });
      router.push(`${pathname}?${queryString}`);
    },
  }), [urlParams, total, router, pathname, createQueryString]);

  const paginationProps = useMemo(() => ({
    page: parseInt(urlParams.page),
    pageSize: parseInt(urlParams.pageSize),
    total,
    onNextPage: () => handlers.handlePageChange("next"),
    onPreviousPage: () => handlers.handlePageChange("prev"),
    onPageSizeChange: handlers.handlePageSizeChange,
  }), [urlParams.page, urlParams.pageSize, total, handlers]);

  return (
    <PlateDbTable 
      initialData={data}
      loading={loading}
      filters={{
        tag: urlParams.tag || 'all',
        search: urlParams.search || '',
        dateFrom: urlParams.dateFrom,
        dateTo: urlParams.dateTo
      }}
      sort={{
        field: urlParams.sortField,
        order: urlParams.sortOrder
      }}
      onUpdateFilters={{
        onTagClick: handlers.handleTagClick,
        onSearch: handlers.handleSearch,
        onDateRangeChange: handlers.handleDateRangeChange,
        onSort: handlers.handleSort
      }}
      pagination={paginationProps}
    />
  );
} 