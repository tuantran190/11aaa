import React from 'react';
import { 
  FileText, 
  Flower, 
  Truck, 
  CheckCircle,
  Clock,
  Clock3,
  XCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Package,
  CheckCircle2
} from 'lucide-react';

interface OrderStepperProps {
  status: string;
  role: 'customer' | 'admin' | 'staff' | 'shipper';
  reason?: string;
  statusHistory?: {
    status: string;
    updatedAt: string | Date;
    updatedBy: { id: string; name: string; role?: string };
  }[];
  onStatusUpdate?: (newStatus: string) => void;
}

export default function OrderStepper({ status, role, reason, statusHistory, onStatusUpdate }: OrderStepperProps) {
  const isShipper = role === 'shipper';
  const [showLogs, setShowLogs] = React.useState(false);
  
  const formatDate = (dateValue?: string | Date) => {
    if (!dateValue) return '--:--';
    const date = new Date(dateValue);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} - ${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  const getStatusLabel = (s: string) => {
    switch (s) {
      case 'pending': return 'Chờ duyệt';
      case 'confirmed': return 'Đã xác nhận';
      case 'processing': return 'Đang cắm hoa';
      case 'ready': return 'Sẵn sàng';
      case 'shipping': return 'Đã nhận đơn đi giao';
      case 'delivered': 
      case 'completed': return 'Hoàn thành';
      case 'failed': return 'Thất bại';
      case 'refunded': return 'Đã hoàn tiền';
      case 'returned': return 'Trả hàng';
      case 'cancelled': return 'Đã hủy';
      default: return s;
    }
  };

  const getStepTimestamp = (stepStatuses: string[]) => {
    if (!statusHistory || statusHistory.length === 0) return null;
    const history = [...statusHistory].reverse();
    const entry = history.find(h => stepStatuses.includes(h.status));
    return entry ? entry.updatedAt : null;
  };

  // Define steps dynamically based on status
  const getSteps = () => {
    if (isShipper) {
      return [
        { label: 'Chờ lấy hàng', icon: Clock, statuses: ['ready'] },
        { label: 'Đang giao', icon: Truck, statuses: ['shipping'] },
        { label: 'Hoàn thành', icon: CheckCircle2, statuses: ['delivered', 'completed'] },
      ];
    }

    const baseSteps = [
      { label: 'Chờ duyệt', icon: Clock3, statuses: ['pending'] },
      { label: 'Xác nhận', icon: FileText, statuses: ['confirmed'] },
      { label: 'Thực hiện', icon: Flower, statuses: ['processing'] },
      { label: 'Sẵn sàng', icon: Package, statuses: ['ready'] },
      { label: 'Đang giao', icon: Truck, statuses: ['shipping'] },
    ];

    if (status === 'cancelled') {
      return [...baseSteps, { label: 'Đã hủy', icon: XCircle, statuses: ['cancelled'], color: 'red' }];
    }
    
    if (status === 'returned' || status === 'refunded') {
      return [
        ...baseSteps, 
        { label: 'Hoàn thành', icon: CheckCircle2, statuses: ['delivered', 'completed'] },
        { label: 'Trả hàng', icon: RotateCcw, statuses: ['returned', 'refunded'], color: 'orange' }
      ];
    }

    return [...baseSteps, { label: 'Hoàn thành', icon: CheckCircle2, statuses: ['delivered', 'completed'] }];
  };

  const steps = getSteps();
  const currentStepIndex = steps.findIndex(step => step.statuses.includes(status));
  const isFinalStatus = ['delivered', 'completed', 'failed', 'refunded', 'returned', 'cancelled'].includes(status);

  const handleStepClick = (index: number) => {
    if (!onStatusUpdate || isFinalStatus) return;
    
    if (role === 'admin' || role === 'staff') {
       const availableStatuses = ['pending', 'confirmed', 'processing', 'ready', 'shipping', 'completed'];
       if (index < availableStatuses.length) {
         onStatusUpdate(availableStatuses[index]);
       }
    } else if (role === 'shipper') {
       const nextStatuses = ['ready', 'shipping', 'completed'];
       onStatusUpdate(nextStatuses[index]);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="py-2">
        <div className="relative flex items-center justify-between">
          {/* Progress Line */}
          <div className="absolute left-0 top-[16px] w-full h-[2px] bg-stone-100 -z-10" />
          <div 
            className={`absolute left-0 top-[16px] h-[2px] transition-all duration-500 -z-10 ${
              status === 'cancelled' ? 'bg-red-400' : 
              status === 'returned' ? 'bg-orange-400' : 'bg-green-500'
            }`}
            style={{ width: `${currentStepIndex === -1 ? 0 : (Math.max(0, currentStepIndex) / (steps.length - 1)) * 100}%` }}
          />

          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            const stepTimestamp = getStepTimestamp(step.statuses);
            const isCompleted = index < currentStepIndex || (isLast && currentStepIndex === steps.length - 1);
            const isActive = index === currentStepIndex;
            const StepIcon = step.icon;
            const stepColor = (step as any).color;

            const canClick = onStatusUpdate && index === currentStepIndex + 1 && !isFinalStatus;

            return (
              <div key={index} className="flex flex-col items-center gap-1.5 min-w-[60px]">
                <button
                  disabled={!canClick}
                  onClick={() => handleStepClick(index)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all relative ${
                    isCompleted ? (stepColor === 'red' ? 'bg-red-500' : stepColor === 'orange' ? 'bg-orange-500' : 'bg-green-500') + ' text-white shadow-md' : 
                    isActive ? `bg-white border-2 scale-110 shadow-sm ${stepColor === 'red' ? 'border-red-500 text-red-600' : stepColor === 'orange' ? 'border-orange-500 text-orange-600' : 'border-green-500 text-green-600'}` : 
                    'bg-white border text-stone-300 border-stone-200'
                  } ${canClick ? 'cursor-pointer hover:scale-105 animate-pulse' : 'cursor-default'}`}
                >
                  <StepIcon size={14} strokeWidth={isCompleted || isActive ? 2.5 : 1.5} />
                  {canClick && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full animate-ping" />
                  )}
                </button>
                <span className={`text-[9px] font-bold uppercase tracking-tighter whitespace-nowrap ${
                  isCompleted || isActive ? 'text-stone-800' : 'text-stone-300'
                }`}>
                  {step.label}
                </span>
                <span className={`text-[8px] tracking-tight whitespace-nowrap opacity-60 ${
                  stepTimestamp ? 'text-stone-500' : 'text-transparent'
                }`}>
                  {formatDate(stepTimestamp as any)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Reason Display */}
        {reason && (['cancelled', 'returned', 'refunded', 'failed'].includes(status)) && (
          <div className={`mt-3 p-3 rounded-lg text-[11px] font-medium flex items-start gap-2 border ${
            (status === 'cancelled' || status === 'failed') ? 'bg-red-50 text-red-700 border-red-100' : 'bg-orange-50 text-orange-700 border-orange-100'
          }`}>
            <XCircle size={14} className="mt-0.5 shrink-0" />
            <div>
              <span className="font-bold uppercase tracking-widest block mb-0.5">Lý do {['cancelled', 'failed'].includes(status) ? 'hủy/thất bại' : 'hoàn'}:</span>
              {reason}
            </div>
          </div>
        )}
      </div>

      {/* Detailed History Timeline toggle */}
      {statusHistory && statusHistory.length > 0 && (
        <div className="pt-2 border-t border-stone-100">
          <button 
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-stone-600 transition-colors"
          >
            {showLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Lịch sử chi tiết
          </button>
          
          {showLogs && (
            <div className="mt-4 space-y-3 pl-2 border-l border-stone-100 ml-1.5">
              {[...statusHistory].reverse().map((log, i) => {
                const getRoleColor = (r?: string) => {
                  switch (r) {
                    case 'admin': return 'text-red-600 font-bold';
                    case 'staff': return 'text-blue-600';
                    case 'shipper': return 'text-orange-600';
                    default: return 'text-stone-600';
                  }
                };

                const getRoleLabel = (r?: string) => {
                  switch (r) {
                    case 'admin': return 'Admin';
                    case 'staff': return 'Nhân viên';
                    case 'shipper': return 'Shipper';
                    case 'customer': return 'Khách hàng';
                    default: return r || 'Hệ thống';
                  }
                };

                return (
                  <div key={i} className="relative pl-4">
                    <div className="absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full bg-stone-200" />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] text-stone-400 font-medium font-mono">
                          [{formatDate(log.updatedAt)}]
                        </span>
                        <span className="text-[10px] text-stone-700 uppercase tracking-tight font-bold">
                          - {log.updatedBy.name}
                        </span>
                        <span className={`text-[9px] ${getRoleColor(log.updatedBy.role)}`}>
                          ({getRoleLabel(log.updatedBy.role)})
                        </span>
                        <span className="text-[10px] text-stone-500">
                          : {getStatusLabel(log.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
