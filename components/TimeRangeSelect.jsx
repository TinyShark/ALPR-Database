import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TimeRangeSelect({ value, onValueChange }) {
  // Generate time options in 30-minute intervals
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute of [0, 30]) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(time);
      }
    }
    return options;
  };

  return (
    <div className="flex items-center justify-center w-full gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">From</span>
        <Select 
          value={value?.from || "any"} 
          onValueChange={(time) => {
            onValueChange({ 
              ...value, 
              from: time === "any" ? null : time 
            });
          }}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="From" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any time</SelectItem>
            {generateTimeOptions().map((time) => (
              <SelectItem key={time} value={time}>
                {time}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">To</span>
        <Select 
          value={value?.to || "any"} 
          onValueChange={(time) => {
            onValueChange({ 
              ...value, 
              to: time === "any" ? null : time 
            });
          }}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="To" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any time</SelectItem>
            {generateTimeOptions().map((time) => (
              <SelectItem key={time} value={time}>
                {time}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
} 