"use client";

import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useMemo } from "react";
import PlateDbTable from "./plateDbTable";
import { getAllPlatesWithKnownInfo } from "@/app/actions";
import { format } from "date-fns";
import { toast } from "sonner";
import { addKnownPlateWithMisreads } from "@/app/actions";

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
    sortField: searchParams.get('sortField') || 'last_seen_at',
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
        // Transform data to ensure consistent plate number format
        const transformedData = result.data.map(plate => ({
          ...plate,
          plateNumber: plate.plate_number,
          misreads: plate.misreads?.map(misread => ({
            ...misread,
            plateNumber: misread.plate_number
          }))
        }));
        setData(transformedData);
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
        // Create a new URLSearchParams with only sort parameters
        const newParams = new URLSearchParams();
        // Preserve sort settings
        if (urlParams.sortField) newParams.set('sortField', urlParams.sortField);
        if (urlParams.sortOrder) newParams.set('sortOrder', urlParams.sortOrder);
        // Reset to page 1
        newParams.set('page', '1');
        // Use the new params string directly
        router.push(`${pathname}?${newParams.toString()}`);
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

    handleClearFilters: () => {
      // Create a new URLSearchParams with only sort parameters
      const newParams = new URLSearchParams();
      // Preserve sort settings
      if (urlParams.sortField) newParams.set('sortField', urlParams.sortField);
      if (urlParams.sortOrder) newParams.set('sortOrder', urlParams.sortOrder);
      if (urlParams.pageSize) newParams.set('pageSize', urlParams.pageSize);
      // Reset to page 1
      newParams.set('page', '1');
      // Use the new params string directly
      router.push(`${pathname}?${newParams.toString()}`);
    },

    handleAddToKnownPlates: async (plateData) => {
      try {
        if (plateData.type === 'new') {
          // Adding as new known plate
          const result = await addKnownPlateWithMisreads({
            plateNumber: plateData.plateNumber,
            name: plateData.name,
            notes: plateData.notes,
            tags: plateData.tags || []
          });
          
          if (result.success) {
            toast.success('Added to known plates successfully');
            loadData(); // Refresh the data
          }
        } else {
          // Adding as misread to existing plate
          const result = await addKnownPlateWithMisreads({
            plateNumber: plateData.parentPlateNumber,
            misreads: [plateData.plateNumber]
          });
          
          if (result.success) {
            toast.success('Added as misread successfully');
            loadData(); // Refresh the data
          }
        }
      } catch (error) {
        console.error('Error adding to known plates:', error);
        toast.error('Failed to add to known plates');
      }
    }
  }), [urlParams, total, router, pathname, createQueryString, loadData]);

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
        onSort: handlers.handleSort,
        onClearFilters: handlers.handleClearFilters
      }}
      pagination={paginationProps}
    />
  );
} 