import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant?: "complete" | "compact";
  className?: string;
  priority?: boolean;
};

/**
 * The supplied brand sheet contains two official lockups. Each viewport frames
 * the appropriate lockup while keeping the original artwork untouched.
 */
export function BrandLogo({ variant = "compact", className, priority = false }: BrandLogoProps) {
  const isComplete = variant === "complete";

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden bg-white",
        isComplete ? "aspect-[1.78/1]" : "aspect-[3.2/1]",
        className,
      )}
    >
      <Image
        src="/brand/nova-forma-logo-applications.png"
        alt="Nova Forma Steel Frame"
        fill
        priority={priority}
        quality={88}
        sizes={isComplete ? "(max-width: 767px) 11rem, 22rem" : "(max-width: 767px) 9rem, 13rem"}
        className={cn("object-cover", isComplete ? "object-top" : "object-[center_88%]")}
      />
    </div>
  );
}
