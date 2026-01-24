import { BrickWall, ArrowUpFromLine, ArrowDownToLine, AppWindow, DoorOpen, Layers, LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

interface SurfaceIconProps extends LucideProps {
    type: string;
}

export function SurfaceIcon({ type, className, ...props }: SurfaceIconProps) {
    const iconClass = cn("h-4 w-4", className);

    if (type.startsWith("wall")) return <BrickWall className={cn(iconClass, "text-orange-600")} {...props} />;
    // Logic uses startsWith("roof") which handles roof_exterior. No change needed here but verifying context.
    if (type.startsWith("roof")) return <ArrowUpFromLine className={cn(iconClass, "text-amber-500")} {...props} />;
    if (type.startsWith("floor")) return <ArrowDownToLine className={cn(iconClass, "text-emerald-500")} {...props} />;
    if (type === "window") return <AppWindow className={cn(iconClass, "text-sky-500")} {...props} />;
    if (type === "door") return <DoorOpen className={cn(iconClass, "text-pink-500")} {...props} />;

    return <Layers className={cn(iconClass, "text-muted-foreground")} {...props} />;
}
