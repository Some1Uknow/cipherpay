import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MetricCardProps = {
  label: string;
  value: string;
  note: string;
};

export function MetricCard({ label, value, note }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-[var(--brand-muted-ink)]">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-[28px] font-semibold tracking-[-0.04em] text-[var(--brand-primary)]">{value}</p>
        <p className="mt-1.5 text-sm leading-6 text-[var(--brand-muted-ink)]">{note}</p>
      </CardContent>
    </Card>
  );
}
