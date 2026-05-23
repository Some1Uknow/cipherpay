import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type EmptyStateCardProps = {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
};

export function EmptyStateCard({
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-end gap-3">
        <Link href={actionHref}>
          <Button>{actionLabel}</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
