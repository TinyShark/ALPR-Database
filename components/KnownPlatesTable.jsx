"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { Search, Tag, Pencil, X, PlusCircle, ChevronDownIcon, ChevronRightIcon, ArrowRightIcon, MoreVertical, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableColumn,
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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  getPlates,
  getTags,
  addKnownPlate,
  tagPlate,
  untagPlate,
  deletePlate,
  fetchPlateInsights,
  getKnownPlatesList,
  deletePlateFromDB,
  addKnownPlateWithMisreads,
  deleteMisread,
} from "@/app/actions";
import { toast } from "sonner"

export function KnownPlatesTable({ initialData = [] }) {
  const initialDataArray = Array.isArray(initialData) ? initialData : 
                          initialData?.data ? initialData.data : [];
  
  const [data, setData] = useState(initialDataArray);
  const [filteredData, setFilteredData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditPlateOpen, setIsEditPlateOpen] = useState(false);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
  const [activePlate, setActivePlate] = useState(null);
  const [editPlateData, setEditPlateData] = useState({
    name: "",
    notes: "",
    tags: [],
    misreads: []
  });
  const [availableTags, setAvailableTags] = useState([]);
  const [isAddPlateOpen, setIsAddPlateOpen] = useState(false);
  const [newPlateData, setNewPlateData] = useState({
    plateNumber: '',
    name: '',
    notes: '',
    misreads: [],
    tags: [],
  });
  const [expandedPlates, setExpandedPlates] = useState(new Set());
  const [isDeleteMisreadConfirmOpen, setIsDeleteMisreadConfirmOpen] = useState(false);
  const [activeMisread, setActiveMisread] = useState(null);

  useEffect(() => {
    const loadTags = async () => {
      const result = await getTags();
      if (result.success) {
        setAvailableTags(result.data);
      }
    };
    loadTags();
  }, []);

  const groupedData = useMemo(() => {
    if (!Array.isArray(data)) {
      console.log('Data is invalid:', data);
      return [];
    }

    const groups = new Map();
    
    // First, add all parent plates
    data.forEach(plate => {
      if (!plate) return;
      if (!plate.parent_plate_number) {
        groups.set(plate.plate_number, {
          ...plate,
          misreads: []
        });
      }
    });

    // Then, add misreads to their parent plates
    data.forEach(plate => {
      if (!plate) return;
      if (plate.parent_plate_number && groups.has(plate.parent_plate_number)) {
        const parentPlate = groups.get(plate.parent_plate_number);
        parentPlate.misreads.push(plate);
      }
    });

    return Array.from(groups.values());
  }, [data]);

  useEffect(() => {
    setFilteredData(groupedData);
  }, [groupedData]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredData(groupedData);
      return;
    }
    
    const filtered = groupedData.filter(
      (plate) =>
        plate &&
        (plate.plate_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (plate.name &&
            plate.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (plate.notes &&
            plate.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
          plate.misreads.some(misread => 
            misread.plate_number.toLowerCase().includes(searchTerm.toLowerCase())
          ))
    );
    setFilteredData(filtered);
  }, [groupedData, searchTerm]);

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
              return {
                ...plate,
                tags: [...(plate.tags || []), tagName], // Note: just adding the tagName since that's our data structure
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
                tags: (plate.tags || []).filter((tag) => tag !== tagName), // Note: comparing tagName strings
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

  const checkForDuplicatePlate = (plateNumber, data) => {
    // Check if plate exists as a parent plate or misread
    const exists = data.some(plate => {
      if (plate.plate_number === plateNumber) return true;
      return plate.misreads?.some(misread => misread.plate_number === plateNumber);
    });
    return exists;
  };

  const handleAddNewPlate = async () => {
    try {
      // Validate plate number
      if (!newPlateData.plateNumber) {
        toast.error("Please enter a plate number");
        return;
      }

      // Check for duplicates
      if (checkForDuplicatePlate(newPlateData.plateNumber, data)) {
        toast.error(`Plate ${newPlateData.plateNumber} already exists as a known plate or misread`);
        return;
      }

      // Validate misreads
      const validMisreads = newPlateData.misreads.filter(misread => misread.trim() !== '');
      
      // Check for duplicate misreads
      const uniqueMisreads = new Set(validMisreads);
      if (uniqueMisreads.size !== validMisreads.length) {
        toast.error("Duplicate misreads are not allowed");
        return;
      }

      // Check if any misread matches existing plates
      for (const misread of validMisreads) {
        if (checkForDuplicatePlate(misread, data)) {
          toast.error(`Misread ${misread} already exists as a known plate or misread`);
          return;
        }
      }

      const formData = new FormData();
      formData.append('plateNumber', newPlateData.plateNumber);
      formData.append('name', newPlateData.name || '');
      formData.append('notes', newPlateData.notes || '');
      formData.append('misreads', JSON.stringify(validMisreads));

      // First create the plate
      const result = await addKnownPlateWithMisreads(formData);

      if (result.success) {
        // Then add each tag
        for (const tagName of newPlateData.tags) {
          const tagFormData = new FormData();
          tagFormData.append("plateNumber", newPlateData.plateNumber);
          tagFormData.append("tagName", tagName);
          await tagPlate(tagFormData);
        }

        // Fetch fresh data
        const response = await getKnownPlatesList();
        
        if (response.success) {
          const newData = Array.isArray(response.data) ? response.data : 
                         response?.data?.data ? response.data.data : [];
          setData(newData);
        }
        
        setIsAddPlateOpen(false);
        setNewPlateData({ plateNumber: '', name: '', notes: '', misreads: [], tags: [] });
        toast.success("Known Plate added successfully");
      } else {
        toast.error(result.error || "Failed to add plate");
      }
    } catch (error) {
      console.error('Failed to add known plate:', error);
      toast.error("Failed to add plate");
    }
  };

  const handleAddMisread = () => {
    setNewPlateData(prev => ({
      ...prev,
      misreads: [...prev.misreads, '']
    }));
  };

  const toggleExpand = (plateNumber, e) => {
    // Prevent event bubbling
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

  const handleDeleteMisread = async () => {
    if (!activeMisread) return;
    try {
      const formData = new FormData();
      formData.append("plateNumber", activeMisread.plate_number);

      const result = await deleteMisread(formData);
      if (result.success) {
        // Update the data state to remove the misread
        setData((prevData) =>
          prevData.filter((plate) => plate.plate_number !== activeMisread.plate_number)
        );
        setIsDeleteMisreadConfirmOpen(false);
        toast.success(`Known Misread ${activeMisread.plate_number} removed successfully`);
      } else {
        toast.error(result.error || "Failed to remove misread");
      }
    } catch (error) {
      console.error("Failed to delete misread:", error);
      toast.error("Failed to delete misread");
    }
  };

  useEffect(() => {
  }, [expandedPlates]);

  const handleEditPlate = async () => {
    if (!activePlate) return;
    try {
      // Validate misreads
      const validMisreads = editPlateData.misreads.filter(misread => misread.trim() !== '');
      
      // Check for duplicate misreads
      const uniqueMisreads = new Set(validMisreads);
      if (uniqueMisreads.size !== validMisreads.length) {
        toast.error("Duplicate misreads are not allowed");
        return;
      }

      // Check if any misread matches existing plates
      for (const misread of validMisreads) {
        if (misread === activePlate.plate_number) {
          toast.error("A misread cannot be the same as the plate number");
          return;
        }

        const isExistingPlate = checkForDuplicatePlate(misread, data.filter(p => 
          p.plate_number !== activePlate.plate_number && 
          !activePlate.misreads.some(m => m.plate_number === p.plate_number)
        ));

        if (isExistingPlate) {
          toast.error(`Misread ${misread} already exists as a known plate or misread`);
          return;
        }
      }

      const formData = new FormData();
      formData.append("plateNumber", activePlate.plate_number);
      formData.append("name", editPlateData.name || '');
      formData.append("notes", editPlateData.notes || '');
      formData.append('misreads', JSON.stringify(validMisreads));

      // First update the plate details
      const result = await addKnownPlateWithMisreads(formData);
      
      if (result.success) {
        // Handle misreads: remove any misreads that are no longer in the list
        const currentMisreads = activePlate.misreads.map(m => m.plate_number);
        const misreadsToRemove = currentMisreads.filter(m => !validMisreads.includes(m));
        
        for (const misread of misreadsToRemove) {
          const removeMisreadFormData = new FormData();
          removeMisreadFormData.append("plateNumber", misread);
          await deleteMisread(removeMisreadFormData);
        }

        // Handle tags: first remove all existing tags
        for (const oldTag of activePlate.tags || []) {
          const removeTagFormData = new FormData();
          removeTagFormData.append("plateNumber", activePlate.plate_number);
          removeTagFormData.append("tagName", oldTag);
          await untagPlate(removeTagFormData);
        }

        // Then add new tags
        for (const tagName of editPlateData.tags) {
          const tagFormData = new FormData();
          tagFormData.append("plateNumber", activePlate.plate_number);
          tagFormData.append("tagName", tagName);
          await tagPlate(tagFormData);
        }

        // Fetch fresh data to update the UI
        const response = await getKnownPlatesList();
        if (response.success) {
          const newData = Array.isArray(response.data) ? response.data : 
                         response?.data?.data ? response.data.data : [];
          setData(newData);
        }

        setIsEditPlateOpen(false);
        setEditPlateData({ name: "", notes: "", tags: [], misreads: [] });
        toast.success("Known Plate updated successfully");
      } else {
        toast.error(result.error || "Failed to update plate");
      }
    } catch (error) {
      console.error("Failed to update known plate:", error);
      toast.error("Failed to update plate");
    }
  };

  const handleRemoveFromKnown = async () => {
    if (!activePlate) return;
    try {
      const formData = new FormData();
      formData.append("plateNumber", activePlate.plate_number);

      const result = await deletePlate(formData);
      if (result.success) {
        setData((prevData) =>
          prevData.filter(
            (plate) => plate.plate_number !== activePlate.plate_number
          )
        );
        setIsRemoveConfirmOpen(false);
        toast.success(`Known Plate ${activePlate.plate_number} removed successfully`);
      } else {
        toast.error(result.error || "Failed to remove plate");
      }
    } catch (error) {
      console.error("Failed to remove from known plates:", error);
      toast.error("Failed to remove plate");
    }
  };

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <Search className="text-gray-400 dark:text-gray-500" />
            <Input
              placeholder="Search known plates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
              className="w-64 ml-2"
            />
          </div>
          <Button
            onClick={() => setIsAddPlateOpen(true)}
            className="flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Add Known Plate
          </Button>
        </div>
        
        <Dialog 
          open={isAddPlateOpen} 
          onOpenChange={(open) => {
            if (!open) {
              // Reset form data when closing
              setNewPlateData({ 
                plateNumber: '', 
                name: '', 
                notes: '', 
                misreads: [], 
                tags: [] 
              });
            }
            setIsAddPlateOpen(open);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Known Plate</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Plate Number"
                  value={newPlateData.plateNumber}
                  onChange={(e) => setNewPlateData(prev => ({
                    ...prev, 
                    plateNumber: e.target.value.toUpperCase()
                  }))}
                />
                <Input
                  placeholder="Name"
                  value={newPlateData.name}
                  onChange={(e) => setNewPlateData(prev => ({...prev, name: e.target.value}))}
                />
              </div>
              <Textarea
                placeholder="Notes"
                value={newPlateData.notes}
                onChange={(e) => setNewPlateData(prev => ({...prev, notes: e.target.value}))}
              />
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {newPlateData.tags.map((tagName) => {
                    const tagInfo = availableTags.find(t => t.name === tagName);
                    if (!tagInfo) return null;

                    return (
                      <Badge
                        key={tagName}
                        variant="secondary"
                        className="text-xs py-0.5 pl-2 pr-1 flex items-center space-x-1"
                        style={{
                          backgroundColor: tagInfo.color,
                          color: "#fff",
                        }}
                      >
                        <span>{tagName}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0 hover:bg-red-500 hover:text-white rounded-full"
                          onClick={() => setNewPlateData(prev => ({
                            ...prev,
                            tags: prev.tags.filter(t => t !== tagName)
                          }))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    );
                  })}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Tag className="h-4 w-4 mr-2" />
                        Add Tag
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {availableTags
                        .filter(tag => !newPlateData.tags.includes(tag.name))
                        .map((tag) => (
                          <DropdownMenuItem
                            key={tag.name}
                            onClick={() => setNewPlateData(prev => ({
                              ...prev,
                              tags: [...prev.tags, tag.name]
                            }))}
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
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Common Misreads</label>
                {newPlateData.misreads.map((misread, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Misread plate number"
                      value={misread}
                      onChange={(e) => {
                        const newMisreads = [...newPlateData.misreads];
                        newMisreads[index] = e.target.value.toUpperCase();
                        setNewPlateData(prev => ({...prev, misreads: newMisreads}));
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => {
                        const newMisreads = newPlateData.misreads.filter((_, i) => i !== index);
                        setNewPlateData(prev => ({...prev, misreads: newMisreads}));
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddMisread}
                  className="w-full"
                >
                  Add Misread
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddNewPlate}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <div className="space-y-4">
          <div className="rounded-md border dark:border-gray-700">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[150px]">Plate Number</TableHead>
                  <TableHead className="w-[150px]">Name</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[120px]">Added On</TableHead>
                  <TableHead className="w-[150px]">Tags</TableHead>
                  <TableHead className="w-[120px] text-left">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((plate) => (
                  <Fragment key={plate.plate_number}>
                    <TableRow 
                      key={plate.plate_number}
                      className={`border-b transition-colors hover:bg-zinc-200 data-[state=selected]:bg-zinc-200 dark:hover:bg-zinc-800/50 dark:data-[state=selected]:bg-zinc-800/50 ${
                        expandedPlates.has(plate.plate_number) ? 'bg-zinc-200 dark:bg-zinc-800/50' : ''
                      } ${plate.misreads.length > 0 ? 'cursor-pointer' : ''}`}
                      onClick={(e) => plate.misreads.length > 0 && toggleExpand(plate.plate_number, e)}
                    >
                      <TableCell className="pl-4 w-[40px]">
                        {plate.misreads.length > 0 && (
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
                      <TableCell className="font-mono text-lg font-medium">
                        {plate.plate_number}
                      </TableCell>
                      <TableCell>{plate.name}</TableCell>
                      <TableCell>{plate.notes}</TableCell>
                      <TableCell>
                        {new Date(plate.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {plate.tags?.length > 0 ? (
                            plate.tags.map((tagName) => {
                              const tagInfo = availableTags.find(
                                (t) => t.name === tagName
                              );
                              if (!tagInfo) return null;

                              return (
                                <Badge
                                  key={`${plate.plate_number}-${tagName}`}
                                  variant="secondary"
                                  className="text-xs py-0.5 pl-2 pr-1 flex items-center space-x-1"
                                  style={{
                                    backgroundColor: tagInfo.color,
                                    color: "#fff",
                                  }}
                                >
                                  <span>{tagName}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 p-0 hover:bg-red-500 hover:text-white rounded-full"
                                    onClick={() =>
                                      handleRemoveTag(plate.plate_number, tagName)
                                    }
                                  >
                                    <X className="h-3 w-3" />
                                    <span className="sr-only">
                                      Remove {tagName} tag
                                    </span>
                                  </Button>
                                </Badge>
                              );
                            })
                          ) : (
                            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                              No tags
                            </div>
                          )}
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
                              setEditPlateData({
                                name: plate.name || "",
                                notes: plate.notes || "",
                                tags: plate.tags || [],
                                misreads: plate.misreads?.map(m => m.plate_number) || []
                              });
                              setIsEditPlateOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit plate details</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => {
                              setActivePlate(plate);
                              setIsRemoveConfirmOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">
                              Remove from known plates
                            </span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Misread Rows */}
                    {expandedPlates.has(plate.plate_number) && plate.misreads.map(misread => (
                      <TableRow 
                        key={misread.plate_number}
                        className="bg-zinc-100 dark:bg-zinc-800"
                      >
                        <TableCell className="pl-4"></TableCell>
                        <TableCell className="font-mono text-m font-medium">
                          <div className="flex items-center gap-2">
                            <ArrowRightIcon className="h-4 w-4 text-default-400" />
                            {misread.plate_number}
                          </div>
                        </TableCell>
                        <TableCell colSpan={3}>
                          <span className="text-default-400">Misread of {plate.plate_number}</span>
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => {
                              setActiveMisread(misread);
                              setIsDeleteMisreadConfirmOpen(true);
                            }}
                          >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Remove misread</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          <Dialog open={isEditPlateOpen} onOpenChange={setIsEditPlateOpen}>
            <DialogContent className="max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Edit Known Plate</DialogTitle>
                <DialogDescription>
                  Update details for the plate {activePlate?.plate_number}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                <div className="space-y-2 pl-[1px]">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={editPlateData.name}
                    onChange={(e) => setEditPlateData(prev => ({...prev, name: e.target.value}))}
                  />
                </div>
                
                <div className="space-y-2 pl-[1px]">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={editPlateData.notes}
                    onChange={(e) => setEditPlateData(prev => ({...prev, notes: e.target.value}))}
                  />
                </div>

                <div className="space-y-2 pl-[1px]">
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {editPlateData.tags.map((tagName) => {
                      const tagInfo = availableTags.find(t => t.name === tagName);
                      if (!tagInfo) return null;
                      return (
                        <Badge
                          key={tagName}
                          variant="secondary"
                          className="text-xs py-0.5 pl-2 pr-1 flex items-center space-x-1"
                          style={{
                            backgroundColor: tagInfo.color,
                            color: "#fff",
                          }}
                        >
                          <span>{tagName}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 p-0 hover:bg-red-500 hover:text-white rounded-full"
                            onClick={() => setEditPlateData(prev => ({
                              ...prev,
                              tags: prev.tags.filter(t => t !== tagName)
                            }))}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      );
                    })}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Tag className="h-4 w-4 mr-2" />
                          Add Tag
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {availableTags
                          .filter(tag => !editPlateData.tags.includes(tag.name))
                          .map((tag) => (
                            <DropdownMenuItem
                              key={tag.name}
                              onClick={() => setEditPlateData(prev => ({
                                ...prev,
                                tags: [...prev.tags, tag.name]
                              }))}
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
                  </div>
                </div>

                <div className="space-y-2 pl-[1px]">
                  <Label>Common Misreads</Label>
                  {editPlateData.misreads.map((misread, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Misread plate number"
                        value={misread}
                        onChange={(e) => {
                          const newMisreads = [...editPlateData.misreads];
                          newMisreads[index] = e.target.value.toUpperCase();
                          setEditPlateData(prev => ({...prev, misreads: newMisreads}));
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => {
                          const newMisreads = editPlateData.misreads.filter((_, i) => i !== index);
                          setEditPlateData(prev => ({...prev, misreads: newMisreads}));
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditPlateData(prev => ({
                      ...prev,
                      misreads: [...prev.misreads, '']
                    }))}
                    className="w-full"
                  >
                    Add Misread
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleEditPlate}>Update Plate Details</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isRemoveConfirmOpen}
            onOpenChange={setIsRemoveConfirmOpen}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Remove from Known Plates</DialogTitle>
                <DialogDescription>
                  Are you sure you want to remove {activePlate?.plate_number}{" "}
                  from known plates? This action can be undone by adding the
                  plate back to known plates later.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsRemoveConfirmOpen(false)}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleRemoveFromKnown}>
                  Remove
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isDeleteMisreadConfirmOpen} onOpenChange={setIsDeleteMisreadConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Remove Misread</DialogTitle>
                <DialogDescription>
                  Are you sure you want to remove {activeMisread?.plate_number} from known misreads? 
                  This will only remove it from the known misreads list and won't affect any plate reads in the database.
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
                  Remove
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
