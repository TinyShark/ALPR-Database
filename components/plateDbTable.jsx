"use client";
import { useState, useEffect, useMemo, Fragment } from "react";
import {
  Search,
  Filter,
  Tag,
  Plus,
  Trash2,
  X,
  Calendar,
  TrendingUp,
  Flag,
  ArrowUpRightIcon,
  ArrowUp,
  ArrowDown,
  Check,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowRightIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, LabelList } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getPlates,
  getTags,
  addKnownPlate,
  tagPlate,
  untagPlate,
  deletePlate,
  fetchPlateInsights,
  alterPlateFlag,
  deletePlateFromDB,
  deleteMisreadFromDB,
  getKnownPlatesList,
  addKnownPlateWithMisreads,
} from "@/app/actions";
import Image from "next/image";
import Link from "next/link";
import { format, parseISO, isValid } from "date-fns";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

const formatDaysAgo = (timestamp) => {
  if (!timestamp) return '';
  
  const now = new Date();
  const date = new Date(timestamp);
  const diffInMillis = now - date;
  const diffInMinutes = Math.floor(diffInMillis / (1000 * 60));
  const diffInHours = Math.floor(diffInMillis / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMillis / (1000 * 60 * 60 * 24));
  
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  }
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  }
  if (diffInDays === 1) {
    return 'Yesterday';
  }
  if (diffInDays >= 15) {
    return '15+ days ago';
  }
  return `${diffInDays} days ago`;
};

const formatTimeRange = (timeRange) => {
  const [start, end] = timeRange.split("-");
  const formatHour = (hour) => {
    const hourNum = parseInt(hour);
    if (hourNum === 0) return "12 AM";
    if (hourNum === 12) return "12 PM";
    return hourNum > 12 ? `${hourNum - 12} PM` : `${hourNum} AM`;
  };
  return `${formatHour(start)} - ${formatHour(end)}`;
};

const formatTimestamp = (timestamp) => {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const isWithinDateRange = (firstSeenDate, selectedDateRange) => {
  if (
    !selectedDateRange ||
    !Array.isArray(selectedDateRange) ||
    selectedDateRange.length !== 2
  ) {
    return true; // No range filter applied
  }

  const [startDate, endDate] = selectedDateRange.map((date) =>
    formatTimestamp(new Date(date))
  );
  const formattedFirstSeenDate = formatTimestamp(firstSeenDate);

  // Print the formatted dates for debugging
  // console.log("Comparing dates...");
  // console.log("Formatted First Seen Date:", formattedFirstSeenDate);
  // console.log("Formatted Start Date:", startDate);
  // console.log("Formatted End Date:", endDate);

  // Compare formatted date strings lexicographically
  return (
    formattedFirstSeenDate >= startDate && formattedFirstSeenDate <= endDate
  );
};

const PAGE_SIZE_OPTIONS = [
  { value: "10", label: "10 per page" },
  { value: "25", label: "25 per page" },
  { value: "50", label: "50 per page" },
  { value: "100", label: "100 per page" },
];

// Add a helper function to check if any filters are active
const hasActiveFilters = (filters) => {
  return Boolean(
    filters.search || 
    filters.tag !== 'all' || 
    filters.dateFrom || 
    filters.dateTo
  );
};

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  
  const now = new Date();
  const date = new Date(timestamp);
  const diffInMillis = now - date;
  const diffInMinutes = Math.floor(diffInMillis / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  }
  return formatDaysAgo(timestamp);
};

export default function PlateDbTable({ 
  initialData = [], 
  loading = false,
  filters,
  sort = {
    field: 'last_seen_at',
    order: 'DESC'
  },
  onUpdateFilters,
  pagination = {
    page: 1,
    pageSize: 25,
    total: 0,
    onNextPage: () => {},
    onPreviousPage: () => {},
    onPageSizeChange: () => {},
  }
}) {
  const [data, setData] = useState(initialData);
  const [filteredData, setFilteredData] = useState(initialData);
  const [isAddKnownPlateOpen, setIsAddKnownPlateOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [activePlate, setActivePlate] = useState(null);
  const [newKnownPlate, setNewKnownPlate] = useState({ 
    name: "", 
    notes: "", 
    tags: [] 
  });
  const [availableTags, setAvailableTags] = useState([]);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [plateInsights, setPlateInsights] = useState(null);
  const [expandedPlates, setExpandedPlates] = useState(new Set());
  const [isDeleteMisreadConfirmOpen, setIsDeleteMisreadConfirmOpen] = useState(false);
  const [activeMisread, setActiveMisread] = useState(null);
  const [isAddToKnownOpen, setIsAddToKnownOpen] = useState(false);
  const [selectedParentPlate, setSelectedParentPlate] = useState(null);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [knownPlates, setKnownPlates] = useState([]);

  useEffect(() => {
    setData(initialData);
    setFilteredData(initialData);
  }, [initialData]);

  useEffect(() => {
    const filtered = data.filter((plate) => {
      // Search filter
      const matchesSearch = filters.search === "" || Boolean(
        plate.plate_number?.toLowerCase().includes(filters.search.toLowerCase()) ||
        plate.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        plate.notes?.toLowerCase().includes(filters.search.toLowerCase())
      );

      // Tag filter
      const matchesTag = filters.tag === "all" || Boolean(
        plate.tags?.some(tag => tag.name === filters.tag)
      );

      // Date filter
      const matchesDate = !filters.dateRange?.from || !filters.dateRange?.to || Boolean(
        (!filters.dateRange.from || new Date(plate.first_seen_at) >= filters.dateRange.from) &&
        (!filters.dateRange.to || new Date(plate.first_seen_at) <= filters.dateRange.to)
      );

      const includeInResults = Boolean(matchesSearch && matchesTag && matchesDate);

      return includeInResults;
    });

    setFilteredData(filtered);
  }, [data, filters.search, filters.tag, filters.dateRange]);

  useEffect(() => {
    const loadKnownPlates = async () => {
      if (isAddToKnownOpen) {
        console.log('Loading known plates...');
        const result = await getKnownPlatesList();
        console.log('Known plates result:', result);

        if (result.success && result.data?.data) {
          const parentPlates = result.data.data
            .filter(plate => !plate.parent_plate_number)
            .map(plate => ({
              ...plate,
              plateNumber: plate.plate_number
            }));
          console.log('Filtered parent plates:', parentPlates);
          setKnownPlates(parentPlates);
        } else {
          setKnownPlates([]);
        }
      }
    };

    loadKnownPlates();
  }, [isAddToKnownOpen]);

  const getSortIcon = (columnKey) => {
    if (sort.field !== columnKey) {
      return <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />;
    }
    return sort.order === "ASC" ? (
      <ChevronUp className="ml-2 h-4 w-4 shrink-0" />
    ) : (
      <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
    );
  };

  const handleAddTag = async (plateNumber, tagName) => {
    try {
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
    } catch (error) {
      console.error("Failed to add tag:", error);
    }
  };

  const handleRemoveTag = async (plateNumber, tagName) => {
    try {
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
    } catch (error) {
      console.error("Failed to remove tag:", error);
    }
  };

  const handleAddKnownPlate = async () => {
    if (!activePlate) return;
    try {
      const formData = new FormData();
      formData.append("plateNumber", activePlate.plate_number);
      formData.append("name", newKnownPlate.name);
      formData.append("notes", newKnownPlate.notes);

      const result = await addKnownPlate(formData);
      if (result.success) {
        setData((prevData) =>
          prevData.map((plate) =>
            plate.plate_number === activePlate.plate_number
              ? {
                  ...plate,
                  name: newKnownPlate.name,
                  notes: newKnownPlate.notes,
                }
              : plate
          )
        );
        setIsAddKnownPlateOpen(false);
        setNewKnownPlate({ name: "", notes: "" });
        toast.success(`Added ${activePlate.plate_number} to known plates`);
      }
    } catch (error) {
      console.error("Failed to add known plate:", error);
      toast.error("Failed to add to known plates");
    }
  };

  const handleDeleteRecord = async () => {
    if (!activePlate) return;
    try {
      const formData = new FormData();
      formData.append("plateNumber", activePlate.plate_number);

      const result = await deletePlateFromDB(formData);
      if (result.success) {
        setData((prevData) =>
          prevData.filter(
            (plate) => plate.plate_number !== activePlate.plate_number
          )
        );
        setIsDeleteConfirmOpen(false);
        toast.success(`Deleted plate ${activePlate.plate_number}`);
      }
    } catch (error) {
      console.error("Failed to delete record:", error);
      toast.error("Failed to delete plate");
    }
  };

  const handleOpenInsights = async (plate) => {
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const plateNumber = plate.parent_plate_number || plate.plate_number;
      const result = await fetchPlateInsights(plateNumber, timeZone);
      if (result.success) {
        setPlateInsights(result.data);
        setIsInsightsOpen(true);
      }
    } catch (error) {
      console.error("Failed to fetch plate insights:", error);
    }
  };

  const handleToggleFlag = async (plateNumber, flagged) => {
    try {
      const formData = new FormData();
      formData.append("plateNumber", plateNumber);
      formData.append("flagged", flagged.toString());

      const result = await alterPlateFlag(formData);
      if (result.success) {
        setData((prevData) =>
          prevData.map((plate) =>
            plate.plate_number === plateNumber ? { ...plate, flagged } : plate
          )
        );
        toast.success(`${flagged ? 'Flagged' : 'Unflagged'} plate ${plateNumber}`);
      }
    } catch (error) {
      console.error("Failed to toggle plate flag:", error);
      toast.error("Failed to update flag");
    }
  };

  const handleDeleteMisread = async () => {
    if (!activeMisread) return;
    try {
      const formData = new FormData();
      formData.append("plateNumber", activeMisread.plate_number);

      const result = await deleteMisreadFromDB(formData);
      if (result.success) {
        // Update the local state to remove the misread
        setData((prevData) =>
          prevData.map((plate) => {
            if (plate.misreads?.some(m => m.plate_number === activeMisread.plate_number)) {
              return {
                ...plate,
                misreads: plate.misreads.filter(m => m.plate_number !== activeMisread.plate_number),
                total_occurrence_count: plate.total_occurrence_count - 
                  (plate.misreads.find(m => m.plate_number === activeMisread.plate_number)?.occurrence_count || 0)
              };
            }
            return plate;
          })
        );
        setIsDeleteMisreadConfirmOpen(false);
        toast.success(`Deleted misread ${activeMisread.plate_number}`);
      }
    } catch (error) {
      console.error("Failed to delete misread:", error);
      toast.error("Failed to delete misread");
    }
  };

  const groupedData = useMemo(() => {
    if (!Array.isArray(data)) {
      console.log('Data is invalid:', data);
      return [];
    }

    const groups = new Map();
    
    // First pass: Collect all plates and their misreads
    data.forEach(plate => {
      if (!plate) return;

      // If this is a misread (has parent_plate_number), store it for later processing
      if (plate.parent_plate_number) {
        return;
      }

      // Add the plate as a potential parent
      groups.set(plate.plate_number, {
        ...plate,
        misreads: [],
        total_occurrence_count: parseInt(plate.occurrence_count || 0),
        name: plate.parent_name || plate.name,
        notes: plate.parent_notes || plate.notes,
        tags: plate.parent_tags || plate.tags
      });
    });

    // Second pass: Process misreads
    data.forEach(plate => {
      if (!plate?.parent_plate_number) return;

      const occurrenceCount = parseInt(plate.occurrence_count || '0');
      
      // Skip if occurrence count is 0 or invalid
      if (!occurrenceCount || occurrenceCount <= 0) {
        return;
      }

      // Add valid misread to parent
      if (groups.has(plate.parent_plate_number)) {
        const parentPlate = groups.get(plate.parent_plate_number);
        
        parentPlate.misreads.push({
          ...plate,
          occurrence_count: occurrenceCount
        });
        parentPlate.total_occurrence_count += occurrenceCount;
      }
    });

    const result = Array.from(groups.values());

    return result;
  }, [data]);

  const toggleExpand = (plateNumber, e) => {
    e.stopPropagation();
    setExpandedPlates(prev => {
      const next = new Set(prev);
      if (next.has(plateNumber)) {
        next.delete(plateNumber);
      } else {
        next.add(plateNumber);
      }
      return next;
    });
  };

  const handleSearch = (e) => {
    onUpdateFilters.onSearch(e.target.value);
  };

  const handleTagFilter = (value) => {
    onUpdateFilters.onTagClick(value);
  };

  const handleDateRangeChange = (range) => {
    onUpdateFilters.onDateRangeChange(range);
  };

  // Load tags
  useEffect(() => {
    const loadTags = async () => {
      const result = await getTags();
      if (result.success) {
        setAvailableTags(result.data);
      }
    };
    loadTags();
  }, []);

  // Filtering logic
  useEffect(() => {

    const filtered = data.filter((plate) => {
      // Skip plates that are misreads in the initial filter
      if (plate.parent_plate_number) {
        return false;
      }

      // Search filter - check plate and its misreads
      const matchesSearch = filters.search === "" || Boolean(
        plate.plate_number?.toLowerCase().includes(filters.search.toLowerCase()) ||
        plate.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        plate.notes?.toLowerCase().includes(filters.search.toLowerCase()) ||
        data.some(misread => 
          misread.parent_plate_number === plate.plate_number &&
          misread.plate_number.toLowerCase().includes(filters.search.toLowerCase())
        )
      );

      // Tag filter
      const matchesTag = filters.tag === "all" || Boolean(
        plate.tags?.some(tag => tag.name === filters.tag)
      );

      // Date filter
      const matchesDate = !filters.dateRange?.from || !filters.dateRange?.to || Boolean(
        (!filters.dateRange.from || new Date(plate.first_seen_at) >= filters.dateRange.from) &&
        (!filters.dateRange.to || new Date(plate.first_seen_at) <= filters.dateRange.to)
      );
      return matchesSearch && matchesTag && matchesDate;
    });

    // After filtering, group the data
    const groups = new Map();
    
    // First, add all filtered parent plates with their existing misreads
    filtered.forEach(plate => {
      if (!plate) return;

      const misreadsTotal = plate.misreads?.reduce((sum, misread) => 
        sum + parseInt(misread.occurrence_count || 0), 0) || 0;

      groups.set(plate.plate_number, {
        ...plate,
        misreads: plate.misreads || [],
        total_occurrence_count: parseInt(plate.occurrence_count || 0)
      });
    });

    const groupedData = Array.from(groups.values());
    setFilteredData(groupedData);
  }, [data, filters.search, filters.tag, filters.dateRange]);

  const handleAddToKnownPlates = async () => {
    if (!activePlate) return;

    try {
      const formData = new FormData();
      
      if (selectedParentPlate) {
        formData.append("plateNumber", selectedParentPlate.plateNumber);
        formData.append("misreads", JSON.stringify([activePlate.plate_number]));
      } else {
        formData.append("plateNumber", activePlate.plate_number);
        formData.append("name", newKnownPlate.name);
        formData.append("notes", newKnownPlate.notes);
        formData.append("misreads", JSON.stringify([]));
      }

      const result = await addKnownPlateWithMisreads(formData);

      if (result.success) {
        const now = new Date().toISOString();
        
        setData(prevData => {
          const updatedData = prevData.map(plate => {
            if (selectedParentPlate) {
              if (plate.plate_number === selectedParentPlate.plateNumber) {
                const newMisread = {
                  plate_number: activePlate.plate_number,
                  parent_plate_number: selectedParentPlate.plateNumber,
                  occurrence_count: activePlate.occurrence_count || 0,
                  first_seen_at: activePlate.first_seen_at,
                  last_seen_at: formatRelativeTime(now),
                  last_seen_relative: formatRelativeTime(now)
                };

                const parentDate = new Date(plate.first_seen_at);
                const misreadDate = new Date(activePlate.first_seen_at);

                if (misreadDate > parentDate) {
                  return {
                    ...plate,
                    misreads: [...(plate.misreads || []), newMisread],
                    last_seen_at: now,
                    last_seen_relative: formatRelativeTime(now)
                  };
                }

                return {
                  ...plate,
                  misreads: [...(plate.misreads || []), newMisread]
                };
              }

              if (plate.plate_number === activePlate.plate_number) {
                return {
                  ...plate,
                  parent_plate_number: selectedParentPlate.plateNumber,
                  parent_name: selectedParentPlate.name,
                  parent_notes: selectedParentPlate.notes,
                  first_seen_at: plate.first_seen_at,
                  last_seen_at: now,
                  last_seen_relative: formatRelativeTime(now)
                };
              }
            } else {
              if (plate.plate_number === activePlate.plate_number) {
                return {
                  ...plate,
                  name: newKnownPlate.name,
                  notes: newKnownPlate.notes,
                  first_seen_at: plate.first_seen_at,
                  last_seen_at: now,
                  last_seen_relative: formatRelativeTime(now)
                };
              }
            }
            return plate;
          });

          return updatedData;
        });

        toast.success(selectedParentPlate 
          ? `Added ${activePlate.plate_number} as misread of ${selectedParentPlate.plateNumber}`
          : `Added ${activePlate.plate_number} to known plates`
        );
        setIsAddToKnownOpen(false);
        setNewKnownPlate({ name: "", notes: "", tags: [] });
        setSelectedParentPlate(null);

        const knownPlatesResult = await getKnownPlatesList();
        if (knownPlatesResult.success && knownPlatesResult.data?.data) {
          const parentPlates = knownPlatesResult.data.data
            .filter(plate => !plate.parent_plate_number)
            .map(plate => ({
              ...plate,
              plateNumber: plate.plate_number
            }));
          setKnownPlates(parentPlates);
        }
      }
    } catch (error) {
      console.error("Failed to add to known plates:", error);
      toast.error("Failed to add to known plates");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        {/* Left side controls */}
        <div className="flex items-center space-x-2">
          {/* Search */}
          <div className="flex items-center">
            <Search className="text-gray-400 dark:text-gray-500" />
            <Input
              placeholder="Search plates, names, or notes..."
              value={filters.search}
              onChange={handleSearch}
              className="w-64 ml-2"
            />
          </div>

          {/* Tag filter */}
          <div className="flex items-center ml-2">
            <Select value={filters.tag} onValueChange={onUpdateFilters.onTagClick}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {availableTags.map((tag) => (
                  <SelectItem key={tag.name} value={tag.name}>
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date picker */}
          <div className="flex items-center space-x-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {filters.dateFrom && filters.dateTo ? (
                    filters.dateFrom === filters.dateTo ? (
                      format(parseISO(filters.dateFrom), "LLL dd, y")
                    ) : (
                      <>
                        {format(parseISO(filters.dateFrom), "LLL dd, y")} -{" "}
                        {format(parseISO(filters.dateTo), "LLL dd, y")}
                      </>
                    )
                  ) : (
                    <span>Date Range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  initialFocus
                  mode="range"
                  selected={{
                    from: filters.dateFrom ? parseISO(filters.dateFrom) : undefined,
                    to: filters.dateTo ? parseISO(filters.dateTo) : undefined
                  }}
                  onSelect={(range) => {
                    if (!range) {
                      onUpdateFilters.onDateRangeChange(null);
                      return;
                    }
                    onUpdateFilters.onDateRangeChange({
                      from: range.from,
                      to: range.to || range.from
                    });
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            {hasActiveFilters(filters) && (
              <Button
                variant="ghost"
                onClick={onUpdateFilters.onClearFilters}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                <span>Clear all</span>
              </Button>
            )}
          </div>
        </div>

        {/* Right side - Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show</span>
          <Select
            value={pagination.pageSize.toString()}
            onValueChange={pagination.onPageSizeChange}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="rounded-md border dark:border-gray-700">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onUpdateFilters.onSort('plate_number')}
              >
                <div className="flex items-center">
                  Plate Number
                  {getSortIcon('plate_number')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onUpdateFilters.onSort('occurrence_count')}
              >
                <div className="flex items-center">
                  Seen
                  {getSortIcon('occurrence_count')}
                </div>
              </TableHead>
              <TableHead className="w-56 2xl:w-96">Name</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onUpdateFilters.onSort('first_seen_at')}
              >
                <div className="flex items-center">
                  First Seen
                  {getSortIcon('first_seen_at')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onUpdateFilters.onSort('last_seen_at')}
              >
                <div className="flex items-center">
                  Last Seen
                  {getSortIcon('last_seen_at')}
                </div>
              </TableHead>
              <TableHead className="w-[150px]">Tags</TableHead>
              <TableHead className="w-[120px] text-left">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((plate) => (
              <Fragment key={plate.plate_number}>
                <TableRow 
                  className={`border-b transition-colors hover:bg-zinc-200 data-[state=selected]:bg-zinc-200 dark:hover:bg-zinc-800/50 dark:data-[state=selected]:bg-zinc-800/50 ${
                    expandedPlates.has(plate.plate_number) ? 'bg-zinc-200 dark:bg-zinc-800/50' : ''
                  } ${plate.misreads?.some(m => parseInt(m.occurrence_count || '0') > 0) ? 'cursor-pointer' : ''} ${
                    plate.flagged ? "text-[#F31260]" : ""
                  }`}
                  onClick={(e) => plate.misreads?.some(m => parseInt(m.occurrence_count || '0') > 0) && toggleExpand(plate.plate_number, e)}
                >
                  <TableCell className="w-[30px]">
                    {plate.misreads && plate.misreads.some(m => parseInt(m.occurrence_count || '0') > 0) && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-6 w-6 p-0"
                      >
                        {expandedPlates.has(plate.plate_number) ? 
                          <ChevronDownIcon className="h-4 w-4" /> : 
                          <ChevronRightIcon className="h-4 w-4" />
                        }
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    <div className="flex items-center space-x-2">
                      <span 
                        className="cursor-pointer hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenInsights(plate);
                        }}
                      >
                        {plate.plate_number}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {plate.misreads?.length > 0 ? plate.total_occurrence_count : plate.occurrence_count}
                  </TableCell>
                  <TableCell>{plate.parent_name || plate.name}</TableCell>
                  <TableCell>{plate.parent_notes || plate.notes}</TableCell>
                  <TableCell>
                    {typeof plate.first_seen_at === 'string' ? plate.first_seen_at : format(new Date(plate.first_seen_at), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    {plate.last_seen_relative || plate.last_seen_at || ''}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {((plate.parent_tags?.length > 0 ? plate.parent_tags : plate.tags) || []).map((tag) => (
                        <Badge
                          key={`${plate.plate_number}-${tag.name}`}
                          variant="secondary"
                          className="text-xs py-0.5 pl-2 pr-1 flex items-center space-x-1"
                          style={{
                            backgroundColor: tag.color,
                            color: "#fff",
                          }}
                        >
                          <span>{tag.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 p-0 hover:bg-red-500 hover:text-white rounded-full"
                            onClick={() => handleRemoveTag(plate.plate_number, tag.name)}
                          >
                            <X className="h-3 w-3" />
                            <span className="sr-only">Remove {tag.name} tag</span>
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Tag className="h-4 w-4" />
                            <span className="sr-only">Add tag</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {availableTags.map((tag) => (
                            <DropdownMenuItem
                              key={tag.name}
                              onClick={() =>
                                handleAddTag(plate.plate_number, tag.name)
                              }
                            >
                              <div className="flex items-center">
                                <div
                                  className="w-3 h-3 rounded-full mr-2"
                                  style={{ backgroundColor: tag.color }}
                                />
                                {tag.name}
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setActivePlate(plate);
                          setIsAddToKnownOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        <span className="sr-only">Add to known plates</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={
                          plate.flagged ? "text-red-500 hover:text-red-700" : ""
                        }
                        onClick={() =>
                          handleToggleFlag(plate.plate_number, !plate.flagged)
                        }
                      >
                        <Flag
                          className={`h-4 w-4 ${
                            plate.flagged ? "fill-current" : ""
                          }`}
                        />
                        <span className="sr-only">
                          {plate.flagged ? "Remove flag" : "Add flag"}
                        </span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => {
                          setActivePlate(plate);
                          setIsDeleteConfirmOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete record</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>

                {/* Misread Rows */}
                {expandedPlates.has(plate.plate_number) && 
                  [...(plate.misreads || [])]
                    // Filter out misreads with zero occurrences
                    .filter(misread => parseInt(misread.occurrence_count || '0') > 0)
                    // Sort misreads by last_seen_at, most recent first
                    .sort((a, b) => {
                      // Convert relative times back to timestamps for comparison
                      const getTimestamp = (item) => {
                        if (!item.last_seen_at) return 0;
                        if (item.last_seen_at === 'Just now') return Date.now();
                        const match = item.last_seen_at.match(/(\d+)/);
                        if (!match) return 0;
                        const value = parseInt(match[1]);
                        if (item.last_seen_at.includes('minute')) {
                          return Date.now() - (value * 60 * 1000);
                        }
                        if (item.last_seen_at.includes('hour')) {
                          return Date.now() - (value * 60 * 60 * 1000);
                        }
                        if (item.last_seen_at.includes('day')) {
                          return Date.now() - (value * 24 * 60 * 60 * 1000);
                        }
                        return 0;
                      };

                      const timestampA = getTimestamp(a);
                      const timestampB = getTimestamp(b);
                      return timestampB - timestampA;  // Most recent first
                    })
                    .map(misread => (
                      <TableRow 
                        key={misread.plate_number}
                        className="bg-zinc-100 dark:bg-zinc-800"
                      >
                        <TableCell></TableCell>
                        <TableCell className="font-mono">
                          <div className="flex items-center gap-2 pl-6">
                            <ArrowRightIcon className="h-4 w-4 text-muted-foreground" />
                            {misread.plate_number}
                          </div>
                        </TableCell>
                        <TableCell>{misread.occurrence_count || 0}</TableCell>
                        <TableCell>{misread.parent_name || misread.name}</TableCell>
                        <TableCell>{misread.parent_notes || misread.notes}</TableCell>
                        <TableCell>
                          {typeof misread.first_seen_at === 'string' 
                            ? misread.first_seen_at 
                            : format(new Date(misread.first_seen_at), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell>
                          {misread.last_seen_at || ''}
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMisread(misread);
                              setIsDeleteMisreadConfirmOpen(true);
                            }}
                          >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Delete misread</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                }
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isAddToKnownOpen} onOpenChange={setIsAddToKnownOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Known Plates</DialogTitle>
            <DialogDescription>
              Add this plate as a new known plate or as a misread of an existing plate
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="new">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new">New Known Plate</TabsTrigger>
              <TabsTrigger value="existing">Add as Misread</TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newKnownPlate.name}
                    onChange={(e) =>
                      setNewKnownPlate({ ...newKnownPlate, name: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={newKnownPlate.notes}
                    onChange={(e) =>
                      setNewKnownPlate({ ...newKnownPlate, notes: e.target.value })
                    }
                  />
                </div>
                {/* Add tag selection here if needed */}
              </div>
            </TabsContent>

            <TabsContent value="existing" className="space-y-4">
              <div className="grid gap-2">
                <Label>Select Parent Plate</Label>
                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openCombobox}
                      className="justify-between"
                    >
                      {selectedParentPlate
                        ? `${selectedParentPlate.plateNumber} ${
                            selectedParentPlate.name ? `(${selectedParentPlate.name})` : ""
                          }`
                        : "Select a plate..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Search known plates..."
                        onValueChange={(search) => {
                          // Handle search manually if needed
                        }}
                      />
                      <CommandList>
                        <CommandEmpty>No known plate found.</CommandEmpty>
                        <CommandGroup>
                          {knownPlates?.map((plate) => (
                            <CommandItem
                              key={plate.plateNumber}
                              value={plate.plateNumber}
                              onSelect={() => {
                                setSelectedParentPlate(plate);
                                setOpenCombobox(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedParentPlate?.plateNumber === plate.plateNumber
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <span>{plate.plateNumber}</span>
                              {plate.name && (
                                <span className="ml-2 text-muted-foreground">
                                  ({plate.name})
                                </span>
                              )}
                            </CommandItem>
                          ))}
                          {(!knownPlates || knownPlates.length === 0) && (
                            <CommandItem disabled>No known plates found</CommandItem>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddToKnownOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddToKnownPlates}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all records for {activePlate?.plate_number}
              {activePlate?.misreads?.length > 0 ? ` and its misreads` : ''}? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRecord}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteMisreadConfirmOpen} onOpenChange={setIsDeleteMisreadConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all records for misread {activeMisread?.plate_number}? 
              This will remove all occurrences of this misread from the database but keep it in your known plates.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteMisreadConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteMisread}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={isInsightsOpen} onOpenChange={setIsInsightsOpen}>
        <SheetContent
          side="right"
          className="w-[900px] sm:max-w-[900px] lg:max-w-[1200px] overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Insights for {plateInsights?.plateNumber}</SheetTitle>
            <SheetDescription>
              Detailed information about this plate
            </SheetDescription>
          </SheetHeader>
          {plateInsights && (
            <ScrollArea className="h-[calc(100vh-120px)] pr-4">
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Name
                    </h3>
                    <p className="mt-1 text-sm">
                      {plateInsights.knownName || "N/A"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      # Times Seen
                    </h3>
                    <p className="mt-1 text-sm">
                      {plateInsights.summary.totalOccurrences || "N/A"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      First Seen
                    </h3>
                    <p className="mt-1 text-sm">
                      {new Date(
                        plateInsights.summary.firstSeen
                      ).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Last Seen
                    </h3>
                    <p className="mt-1 text-sm">
                      {new Date(
                        plateInsights.summary.lastSeen
                      ).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Notes
                  </h3>
                  <p className="mt-1 text-sm">
                    {plateInsights.notes || "No notes available"}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Tags
                  </h3>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {plateInsights.tags.map((tag) => (
                      <Badge
                        key={tag.name}
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle>Time Distribution</CardTitle>
                    <CardDescription>
                      Frequency of plate sightings by time of day
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={{
                        frequency: {
                          label: "Frequency",
                          color: "hsl(var(--chart-1))",
                        },
                      }}
                    >
                      <BarChart
                        data={plateInsights.timeDistribution.map((item) => ({
                          ...item,
                          timeRange: formatTimeRange(item.timeRange),
                        }))}
                        margin={{
                          top: 20,
                          right: 30,
                          left: 20,
                          bottom: 30,
                        }}
                      >
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="timeRange"
                          tickLine={false}
                          tickMargin={10}
                          axisLine={false}
                          angle={-45}
                          textAnchor="end"
                          height={70}
                        />
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent hideLabel />}
                        />
                        <Bar
                          dataKey="frequency"
                          fill="var(--color-frequency)"
                          radius={4}
                        >
                          <LabelList
                            dataKey="frequency"
                            position="top"
                            className="fill-foreground"
                            fontSize={12}
                          />
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-2 text-sm">
                    <div className="flex gap-2 font-medium leading-none">
                      Most active time:{" "}
                      {formatTimeRange(
                        plateInsights.timeDistribution.reduce((max, current) =>
                          current.frequency > max.frequency ? current : max
                        ).timeRange
                      )}
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div className="leading-none text-muted-foreground">
                      Showing frequency of sightings across 24 hours
                    </div>
                  </CardFooter>
                </Card>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Recent Reads</h3>
                    <Link
                      href={`/live_feed?search=${plateInsights.plateNumber}`}
                      passHref
                    >
                      <Button variant="outline" size="sm" asChild>
                        <span className="flex items-center gap-2">
                          View All
                          <ArrowUpRightIcon className="h-4 w-4" />
                        </span>
                      </Button>
                    </Link>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Vehicle Description</TableHead>
                        <TableHead>Image</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plateInsights.recentReads.map((read, index) => (
                        <TableRow key={index}>
                          <TableCell className="whitespace-nowrap">
                            {formatTimestamp(read.timestamp)}
                          </TableCell>
                          <TableCell>{read.vehicleDescription}</TableCell>
                          <TableCell>
                            <Image
                              src={`data:image/jpeg;base64,${read.imageData}`}
                              alt="Vehicle"
                              className=" object-cover rounded"
                              width={80}
                              height={60}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      <div className="flex items-center justify-between pt-4">
        <div className="text-sm text-muted-foreground">
          {initialData.length > 0 ? (
            <>
              Showing{" "}
              {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total)} to{" "}
              {Math.min(pagination.page * pagination.pageSize, pagination.total)}{" "}
              of {pagination.total} results
            </>
          ) : loading ? (
            "Loading..."
          ) : (
            "No results found"
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={pagination.onPreviousPage}
            disabled={pagination.page <= 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={pagination.onNextPage}
            disabled={pagination.page * pagination.pageSize >= pagination.total}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
