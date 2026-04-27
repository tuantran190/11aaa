import toast from 'react-hot-toast';

export const confirmAction = (message: string, onConfirm: () => void) => {
  toast((t) => (
    <div className="flex flex-col gap-4">
      <p className="font-medium text-sm">{message}</p>
      <div className="flex gap-2 justify-end">
        <button 
          onClick={() => toast.dismiss(t.id)} 
          className="px-3 py-1 text-xs border border-stone-200 rounded-md hover:bg-stone-50"
        >
          Hủy
        </button>
        <button 
          onClick={() => {
            onConfirm();
            toast.dismiss(t.id);
          }} 
          className="px-3 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Đồng ý
        </button>
      </div>
    </div>
  ), { duration: Infinity });
};
