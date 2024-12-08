"use client";

import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import PlateTable from "./PlateTable";
import {
  getLatestPlateReads,
  getTags,
  addKnownPlate,
  tagPlate,
  untagPlate,
  deletePlateRead,
  getCameraNames,
  correctPlateRead,
} from "@/app/actions";

export function PlateTableWrapper() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [availableTags, setAvailableTags] = useState([]);
  const [availableCameras, setAvailableCameras] = useState([]);

  // Get current query parameters
  const page = searchParams.get("page") || "1";
  const pageSize = searchParams.get("pageSize") || "25";
  const search = searchParams.get("search") || "";
  const fuzzySearch = searchParams.get("fuzzySearch") === "true";
  const tag = searchParams.get("tag") || "all";
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const cameraName = searchParams.get("camera");
  const timeFrom = searchParams.get("timeFrom");
  const timeTo = searchParams.get("timeTo");

  // Load initial data and tags
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [platesResult, tagsResult, camerasResult] = await Promise.all([
          getLatestPlateReads({
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            search,
            fuzzySearch,
            tag,
            dateRange:
              dateFrom && dateTo ? { from: dateFrom, to: dateTo } : null,
            cameraName,
            timeFrom,
            timeTo
          }),
          getTags(),
          getCameraNames(),
        ]);

        // Update data if we have it (removed success check)
        if (platesResult.data) {
          setData(platesResult.data);
          setTotal(platesResult.pagination.total);
        }

        if (tagsResult.success) {
          setAvailableTags(tagsResult.data);
        }

        if (camerasResult.success) {
          setAvailableCameras(camerasResult.data);
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
      }
      setLoading(false);
    };

    loadInitialData();
  }, [page, pageSize, search, fuzzySearch, tag, dateFrom, dateTo, cameraName, timeFrom, timeTo]);

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

  const handleAddTag = async (plateNumber, tagName) => {
    try {
      // Find the plate to determine if it's a misread
      const plate = data.find(p => p.plate_number === plateNumber);
      if (!plate) {
        return;
      }

      const formData = new FormData();
      
      // If this is a misread, use its parent's plate number
      if (plate.parent_plate_number) {
        formData.append("plateNumber", plate.parent_plate_number);
      } else {
        formData.append("plateNumber", plateNumber);
      }
      formData.append("tagName", tagName);

      const result = await tagPlate(formData);
      if (result.success) {
        const newTag = availableTags.find((t) => t.name === tagName);
        
        setData((prevData) =>
          prevData.map((p) => {
            if (plate.parent_plate_number) {
              // If this was a misread, update the parent and all its misreads
              if (p.plate_number === plate.parent_plate_number) {
                // Update parent's tags
                return {
                  ...p,
                  tags: [...(p.tags || []), newTag]
                };
              } else if (p.parent_plate_number === plate.parent_plate_number) {
                // Update all misreads of the same parent
                return {
                  ...p,
                  parent_tags: [...(p.parent_tags || []), newTag]
                };
              }
            } else {
              // This is a parent plate, update it and all its misreads
              if (p.plate_number === plateNumber) {
                // Update the parent's tags
                return {
                  ...p,
                  tags: [...(p.tags || []), newTag]
                };
              } else if (p.parent_plate_number === plateNumber) {
                // Update all misreads of this parent
                return {
                  ...p,
                  parent_tags: [...(p.parent_tags || []), newTag]
                };
              }
            }
            return p;
          })
        );
      }
    } catch (error) {
      console.error("Failed to add tag:", error);
    }
  };

  const handleRemoveTag = async (plateNumber, tagName) => {
    try {
      // Find the plate to determine if it's a misread
      const plate = data.find(p => p.plate_number === plateNumber);
      if (!plate) {
        return;
      }

      const formData = new FormData();
      
      // If this is a misread, use its parent's plate number
      if (plate.parent_plate_number) {
        formData.append("plateNumber", plate.parent_plate_number);
      } else {
        formData.append("plateNumber", plateNumber);
      }
      formData.append("tagName", tagName);

      const result = await untagPlate(formData);

      if (result.success) {
        // Update local state
        setData((prevData) =>
          prevData.map((p) => {
            if (plate.parent_plate_number) {
              // If this was a misread, update the parent and all its misreads
              if (p.plate_number === plate.parent_plate_number) {
                // Update parent's tags
                return {
                  ...p,
                  tags: (p.tags || []).filter(t => t.name !== tagName)
                };
              } else if (p.parent_plate_number === plate.parent_plate_number) {
                // Update all misreads of the same parent
                return {
                  ...p,
                  parent_tags: (p.parent_tags || []).filter(t => t.name !== tagName)
                };
              }
            } else {
              // This is a parent plate, update it and all its misreads
              if (p.plate_number === plateNumber) {
                // Update the parent's tags
                return {
                  ...p,
                  tags: (p.tags || []).filter(t => t.name !== tagName)
                };
              } else if (p.parent_plate_number === plateNumber) {
                // Update all misreads of this parent
                return {
                  ...p,
                  parent_tags: (p.parent_tags || []).filter(t => t.name !== tagName)
                };
              }
            }
            return p;
          })
        );
      }
    } catch (error) {
      console.error("Failed to remove tag:", error);
    }
  };

  const handleAddKnownPlate = async (plateNumber, name, notes) => {
    const formData = new FormData();
    formData.append("plateNumber", plateNumber);
    formData.append("name", name);
    formData.append("notes", notes);

    const result = await addKnownPlate(formData);
    if (result.success) {
      setData((prevData) =>
        prevData.map((plate) =>
          plate.plate_number === plateNumber
            ? { ...plate, known_name: name, known_notes: notes }
            : plate
        )
      );
    }
  };

  const handleDeleteRecord = async (formData) => {
    const result = await deletePlateRead(formData);
    if (result.success) {
      try {
        // Refresh the data to get the updated list
        const platesResult = await getLatestPlateReads({
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          search,
          fuzzySearch,
          tag,
          dateRange: dateFrom && dateTo ? { from: dateFrom, to: dateTo } : null,
          cameraName,
          timeRange: {
            from: timeFrom,
            to: timeTo
          },
        });

        if (platesResult.data) {
          setData(platesResult.data);
          setTotal(platesResult.pagination.total);
        }
      } catch (error) {
        console.error("Error refreshing data after delete:", error);
      }
    }
    return result;
  };

  const handlePageChange = useCallback(
    (direction) => {
      const currentPage = parseInt(page);
      const newPage = direction === "next" ? currentPage + 1 : currentPage - 1;

      if (
        newPage < 1 ||
        (direction === "next" && currentPage * parseInt(pageSize) >= total)
      ) {
        return;
      }

      const queryString = createQueryString({ page: newPage.toString() });
      router.push(`${pathname}?${queryString}`);
    },
    [page, pageSize, total, router, pathname, createQueryString]
  );

  const updateFilters = useCallback(
    (newParams) => {
      if ("page" in newParams) return;

      // Create new query string, removing any existing params that are being cleared
      const current = new URLSearchParams(Array.from(searchParams.entries()));

      // Remove any params that are being explicitly set to null/empty/all
      Object.keys(newParams).forEach(key => {
        if (newParams[key] === null || newParams[key] === undefined || newParams[key] === "" || newParams[key] === "all" || newParams[key] === "any") {
          current.delete(key);
        }
      });

      // Add new non-empty params
      Object.entries(newParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== "" && value !== "all" && value !== "any") {
          current.set(key, value);
        }
      });

      // Always reset to page 1 when filters change
      current.set("page", "1");

      router.push(`${pathname}?${current.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const handleCorrectPlate = async (formData) => {
    const result = await correctPlateRead(formData);
    if (result.success) {
      const readId = formData.get("readId");
      const newPlateNumber = formData.get("newPlateNumber");
      const correctAll = formData.get("correctAll") === "true";

      if (correctAll) {
        // If correcting all instances, reload the entire dataset
        const platesResult = await getLatestPlateReads({
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          search,
          fuzzySearch,
          tag,
          dateRange: dateFrom && dateTo ? { from: dateFrom, to: dateTo } : null,
          cameraName,
          timeRange: {
            from: timeFrom,
            to: timeTo
          },
        });

        if (platesResult.data) {
          setData(platesResult.data);
          setTotal(platesResult.pagination.total);
        }
      } else {
        // If correcting single instance, update optimistically
        setData((prevData) =>
          prevData.map((plate) =>
            plate.id === parseInt(readId)
              ? { ...plate, plate_number: newPlateNumber }
              : plate
          )
        );
      }
    }
    return result;
  };

  const clearFilters = () => {
    onUpdateFilters({
      search: "",
      tag: "all",
      dateFrom: null,
      dateTo: null,
      timeFrom: null,
      timeTo: null,
      camera: "all"
    });
  };

  return (
    <PlateTable
      data={data}
      loading={loading}
      availableTags={availableTags}
      availableCameras={availableCameras}
      pagination={{
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        onNextPage: () => handlePageChange("next"),
        onPreviousPage: () => handlePageChange("prev"),
      }}
      filters={{
        search,
        fuzzySearch,
        tag,
        dateFrom,
        dateTo,
        cameraName,
        timeFrom,
        timeTo,
      }}
      onUpdateFilters={updateFilters}
      onAddTag={handleAddTag}
      onRemoveTag={handleRemoveTag}
      onAddKnownPlate={handleAddKnownPlate}
      onDeleteRecord={handleDeleteRecord}
      onCorrectPlate={handleCorrectPlate}
    />
  );
}
