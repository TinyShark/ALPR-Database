"use client";

import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useRef } from "react";
import io from "socket.io-client";
import PlateTable from "./PlateTable";
import {
  getLatestPlateReads,
  getTags,
  addKnownPlate,
  tagPlate,
  untagPlate,
  deletePlateRead,
} from "@/app/actions";

let socket;

export function PlateTableWrapper({ onConnectionChange, onConnectionError }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [availableTags, setAvailableTags] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const lastAddedPlateId = useRef(null);
  const initialLoadComplete = useRef(false);

  // Get current query parameters
  const page = searchParams.get("page") || "1";
  const pageSize = searchParams.get("pageSize") || "25";
  const search = searchParams.get("search") || "";
  const fuzzySearch = searchParams.get("fuzzySearch") === "true";
  const tag = searchParams.get("tag") || "all";
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  // Load initial data and tags
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [platesResult, tagsResult] = await Promise.all([
          getLatestPlateReads({
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            search,
            fuzzySearch,
            tag,
            dateRange:
              dateFrom && dateTo ? { from: dateFrom, to: dateTo } : null,
          }),
          getTags(),
        ]);

        if (platesResult.data) {
          setData(platesResult.data);
          setTotal(platesResult.pagination.total);
          initialLoadComplete.current = true;
        }

        if (tagsResult.success) {
          setAvailableTags(tagsResult.data);
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
      }
      setLoading(false);
    };

    loadInitialData();
  }, [page, pageSize, search, fuzzySearch, tag, dateFrom, dateTo]);

  // Initialize WebSocket
  useEffect(() => {
    const initializeSocket = async () => {
      try {
        const socketResponse = await fetch("/api/socket");
        const data = await socketResponse.json();
        
        if (!socketResponse.ok) {
          throw new Error(data.error || 'Failed to initialize socket');
        }

        socket = io({
          path: '/api/socketio',
          addTrailingSlash: false,
        });

        socket.on("connect", () => {
          console.log("Socket connected successfully");
          setIsConnected(true);
          onConnectionChange(true);
          onConnectionError(null);
        });

        socket.on("connect_error", (error) => {
          console.error("Socket connection error:", error);
          setIsConnected(false);
          onConnectionChange(false);
          onConnectionError(`Connection error: ${error.message}`);
        });

        socket.on("disconnect", (reason) => {
          console.log("Socket disconnected:", reason);
          setIsConnected(false);
          onConnectionChange(false);
          onConnectionError(`Disconnected: ${reason}`);
        });

        socket.on("newPlate", (plateData) => {
          console.log("New plate received:", plateData);
          
          if (initialLoadComplete.current && parseInt(page) === 1) {
            if (lastAddedPlateId.current !== plateData.id) {
              lastAddedPlateId.current = plateData.id;
              
              setData(prevData => {
                if (prevData.some(plate => plate.id === plateData.id)) {
                  return prevData;
                }

                const newPlate = {
                  ...plateData,
                  occurrence_count: plateData.occurrence_count,
                  tags: plateData.tags || [],
                };
                const updatedData = [newPlate, ...prevData];
                return updatedData.slice(0, parseInt(pageSize));
              });
              
              setTotal(prev => prev + 1);
            }
          }
        });

      } catch (error) {
        console.error("Socket initialization error:", error);
        setIsConnected(false);
        onConnectionChange(false);
        onConnectionError(error.message);
      }
    };

    initializeSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [onConnectionChange, onConnectionError]);

  // Your existing helper functions
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

  // Your existing handlers
  const handleAddTag = async (plateNumber, tagName) => {
    const formData = new FormData();
    formData.append("plateNumber", plateNumber);
    formData.append("tagName", tagName);

    const result = await tagPlate(formData);
    if (result.success) {
      setData((prevData) =>
        prevData.map((plate) => {
          if (plate.plate_number === plateNumber) {
            const newTag = availableTags.find((t) => t.name === tagName);
            return {
              ...plate,
              tags: [...(plate.tags || []), newTag],
            };
          }
          return plate;
        })
      );
    }
  };

  const handleRemoveTag = async (plateNumber, tagName) => {
    const formData = new FormData();
    formData.append("plateNumber", plateNumber);
    formData.append("tagName", tagName);

    const result = await untagPlate(formData);
    if (result.success) {
      setData((prevData) =>
        prevData.map((plate) => {
          if (plate.plate_number === plateNumber) {
            return {
              ...plate,
              tags: (plate.tags || []).filter((tag) => tag.name !== tagName),
            };
          }
          return plate;
        })
      );
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

  const handleDeleteRecord = async (plateNumber) => {
    const formData = new FormData();
    formData.append("plateNumber", plateNumber);

    const result = await deletePlateRead(formData);
    if (result.success) {
      setData((prevData) =>
        prevData.filter((plate) => plate.plate_number !== plateNumber)
      );
      setTotal((prev) => prev - 1);
    }
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

      const queryString = createQueryString({
        ...Object.fromEntries(searchParams.entries()),
        ...newParams,
        page: "1", // Reset to first page on filter change
      });
      router.push(`${pathname}?${queryString}`);
    },
    [router, pathname, searchParams, createQueryString]
  );

  return (
    <PlateTable
      data={data}
      loading={loading}
      availableTags={availableTags}
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
        dateRange: {
          from: dateFrom ? new Date(dateFrom) : null,
          to: dateTo ? new Date(dateTo) : null,
        },
      }}
      onUpdateFilters={updateFilters}
      onAddTag={handleAddTag}
      onRemoveTag={handleRemoveTag}
      onAddKnownPlate={handleAddKnownPlate}
      onDeleteRecord={handleDeleteRecord}
    />
  );
}
