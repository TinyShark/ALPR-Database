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
} from "@/app/actions";
import Image from "next/image";
import Link from "next/link";
import { format, parseISO } from "date-fns";

const formatDaysAgo = (days) => {
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days >= 15) return "15+ days ago";
  return `${days} days ago`;
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

export default function PlateDbTable({ 
  initialData = [], 
  loading = false,
  filters,
  sort,
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
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddKnownPlateOpen, setIsAddKnownPlateOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [activePlate, setActivePlate] = useState(null);
  const [newKnownPlate, setNewKnownPlate] = useState({ name: "", notes: "" });
  const [availableTags, setAvailableTags] = useState([]);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [plateInsights, setPlateInsights] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: "last_seen_at", // default sort by last seen
    direction: "desc", // default newest first
  });
  const [expandedPlates, setExpandedPlates] = useState(new Set());

  useEffect(() => {
    setData(initialData);
    setFilteredData(initialData);
  }, [initialData]);

  useEffect(() => {
    const filtered = data.filter((plate) => {
      // Search filter
      const matchesSearch = searchTerm === "" || Boolean(
        plate.plate_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plate.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plate.notes?.toLowerCase().includes(searchTerm.toLowerCase())
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
  }, [data, searchTerm, filters.tag, filters.dateRange]);

  const requestSort = (key) => {
    setSortConfig((prevConfig) => ({
      key,
      direction:
        prevConfig.key === key && prevConfig.direction === "asc"
          ? "desc"
          : "asc",
    }));
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <ChevronsUpDown className="ml-2 h-2 w-2" />;
    }
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="ml-2 h-2 w-2" />
    ) : (
      <ChevronDown className="ml-2 h-2 w-2" />
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
      }
    } catch (error) {
      console.error("Failed to add known plate:", error);
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
      }
    } catch (error) {
      console.error("Failed to delete record:", error);
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
      }
    } catch (error) {
      console.error("Failed to toggle plate flag:", error);
    }
  };

  const groupedData = useMemo(() => {
    if (!Array.isArray(data)) {
      console.log('Data is invalid:', data);
      return [];
    }

    const groups = new Map();
    
    // First, add all parent plates and plates without parents
    data.forEach(plate => {
      if (!plate) return;
      
      // If this plate has a parent_plate_number, it's a misread - skip it for now
      if (plate.parent_plate_number) {
        return;
      }

      // Add the plate as a potential parent
      groups.set(plate.plate_number, {
        ...plate,
        misreads: [],
        total_occurrence_count: parseInt(plate.occurrence_count || 0),
        // Preserve any known plate data that might exist
        name: plate.parent_name || plate.name,
        notes: plate.parent_notes || plate.notes,
        tags: plate.parent_tags || plate.tags
      });
    });

    // Then, add misreads to their parent plates
    data.forEach(plate => {
      if (!plate || !plate.parent_plate_number) return;

      // If the parent exists in our current data, add the misread to it
      if (groups.has(plate.parent_plate_number)) {
        const parentPlate = groups.get(plate.parent_plate_number);
        parentPlate.misreads.push(plate);
        parentPlate.total_occurrence_count += parseInt(plate.occurrence_count || 0);
      } else {
        // If the parent doesn't exist in our current data but is a known plate,
        // create a new group for it
        groups.set(plate.parent_plate_number, {
          plate_number: plate.parent_plate_number,
          name: plate.parent_name,
          notes: plate.parent_notes,
          tags: plate.parent_tags || [],
          misreads: [plate],
          total_occurrence_count: parseInt(plate.occurrence_count || 0),
          first_seen_at: plate.first_seen_at,
          days_since_last_seen: plate.days_since_last_seen
        });
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
    setSearchTerm(e.target.value);
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
    console.log("Starting filtering with data:", data);

    const filtered = data.filter((plate) => {
      // Skip plates that are misreads in the initial filter
      if (plate.parent_plate_number) {
        console.log("Skipping misread in initial filter:", plate.plate_number, "parent:", plate.parent_plate_number);
        return false;
      }

      // Search filter - check plate and its misreads
      const matchesSearch = searchTerm === "" || Boolean(
        plate.plate_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plate.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plate.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        data.some(misread => 
          misread.parent_plate_number === plate.plate_number &&
          misread.plate_number.toLowerCase().includes(searchTerm.toLowerCase())
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

      console.log("Filtering plate:", plate.plate_number, {
        matchesSearch,
        matchesTag,
        matchesDate
      });

      return matchesSearch && matchesTag && matchesDate;
    });

    console.log("After filtering, parent plates:", filtered);

    // After filtering, group the data
    const groups = new Map();
    
    // First, add all filtered parent plates with their existing misreads
    filtered.forEach(plate => {
      if (!plate) return;
      
      console.log("Adding parent plate to groups with data:", {
        plate_number: plate.plate_number,
        parent_count: parseInt(plate.occurrence_count || 0),
        misreads: plate.misreads
      });

      const misreadsTotal = plate.misreads?.reduce((sum, misread) => 
        sum + parseInt(misread.occurrence_count || 0), 0) || 0;

      console.log("Calculated totals:", {
        plate_number: plate.plate_number,
        parent_count: parseInt(plate.occurrence_count || 0),
        misreads_total: misreadsTotal,
        total: parseInt(plate.occurrence_count || 0)
      });

      groups.set(plate.plate_number, {
        ...plate,
        misreads: plate.misreads || [],
        total_occurrence_count: parseInt(plate.occurrence_count || 0)
      });
    });

    const groupedData = Array.from(groups.values());
    console.log("Final grouped data:", groupedData);
    setFilteredData(groupedData);
  }, [data, searchTerm, filters.tag, filters.dateRange]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Search className="text-gray-400 dark:text-gray-500" />
          <Input
            placeholder="Search plates, names, or notes..."
            value={searchTerm}
            onChange={handleSearch}
            className="w-64"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="text-gray-400 dark:text-gray-500" />
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
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal">
                <Calendar className="mr-2 h-4 w-4" />
                {filters.dateFrom && filters.dateTo ? (
                  <>
                    {format(parseISO(filters.dateFrom), "LLL dd, y")} -{" "}
                    {format(parseISO(filters.dateTo), "LLL dd, y")}
                  </>
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
                  console.log("Date selected:", range); // Debug log
                  if (!range?.from || !range?.to) {
                    console.log("Missing from or to date"); // Debug log
                    return;
                  }
                  console.log("Calling onDateRangeChange with:", range); // Debug log
                  onUpdateFilters.onDateRangeChange({
                    from: range.from,
                    to: range.to
                  });
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          {(filters.dateFrom || filters.dateTo) && (
            <Button
              variant="ghost"
              onClick={() => onUpdateFilters.onDateRangeChange(null)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear date range</span>
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between">
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
                className="cursor-pointer"
                onClick={() => onUpdateFilters.onSort('plate_number')}
              >
                Plate Number {getSortIcon('plate_number')}
              </TableHead>
              <TableHead 
                className="cursor-pointer"
                onClick={() => onUpdateFilters.onSort('occurrence_count')}
              >
                Seen {getSortIcon('occurrence_count')}
              </TableHead>
              <TableHead className="w-56 2xl:w-96">Name</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead 
                className="cursor-pointer"
                onClick={() => onUpdateFilters.onSort('first_seen_at')}
              >
                First Seen {getSortIcon('first_seen_at')}
              </TableHead>
              <TableHead 
                className="cursor-pointer"
                onClick={() => onUpdateFilters.onSort('last_seen_at')}
              >
                Last Seen {getSortIcon('last_seen_at')}
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
                  } ${plate.misreads?.length > 0 ? 'cursor-pointer' : ''} ${
                    plate.flagged ? "text-[#F31260]" : ""
                  }`}
                  onClick={(e) => plate.misreads?.length > 0 && toggleExpand(plate.plate_number, e)}
                >
                  <TableCell className="w-[30px]">
                    {plate.misreads?.length > 0 && (
                      expandedPlates.has(plate.plate_number) ? 
                        <ChevronDownIcon className="h-4 w-4" /> : 
                        <ChevronRightIcon className="h-4 w-4" />
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
                    {new Date(plate.first_seen_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {formatDaysAgo(plate.days_since_last_seen)}
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
                          setIsAddKnownPlateOpen(true);
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

                {/* Misread Rows - simplified with only delete button */}
                {expandedPlates.has(plate.plate_number) && plate.misreads?.map(misread => (
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
                      {new Date(misread.first_seen_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {formatDaysAgo(misread.days_since_last_seen)}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleDeleteMisread(misread.plate_number)}
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Delete misread</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isAddKnownPlateOpen} onOpenChange={setIsAddKnownPlateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Known Plates</DialogTitle>
            <DialogDescription>
              Add details for the plate {activePlate?.plate_number}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newKnownPlate.name}
                onChange={(e) =>
                  setNewKnownPlate({ ...newKnownPlate, name: e.target.value })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={newKnownPlate.notes}
                onChange={(e) =>
                  setNewKnownPlate({ ...newKnownPlate, notes: e.target.value })
                }
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleAddKnownPlate}>
              Add to Known Plates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this record? This action cannot be
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
