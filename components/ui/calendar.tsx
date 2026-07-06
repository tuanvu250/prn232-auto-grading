"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  navLayout = "around",
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      navLayout={navLayout}
      showOutsideDays={showOutsideDays}
      className={cn("p-3 bg-popover text-popover-foreground rounded-md", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4 relative",
        month_caption: "relative flex h-9 items-center justify-center px-9 pt-1",
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "absolute left-0 top-1 h-7 w-7 rounded-full bg-transparent p-0 opacity-50 hover:translate-y-0 hover:opacity-100 active:scale-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "absolute right-0 top-1 h-7 w-7 rounded-full bg-transparent p-0 opacity-50 hover:translate-y-0 hover:opacity-100 active:scale-100"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center flex items-center justify-center h-9",
        week: "flex w-full mt-2 justify-center",
        day: "h-9 w-9 p-0 font-normal text-center text-sm relative flex items-center justify-center",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground flex items-center justify-center rounded-md"
        ),
        selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
        today: "bg-accent text-accent-foreground",
        outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, ...props }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("h-4 w-4", className)} {...props} />;
          }
          return <ChevronRight className={cn("h-4 w-4", className)} {...props} />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
