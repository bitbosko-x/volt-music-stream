import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function SkeletonCard() {
    return (
        <div className="space-y-3">
            <Skeleton className="h-40 w-full rounded-xl" />
            <div className="space-y-2">
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-3 w-[60%]" />
            </div>
        </div>
    )
}

export function SkeletonRow() {
    return (
        <div className="flex items-center space-x-4 py-2">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
            </div>
        </div>
    )
}
