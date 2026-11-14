import { useEffect, useState, type FormEvent } from 'react';
import { PackageCheck, Pill, Plus, X } from 'lucide-react';
import { PortalLayout, type NavItem } from '../components/PortalLayout.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { useAuthStore } from '../store/authStore.ts';
import {
  formatTimestamp,
  subscribeMedicineOrders,
  subscribeMedicines,
  updateMedicineOrderStatus,
  upsertMedicineItem,
  type MedicineItemDoc,
  type MedicineOrderDoc,
  type PharmacyProfileDoc,
} from '../services/careoneDb.ts';

const NAV_ITEMS: NavItem[] = [
  { id: 'orders', label: 'Medicine Orders', icon: PackageCheck },
  { id: 'inventory', label: 'Inventory', icon: Pill },
];

export function PharmacyPortal() {
  const { user, profile } = useAuthStore();
  const pharmProfile = (profile || null) as PharmacyProfileDoc | null;

  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState<MedicineOrderDoc[]>([]);
  const [catalog, setCatalog] = useState<MedicineItemDoc[]>([]);
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Add Medicine Form
  const [medName, setMedName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [category, setCategory] = useState('General');
  const [unitPrice, setUnitPrice] = useState(120);
  const [stockQty, setStockQty] = useState(50);
  const [expiryDate, setExpiryDate] = useState('2027-12-31');
  const [requiresRx, setRequiresRx] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubs = [
      subscribeMedicineOrders(user.uid, 'pharmacy', setOrders),
      subscribeMedicines((rows) => {
        setCatalog(rows.filter((m) => m.pharmacyUid === user.uid));
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user?.uid]);

  const notify = (msg: string) => {
    setErrorMsg('');
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 4000);
  };

  const handleAddMedicine = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await upsertMedicineItem({
        pharmacyUid: user.uid,
        pharmacyName: pharmProfile?.name || user.fullName,
        name: medName,
        genericName,
        category,
        unitPrice,
        stockQuantity: stockQty,
        expiryDate,
        requiresPrescription: requiresRx,
      });
      setMedName('');
      setGenericName('');
      notify('Medicine added to pharmacy catalog.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save medicine item.');
    }
  };

  const handleStatusChange = async (order: MedicineOrderDoc, status: MedicineOrderDoc['status']) => {
    if (!user) return;
    try {
      await updateMedicineOrderStatus(order, user.uid, status);
      notify(`Order ${order.id} updated to ${status}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update order.');
    }
  };

  return (
    <PortalLayout
      portalTitle="Pharmacy Portal"
      portalSubtitle={pharmProfile?.name || 'Partner Pharmacy'}
      navItems={NAV_ITEMS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      theme="glass"
    >
      {feedback && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[13px] text-[#067647] flex items-center justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[13px] text-[#dc2626] flex items-center justify-between">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-4">
          <h1 className="text-[22px] font-semibold text-[#1d1d1f]">Incoming Medicine Orders</h1>
          {orders.length === 0 ? (
            <div className="glass-card text-center py-12 text-[13px] text-[#6e6e73]">
              No medicine orders received yet.
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="glass-card flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-semibold text-[#1d1d1f]">{order.patientName || 'Patient'}</h3>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-[12px] text-[#6e6e73]">
                      Address: {order.deliveryAddress} · Total: INR {order.totalAmount} · {formatTimestamp(order.createdAt)}
                    </p>
                    <p className="text-[12px] text-[#1d1d1f]">
                      Items: {order.items.map((it) => `${it.medicineName} × ${it.quantity}`).join(', ')}
                    </p>
                  </div>

                  {!['delivered', 'rejected', 'cancelled'].includes(order.status) && (
                    <div className="flex flex-wrap gap-2">
                      {order.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => void handleStatusChange(order, 'verified')}
                          className="mac-btn-primary px-3 py-1.5 text-[12px]"
                        >
                          Verify Rx
                        </button>
                      )}
                      {order.status === 'verified' && (
                        <button
                          type="button"
                          onClick={() => void handleStatusChange(order, 'dispatched')}
                          className="mac-btn-primary px-3 py-1.5 text-[12px]"
                        >
                          Dispatch
                        </button>
                      )}
                      {order.status === 'dispatched' && (
                        <button
                          type="button"
                          onClick={() => void handleStatusChange(order, 'delivered')}
                          className="mac-btn-primary px-3 py-1.5 text-[12px]"
                        >
                          Mark Delivered
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleStatusChange(order, 'rejected')}
                        className="mac-btn-danger px-3 py-1.5 text-[12px]"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form onSubmit={handleAddMedicine} className="lg:col-span-5 glass-card space-y-3">
            <h2 className="text-[16px] font-semibold text-[#1d1d1f]">Add Medicine to Catalog</h2>
            <input
              required
              value={medName}
              onChange={(e) => setMedName(e.target.value)}
              placeholder="Medicine brand name *"
              className="w-full px-3 py-2 glass-input text-[13px]"
            />
            <input
              value={genericName}
              onChange={(e) => setGenericName(e.target.value)}
              placeholder="Generic molecule"
              className="w-full px-3 py-2 glass-input text-[13px]"
            />
            <div className="grid grid-cols-2 gap-2.5">
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Category"
                className="px-3 py-2 glass-input text-[13px]"
              />
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="px-3 py-2 glass-input text-[13px]"
              />
              <div>
                <label className="block text-[11px] text-[#6e6e73] mb-0.5">Unit Price (INR)</label>
                <input
                  type="number"
                  min={0}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 glass-input text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#6e6e73] mb-0.5">Stock Quantity</label>
                <input
                  type="number"
                  min={0}
                  value={stockQty}
                  onChange={(e) => setStockQty(Number(e.target.value))}
                  className="w-full px-3 py-2 glass-input text-[13px]"
                />
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-[12px] cursor-pointer">
              <input
                type="checkbox"
                checked={requiresRx}
                onChange={(e) => setRequiresRx(e.target.checked)}
              />
              <span>Requires Doctor Prescription</span>
            </label>
            <button type="submit" className="mac-btn-primary w-full py-2.5 text-[13px] inline-flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span>Publish Medicine</span>
            </button>
          </form>

          <div className="lg:col-span-7 glass-card space-y-3">
            <h2 className="text-[16px] font-semibold text-[#1d1d1f]">Active Inventory ({catalog.length})</h2>
            {catalog.length === 0 ? (
              <p className="text-[13px] text-[#6e6e73] py-6 text-center">No medicines published yet.</p>
            ) : (
              <div className="divide-y divide-black/[0.06]">
                {catalog.map((m) => (
                  <div key={m.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                    <div>
                      <p className="font-semibold text-[#1d1d1f]">{m.name}</p>
                      <p className="text-[11px] text-[#6e6e73]">
                        {m.genericName || m.category} · Expiry: {m.expiryDate || 'N/A'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 font-mono-tabular text-[12px]">
                      <span>INR {m.unitPrice}</span>
                      <span>Stock: {m.stockQuantity}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
