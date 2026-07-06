import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

type BreadcrumbItem = {
  label: ReactNode;
  href?: string;
};

type AdminPageHeaderProps = {
  breadcrumbs: BreadcrumbItem[];
  title: ReactNode;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
};

export function AdminPageHeader({
  breadcrumbs,
  title,
  description,
  backHref,
  actions,
}: AdminPageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-3">
          {backHref ? (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground shadow-none hover:text-foreground"
              asChild
            >
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Link>
            </Button>
          ) : null}
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground"
          >
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1;

              return (
                <span key={index} className="flex min-w-0 items-center gap-2">
                  {index > 0 ? <span className="text-muted-foreground/40">/</span> : null}
                  {item.href && !isLast ? (
                    <Link href={item.href} className="truncate transition-colors hover:text-foreground">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="truncate font-semibold text-foreground">{item.label}</span>
                  )}
                </span>
              );
            })}
          </nav>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
