import { OrderTracking } from "@/components/order-tracking";

// `id` is the unguessable tracking token, never the human-readable order number.
export default async function OrderTrackingPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <OrderTracking token={id}/>; }
