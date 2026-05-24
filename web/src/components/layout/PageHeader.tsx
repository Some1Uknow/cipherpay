import { Badge } from "@/components/ui/badge";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  badge?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, description, badge, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-primary)]">{eyebrow}</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.045em] text-[var(--brand-ink-deep)] sm:text-[32px]">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--brand-muted-ink)]">{description}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {badge ? <Badge tone="blue">{badge}</Badge> : null}
        {actions}
      </div>
    </div>
  );
}
