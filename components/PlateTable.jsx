"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Search,
  Filter,
  Tag,
  Plus,
  Trash2,
  X,
  CalendarDays,
  HelpCircle,
  Edit,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function PlateTable({
  data,
  loading,
  availableTags,
  pagination,
  filters,
  onUpdateFilters,
  onAddTag,
  onRemoveTag,
  onAddKnownPlate,
  onDeleteRecord,
  availableCameras,
  onCorrectPlate,
}) {
  // Only keep state for modals and temporary form data
  const [isAddKnownPlateOpen, setIsAddKnownPlateOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [activePlate, setActivePlate] = useState(null);
  const [newKnownPlate, setNewKnownPlate] = useState({ name: "", notes: "" });
  const [correction, setCorrection] = useState(null);
  const [isCorrectPlateOpen, setIsCorrectPlateOpen] = useState(false);

  // Helper functions
  const getImageUrl = (base64Data) => {
    if (!base64Data) return "/placeholder-image.jpg";
    if (base64Data.startsWith("data:image/jpeg;base64,")) return base64Data;
    return `data:image/jpeg;base64,${base64Data}`;
  };

  const handleImageClick = (e, plate) => {
    e.preventDefault();
    if (!plate.image_data) return;
    const win = window.open();
    if (win) {
      win.document.write(`
        <html>
          <head><title>License Plate Image - ${
            plate.plate_number
          }</title></head>
          <body style="margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #000;">
            <img src="${getImageUrl(plate.image_data)}" 
                 style="max-width: 100%; max-height: 100vh; object-fit: contain;" 
                 alt="${plate.plate_number}" />
          </body>
        </html>
      `);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value.toUpperCase();
    // Get the cursor position before updating
    const cursorPosition = e.target.selectionStart;
    onUpdateFilters({ search: value });
    // After state update, restore cursor position
    setTimeout(() => {
      e.target.setSelectionRange(cursorPosition, cursorPosition);
    }, 0);
  };

  const handleFuzzySearchToggle = (checked) => {
    onUpdateFilters({ fuzzySearch: checked });
  };

  const handleTagChange = (value) => {
    onUpdateFilters({ tag: value });
  };

  const handleCameraChange = (value) => {
    onUpdateFilters({ camera: value === "all" ? "" : value });
  };

  const handleDateRangeSelect = (range) => {
    onUpdateFilters({
      dateFrom: range.from ? format(range.from, "yyyy-MM-dd") : null,
      dateTo: range.to ? format(range.to, "yyyy-MM-dd") : null,
    });
  };

  const handlePageSizeChange = (value) => {
    onUpdateFilters({ pageSize: value });
  };

  const handleAddKnownPlateSubmit = async () => {
    if (!activePlate) return;
    await onAddKnownPlate(
      activePlate.plate_number,
      newKnownPlate.name,
      newKnownPlate.notes
    );
    setIsAddKnownPlateOpen(false);
    setNewKnownPlate({ name: "", notes: "" });
  };

  const handleDeleteSubmit = async () => {
    if (!activePlate) return;
    const formData = new FormData();
    formData.append("readId", activePlate.id);
    formData.append("plateNumber", activePlate.plate_number);

    const result = await onDeleteRecord(formData);
    if (result.success) {
      setIsDeleteConfirmOpen(false);
      toast.success("Plate read deleted successfully");
    } else {
      toast.error("Failed to delete plate read");
    }
  };

  const handleCorrectSubmit = async () => {
    if (!correction) return;

    const formData = new FormData();
    formData.append("readId", correction.id);
    formData.append("oldPlateNumber", correction.plateNumber);
    formData.append("newPlateNumber", correction.newPlateNumber);
    formData.append("correctAll", correction.correctAll.toString());
    formData.append("removePrevious", correction.removePlate.toString());

    await onCorrectPlate(formData);
    setCorrection(null);
    setIsCorrectPlateOpen(false);
  };

  const clearFilters = () => {
    onUpdateFilters({
      search: "",
      tag: "all",
      dateFrom: null,
      dateTo: null,
    });
  };

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
          <div className="flex items-center justify-start space-x-2">
            <div className="flex items-center space-x-2">
              <Search className="text-gray-400 dark:text-gray-500" />
              <Input
                placeholder="Search plates..."
                value={filters.search}
                onChange={handleSearchChange}
                className="w-64"
              />
              <div className="flex items-center border rounded-md px-3 py-2 bg-background">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={filters.fuzzySearch}
                    onCheckedChange={handleFuzzySearchToggle}
                    id="fuzzy-search"
                  />
                  <label
                    htmlFor="fuzzy-search"
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    Fuzzy Search
                  </label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Fuzzy search helps find plates with potential OCR
                          misreads. For example, searching for
                          &ldquo;7MLG803&rdquo; will also find similar plates
                          like &ldquo;7NLG803&rdquo; or &ldquo;7ML6803&rdquo;.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
            <Select value={filters.tag} onValueChange={handleTagChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
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
            <Select
              value={filters.cameraName || "all"}
              onValueChange={handleCameraChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by camera" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cameras</SelectItem>
                {availableCameras.map((camera) => (
                  <SelectItem key={camera} value={camera}>
                    {camera}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {filters.dateRange.from ? (
                    filters.dateRange.to ? (
                      <>
                        {format(filters.dateRange.from, "LLL dd")} -{" "}
                        {format(filters.dateRange.to, "LLL dd")}
                      </>
                    ) : (
                      format(filters.dateRange.from, "LLL dd")
                    )
                  ) : (
                    "Date Range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  selected={{
                    from: filters.dateRange.from,
                    to: filters.dateRange.to,
                  }}
                  onSelect={handleDateRangeSelect}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            {(filters.search ||
              filters.tag !== "all" ||
              filters.dateRange.from) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Show</span>
            <Select
              value={pagination.pageSize.toString()}
              onValueChange={handlePageSizeChange}
            >
              <SelectTrigger className="w-[80px]">
                <SelectValue>{pagination.pageSize}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">per page</span>
          </div>
        </div>

        <div className="rounded-md border dark:border-gray-700">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Plate Number</TableHead>
                {/* <TableHead>Vehicle Description</TableHead> */}
                <TableHead>Occurrences</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Camera</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4">
                    No results found
                  </TableCell>
                </TableRow>
              ) : (
                data.map((plate) => (
                  <TableRow key={plate.id}>
                    <TableCell>
                      <a
                        href={getImageUrl(plate.image_data)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cursor-pointer"
                        onClick={(e) => handleImageClick(e, plate)}
                      >
                        <Image
                          src={getImageUrl(plate.image_data)}
                          alt={plate.plate_number}
                          width={100}
                          height={75}
                          className="rounded hover:opacity-80 transition-opacity"
                        />
                      </a>
                    </TableCell>
                    <TableCell
                      className={`font-medium font-mono ${
                        plate.flagged && "text-[#F31260]"
                      }`}
                    >
                      {plate.knownPlate ? (
                        <>
                          <div>{plate.knownPlate}</div>
                          {plate.plate_number !== plate.knownPlate && (
                            <div className="text-sm text-red-500 font-sans">
                              Actual read: {plate.plate_number}
                            </div>
                          )}
                        </>
                      ) : (
                        plate.plate_number
                      )}
                      {(plate.parent_known_name || plate.known_name) && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 font-sans">
                          {plate.parent_known_name || plate.known_name}
                        </div>
                      )}
                    </TableCell>
                    {/* <TableCell>{plate.vehicle_description}</TableCell> */}
                    <TableCell>{plate.occurrence_count}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(plate.parent_tags?.length > 0 || plate.tags?.length > 0) ? (
                          (plate.parent_tags || plate.tags).map((tag) => (
                            <Badge
                              key={tag.name}
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
                                onClick={() =>
                                  onRemoveTag(plate.plate_number, tag.name)
                                }
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))
                        ) : (
                          <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                            No tags
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {plate.camera_name || (
                        <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                          Unknown
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(plate.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Tag className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {availableTags.map((tag) => (
                              <DropdownMenuItem
                                key={tag.name}
                                onClick={() =>
                                  onAddTag(plate.plate_number, tag.name)
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
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className=""
                          onClick={() => {
                            setCorrection({
                              id: plate.id,
                              plateNumber: plate.plate_number,
                              newPlateNumber: plate.plate_number,
                              correctAll: false,
                              removePlate: false,
                            });
                            setIsCorrectPlateOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
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
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)}{" "}
            of {pagination.total} results
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
              disabled={
                pagination.page * pagination.pageSize >= pagination.total
              }
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>

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
            <Button type="submit" onClick={handleAddKnownPlateSubmit}>
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
              Are you sure you want to delete this record? This will not delete
              the plate from the known plates table.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSubmit}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={correction !== null}
        onOpenChange={(open) => !open && setCorrection(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correct Plate Number</DialogTitle>
            <DialogDescription>
              Update the incorrect plate number recognition.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="current-plate" className="text-right">
                Current
              </Label>
              <Input
                id="current-plate"
                value={correction?.plateNumber || ""}
                disabled
                className="col-span-3 font-mono"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-plate" className="text-right">
                New
              </Label>
              <Input
                id="new-plate"
                value={correction?.newPlateNumber || ""}
                onChange={(e) =>
                  setCorrection((curr) => ({
                    ...curr,
                    newPlateNumber: e.target.value.toUpperCase(),
                  }))
                }
                className="col-span-3 font-mono"
                placeholder="ENTER NEW PLATE NUMBER"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="correct-all"
                checked={correction?.correctAll || false}
                onCheckedChange={(checked) =>
                  setCorrection((curr) => ({
                    ...curr,
                    correctAll: checked,
                  }))
                }
              />
              <Label htmlFor="correct-all">
                Correct all occurrences of this plate number
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="remove-plate"
                checked={correction?.removePlate || false}
                onCheckedChange={(checked) =>
                  setCorrection((curr) => ({
                    ...curr,
                    removePlate: checked,
                  }))
                }
              />
              <Label htmlFor="remove-plate">
                Remove previous plate number from database
              </Label>
            </div>
            {correction?.removePlate && (
              <div className="text-sm text-amber-500 dark:text-amber-400">
                Warning: This is a destructive action. Ensure the previous plate
                number does not belong to any real vehicles to avoid loss of
                data.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrection(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleCorrectSubmit}
              disabled={
                !correction?.newPlateNumber ||
                correction.newPlateNumber === correction.plateNumber
              }
            >
              Update Plate Number
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
