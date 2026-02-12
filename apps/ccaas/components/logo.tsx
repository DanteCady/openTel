"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { container: "h-10 w-10", image: 36 },
  md: { container: "h-14 w-14", image: 48 },
  lg: { container: "h-20 w-20", image: 64 },
};

export function Logo({ size = "md", className }: LogoProps) {
  const { container, image } = sizeMap[size];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted/50",
        container,
        className
      )}
    >
      <Image
        src="/logo.png"
        alt="OpenTel"
        width={image}
        height={image}
        className="h-full w-full object-contain"
      />
    </span>
  );
}
