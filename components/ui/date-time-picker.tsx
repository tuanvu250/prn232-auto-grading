"use client";

import { useMemo, useState } from "react";
import { format, startOfDay } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarDays, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DateTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  min?: Date;
  disabled?: boolean;
  className?: string;
};

function parseLocalDateTime(value: string) {
  if (!value) return undefined;
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  if (![year, month, day, hours, minutes].every(Number.isFinite)) return undefined;
  return new Date(year, month - 1, day, hours, minutes);
}

function toLocalDateTimeValue(date: Date, time: string) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T${time || "23:59"}`;
}

export function DateTimePicker({
  value,
  onChange,
  id,
  placeholder = "Select date and time",
  min,
  disabled = false,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseLocalDateTime(value), [value]);
  const time = value.split("T")[1]?.slice(0, 5) || "23:59";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-start px-3 text-left font-normal hover:translate-y-0 active:scale-100",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <CalendarDays className="mr-2 h-4 w-4" />
          {selected ? format(selected, "dd/MM/yyyy HH:mm") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          locale={vi}
          selected={selected}
          defaultMonth={selected ?? min ?? new Date()}
          disabled={min ? { before: startOfDay(min) } : undefined}
          onSelect={(date) => {
            if (date) onChange(toLocalDateTimeValue(date, time));
          }}
          autoFocus
        />
        <div className="flex items-center gap-2 border-t border-border p-3">
          <Clock3 className="h-4 w-4 text-muted-foreground" />
          <Input
            type="time"
            value={time}
            disabled={!selected}
            aria-label="Deadline time"
            className="h-9"
            onChange={(event) => {
              if (selected) onChange(toLocalDateTimeValue(selected, event.target.value));
            }}
          />
        </div>
        <div className="flex justify-between border-t border-border p-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            Clear
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
