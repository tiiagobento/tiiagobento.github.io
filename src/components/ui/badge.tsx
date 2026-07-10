import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold shadow-xs ring-1 ring-transparent", {
  variants: {
    variant: {
      default: "border-transparent bg-primary text-primary-foreground",
      secondary: "border-transparent bg-secondary text-secondary-foreground ring-border/60",
      outline: "border-border bg-card text-foreground ring-border/50",
      success: "border-emerald-200 bg-emerald-50 text-emerald-700 ring-emerald-100 dark:border-emerald-800/70 dark:bg-emerald-950/35 dark:text-emerald-200 dark:ring-emerald-900/50",
      warning: "border-amber-200 bg-amber-50 text-amber-800 ring-amber-100 dark:border-amber-800/70 dark:bg-amber-950/35 dark:text-amber-200 dark:ring-amber-900/50",
      danger: "border-red-200 bg-red-50 text-red-700 ring-red-100 dark:border-red-800/70 dark:bg-red-950/35 dark:text-red-200 dark:ring-red-900/50",
      gold: "border-amber-200 bg-amber-100 text-amber-900 ring-amber-100 dark:border-amber-700/70 dark:bg-amber-950/45 dark:text-amber-100 dark:ring-amber-900/50",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
