// ============================================================================
// CREATE THIS FILE: client/src/pages/PaymentHistory.tsx
// ============================================================================

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function PaymentHistory() {
  const { data: history, isLoading } = trpc.payment.getPaymentHistory.useQuery({ limit: 50 });
  const { data: subscription } = trpc.payment.getSubscriptionDetails.useQuery();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      success: "default",
      failed: "destructive",
      pending: "secondary",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const formatEventType = (eventType: string) => {
    return eventType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Subscription Card */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle>Current Subscription</CardTitle>
            <CardDescription>Your active plan details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Plan</p>
                <p className="text-lg font-semibold capitalize">{subscription.tier}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                  {subscription.status}
                </Badge>
              </div>
              {subscription.startDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Started</p>
                  <p className="text-sm">{format(new Date(subscription.startDate), 'MMM dd, yyyy')}</p>
                </div>
              )}
              {subscription.endDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Ends</p>
                  <p className="text-sm">{format(new Date(subscription.endDate), 'MMM dd, yyyy')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>All your payment transactions and events</CardDescription>
        </CardHeader>
        <CardContent>
          {!history || history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No payment history yet
            </p>
          ) : (
            <div className="space-y-4">
              {history.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(record.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{formatEventType(record.eventType)}</p>
                        {getStatusBadge(record.status)}
                      </div>
                      {record.subscriptionTier && (
                        <p className="text-sm text-muted-foreground capitalize">
                          {record.subscriptionTier} Plan
                        </p>
                      )}
                      {record.errorMessage && (
                        <p className="text-sm text-red-500 mt-1">{record.errorMessage}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(record.createdAt), 'MMM dd, yyyy HH:mm:ss')}
                      </p>
                    </div>
                  </div>
                  {record.amount && (
                    <div className="flex items-center gap-1 text-lg font-semibold">
                      <DollarSign className="h-4 w-4" />
                      {record.amount.toFixed(2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}